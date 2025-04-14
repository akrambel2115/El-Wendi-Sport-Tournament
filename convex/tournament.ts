import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Get the current tournament settings
export const get = query({
  args: {},
  handler: async (ctx) => {
    const tournaments = await ctx.db.query("tournament").collect();
    return tournaments.length > 0 ? tournaments[0] : null;
  },
});

// Initialize or update tournament settings
export const save = mutation({
  args: {
    tournamentId: v.optional(v.id("tournament")),
    currentStage: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    settings: v.object({
      teamsPerGroup: v.number(),
      maxPlayersPerTeam: v.number(),
      playerFeeAmount: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    // If there's an existing tournament, update it
    if (args.tournamentId) {
      await ctx.db.patch(args.tournamentId, {
        currentStage: args.currentStage,
        startDate: args.startDate,
        endDate: args.endDate,
        settings: args.settings,
      });
      return args.tournamentId;
    } 
    
    // Otherwise, create a new tournament
    return await ctx.db.insert("tournament", {
      currentStage: args.currentStage,
      startDate: args.startDate,
      endDate: args.endDate,
      settings: args.settings,
    });
  },
});

// Update the current tournament stage
export const updateStage = mutation({
  args: {
    tournamentId: v.id("tournament"),
    newStage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tournamentId, {
      currentStage: args.newStage,
    });
    return args.tournamentId;
  },
});

// Create a new group
export const createGroup = mutation({
  args: {
    name: v.string(),
    teams: v.array(v.id("teams")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("groups", {
      name: args.name,
      teams: args.teams,
      completed: false,
    });
  },
});

// Complete a group stage
export const completeGroup = mutation({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.groupId, {
      completed: true,
    });
    return args.groupId;
  },
});

// Get all groups
export const listGroups = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("groups").collect();
  },
});

// Get teams for a specific group
export const getGroupTeams = query({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      return [];
    }

    // Fetch all the teams in this group
    const teams = await Promise.all(
      group.teams.map(async (teamId) => {
        return await ctx.db.get(teamId);
      })
    );

    return teams.filter(team => team !== null);
  },
});

// Assign teams to groups
export const assignTeamsToGroups = mutation({
  args: {
    assignments: v.array(
      v.object({
        teamId: v.id("teams"),
        groupId: v.optional(v.id("groups")),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Process each assignment
    for (const assignment of args.assignments) {
      const { teamId, groupId } = assignment;
      const team = await ctx.db.get(teamId);
      if (!team) continue;

      // If we have a previous group assignment, remove the team from that group
      if (team.groupId) {
        // Find the old group by name
        const oldGroups = await ctx.db
          .query("groups")
          .filter((q) => q.eq(q.field("name"), team.groupId))
          .collect();
        
        // Remove team from old group's teams array
        for (const oldGroup of oldGroups) {
          if (oldGroup.teams.includes(teamId)) {
            await ctx.db.patch(oldGroup._id, {
              teams: oldGroup.teams.filter(id => id !== teamId),
            });
          }
        }
      }

      // If groupId is null/undefined, we're just removing the team from its group
      if (!groupId) {
        // Clear the team's groupId
        await ctx.db.patch(teamId, {
          groupId: undefined,
        });
        continue;
      }

      // Get the current group data
      const group = await ctx.db.get(groupId);
      if (!group) continue;

      // Check if team is already in the group
      if (!group.teams.some(id => id === teamId)) {
        // Add the team to the group
        await ctx.db.patch(groupId, {
          teams: [...group.teams, teamId],
        });
      }

      // Update the team's groupId field
      await ctx.db.patch(teamId, {
        groupId: group.name,
      });
    }

    return { success: true };
  },
});

// Delete a group
export const deleteGroup = mutation({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    // First, update any teams that belong to this group to remove the groupId
    for (const teamId of group.teams) {
      const team = await ctx.db.get(teamId);
      if (team && team.groupId === group.name) {
        await ctx.db.patch(teamId, {
          groupId: undefined
        });
      }
    }

    // Delete the group itself
    await ctx.db.delete(args.groupId);
    
    return { success: true };
  },
});

// Utility function to sync team and group relationships
export const syncTeamsAndGroups = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all groups and teams
    const groups = await ctx.db.query("groups").collect();
    const teams = await ctx.db.query("teams").collect();
    
    let updates = 0;
    
    // Step 1: Ensure all teams in group.teams have their groupId set correctly
    for (const group of groups) {
      for (const teamId of group.teams) {
        const team = await ctx.db.get(teamId);
        if (team && team.groupId !== group.name) {
          await ctx.db.patch(teamId, {
            groupId: group.name
          });
          updates++;
        }
      }
    }
    
    // Step 2: Ensure all teams with a groupId are in the correct group.teams array
    for (const team of teams) {
      if (team.groupId) {
        // Find the group with this name
        const matchingGroups = await ctx.db
          .query("groups")
          .filter((q) => q.eq(q.field("name"), team.groupId))
          .collect();
        
        if (matchingGroups.length > 0) {
          const group = matchingGroups[0];
          if (!group.teams.includes(team._id)) {
            await ctx.db.patch(group._id, {
              teams: [...group.teams, team._id]
            });
            updates++;
          }
        } else {
          // Group doesn't exist, clear the team's groupId
          await ctx.db.patch(team._id, {
            groupId: undefined
          });
          updates++;
        }
      }
    }
    
    return { success: true, updates };
  }
}); 