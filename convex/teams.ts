import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// List all teams
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teams").collect();
  },
});

// Get team by ID
export const getById = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.teamId);
  },
});

// Keep original function for backward compatibility
export const getByGroup = query({
  args: {
    groupId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teams")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();
  },
});

// Get teams by group with improved consistency
export const getTeamsByGroup = query({
  args: {
    groupId: v.optional(v.id("groups")),
    groupName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { groupId, groupName } = args;
    
    // If no group identifiers are provided, return an empty array
    if (!groupId && !groupName) {
      return [];
    }
    
    // If we have a groupId, get the group info first
    if (groupId) {
      const group = await ctx.db.get(groupId);
      if (!group) return [];
      
      // Use group name for string-based lookup
      const teamsByGroupName = await ctx.db
        .query("teams")
        .filter((q) => q.eq(q.field("groupId"), group.name))
        .collect();
      
      // Also fetch teams by direct ID association from group.teams array
      const teamPromises = group.teams.map(teamId => ctx.db.get(teamId));
      const teamsById = (await Promise.all(teamPromises)).filter(Boolean);
      
      // Merge results, ensuring no duplicates
      const allTeamIds = new Set();
      const mergedTeams = [];
      
      // Add teams found by name
      for (const team of teamsByGroupName) {
        allTeamIds.add(team._id.toString());
        mergedTeams.push(team);
      }
      
      // Add teams found by ID if not already included
      for (const team of teamsById) {
        if (team && !allTeamIds.has(team._id.toString())) {
          mergedTeams.push(team);
        }
      }
      
      return mergedTeams;
    }
    
    // If we only have a group name, do a direct lookup
    if (groupName) {
      return await ctx.db
        .query("teams")
        .filter((q) => q.eq(q.field("groupId"), groupName))
        .collect();
    }
    
    return [];
  },
});

// Create a new team
export const create = mutation({
  args: {
    name: v.string(),
    groupId: v.optional(v.string()),
    players: v.optional(v.array(
      v.object({
        fullName: v.string(),
        feeStatus: v.boolean(),
        photoUrl: v.optional(v.string()),
        paymentDate: v.optional(v.string()),
      })
    )),
    stats: v.optional(
      v.object({
        played: v.number(),
        won: v.number(),
        drawn: v.number(),
        lost: v.number(),
        goalsFor: v.number(),
        goalsAgainst: v.number(),
        points: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("teams", {
      name: args.name,
      groupId: args.groupId,
      players: args.players || [],
      stats: args.stats || {
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      },
    });
  },
});

// Update a team
export const update = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    groupId: v.optional(v.string()),
    players: v.optional(v.array(
      v.object({
        fullName: v.string(),
        feeStatus: v.boolean(),
        photoUrl: v.optional(v.string()),
        paymentDate: v.optional(v.string()),
      })
    )),
    stats: v.optional(
      v.object({
        played: v.number(),
        won: v.number(),
        drawn: v.number(),
        lost: v.number(),
        goalsFor: v.number(),
        goalsAgainst: v.number(),
        points: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { teamId, ...updateFields } = args;
    return await ctx.db.patch(teamId, updateFields);
  },
});

// Remove a team
export const remove = mutation({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.teamId);
  },
});

export const syncTeamStats = mutation({
  handler: async (ctx) => {
    try {
      console.log("Starting full team stats synchronization...");
      
      // Get all teams
      const teams = await ctx.db.query("teams").collect();
      console.log(`Found ${teams.length} teams to synchronize`);
      
      // Get all completed matches
      const matches = await ctx.db
        .query("matches")
        .filter((q) => q.eq(q.field("status"), "completed"))
        .collect();
      console.log(`Found ${matches.length} completed matches for calculation`);

      // Initialize stats for all teams
      const teamStatMap = new Map();
      
      for (const team of teams) {
        teamStatMap.set(team._id, {
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
        });
      }
      
      // Calculate stats based on all completed matches
      for (const match of matches) {
        if (!match.score) {
          console.warn(`Match ${match._id} is marked as completed but has no score`);
          continue;
        }

        const teamAId = match.teamAId;
        const teamBId = match.teamBId;
        
        // Skip if teams not found in our map (which shouldn't happen)
        if (!teamStatMap.has(teamAId) || !teamStatMap.has(teamBId)) {
          console.warn(`Match ${match._id} references non-existent teams: A=${teamAId}, B=${teamBId}`);
          continue;
        }
        
        const teamAStats = teamStatMap.get(teamAId);
        const teamBStats = teamStatMap.get(teamBId);
        
        // Increment played count
        teamAStats.played += 1;
        teamBStats.played += 1;
        
        // Add goals
        teamAStats.goalsFor += match.score.teamA;
        teamAStats.goalsAgainst += match.score.teamB;
        teamBStats.goalsFor += match.score.teamB;
        teamBStats.goalsAgainst += match.score.teamA;
        
        // Determine match result
        if (match.score.teamA > match.score.teamB) {
          // Team A won
          teamAStats.won += 1;
          teamAStats.points += 3;
          teamBStats.lost += 1;
        } else if (match.score.teamA < match.score.teamB) {
          // Team B won
          teamBStats.won += 1;
          teamBStats.points += 3;
          teamAStats.lost += 1;
        } else {
          // Draw
          teamAStats.drawn += 1;
          teamBStats.drawn += 1;
          teamAStats.points += 1;
          teamBStats.points += 1;
        }
      }
      
      // Update all teams with their calculated stats
      const updates = [];
      for (const team of teams) {
        const newStats = teamStatMap.get(team._id);
        console.log(`Updating team ${team.name} with stats:`, newStats);
        updates.push(ctx.db.patch(team._id, { stats: newStats }));
      }
      
      // Wait for all updates to complete
      await Promise.all(updates);
      
      console.log("Team stats synchronization completed successfully");
      return { 
        success: true, 
        teamsUpdated: teams.length,
        matchesProcessed: matches.length 
      };
    } catch (error) {
      console.error("Error synchronizing team stats:", error);
      throw new Error(`Failed to synchronize team stats: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});
