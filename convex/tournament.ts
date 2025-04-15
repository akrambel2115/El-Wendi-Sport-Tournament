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

// Synchronize team statistics based on match data
export const syncTeamStats = mutation({
  args: {},
  handler: async (ctx) => {
    // Fetch all teams and matches
    const teams = await ctx.db.query("teams").collect();
    const matches = await ctx.db.query("matches").collect();

    let updatedTeams = 0;

    // Process each team
    for (const team of teams) {
      // Reset team stats
      const teamStats = {
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      };

      // Find all completed matches involving this team
      const teamMatches = matches.filter(
        match => 
          match.status === "completed" && 
          match.score && 
          (match.teamAId === team._id || match.teamBId === team._id)
      );

      // Calculate stats from matches
      for (const match of teamMatches) {
        // Skip if match doesn't have a valid score object
        if (!match.score) {
          console.warn(`Match ${match._id} is marked as completed but has no score. Skipping.`);
          continue;
        }
        
        // Ensure score properties are valid numbers, default to 0 if not
        const teamAScore = typeof match.score.teamA === 'number' ? match.score.teamA : 0;
        const teamBScore = typeof match.score.teamB === 'number' ? match.score.teamB : 0;
        
        teamStats.played++;

        if (match.teamAId === team._id) {
          // Team is Team A
          teamStats.goalsFor += teamAScore;
          teamStats.goalsAgainst += teamBScore;

          if (teamAScore > teamBScore) {
            // Team A won
            teamStats.won++;
            teamStats.points += 3;
          } else if (teamAScore < teamBScore) {
            // Team A lost
            teamStats.lost++;
          } else {
            // Draw
            teamStats.drawn++;
            teamStats.points += 1;
          }
        } else {
          // Team is Team B
          teamStats.goalsFor += teamBScore;
          teamStats.goalsAgainst += teamAScore;

          if (teamBScore > teamAScore) {
            // Team B won
            teamStats.won++;
            teamStats.points += 3;
          } else if (teamBScore < teamAScore) {
            // Team B lost
            teamStats.lost++;
          } else {
            // Draw
            teamStats.drawn++;
            teamStats.points += 1;
          }
        }
      }

      // Update team with new stats
      const oldStats = team.stats || {};
      
      // Check if stats have changed before updating
      if (
        oldStats.played !== teamStats.played ||
        oldStats.won !== teamStats.won ||
        oldStats.drawn !== teamStats.drawn ||
        oldStats.lost !== teamStats.lost ||
        oldStats.goalsFor !== teamStats.goalsFor ||
        oldStats.goalsAgainst !== teamStats.goalsAgainst ||
        oldStats.points !== teamStats.points
      ) {
        await ctx.db.patch(team._id, { stats: teamStats });
        updatedTeams++;
      }
    }

    return { success: true, updatedTeams };
  },
});

// Validate team statistics without making changes (audit function)
export const validateTeamStats = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("Starting team stats validation...");
    
    // Fetch all teams and matches
    const teams = await ctx.db.query("teams").collect();
    const matches = await ctx.db.query("matches")
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();
      
    console.log(`Found ${teams.length} teams and ${matches.length} completed matches for validation`);
    
    const teamReport = [];
    let inconsistenciesFound = 0;
    
    // Process each team
    for (const team of teams) {
      console.log(`Validating stats for team: ${team.name}`);
      
      // Calculate expected stats
      const expectedStats = {
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      };

      // Find all completed matches involving this team
      const teamMatches = matches.filter(
        match => match.score && (match.teamAId === team._id || match.teamBId === team._id)
      );
      
      console.log(`Found ${teamMatches.length} matches for team ${team.name}`);

      // Calculate expected stats from matches
      for (const match of teamMatches) {
        expectedStats.played++;

        if (match.teamAId === team._id) {
          // Team is Team A
          expectedStats.goalsFor += match.score?.teamA || 0;
          expectedStats.goalsAgainst += match.score?.teamB || 0;

          const scoreA = match.score?.teamA ?? 0;
          const scoreB = match.score?.teamB ?? 0;

          if (scoreA > scoreB) {
            // Team A won
            expectedStats.won++;
            expectedStats.points += 3;
          } else if (scoreA < scoreB) {
            // Team A lost
            expectedStats.lost++;
          } else {
            // Draw
            expectedStats.drawn++;
            expectedStats.points += 1;
          }
        } else {
          // Team is Team B
          expectedStats.goalsFor += match.score?.teamB || 0;
          expectedStats.goalsAgainst += match.score?.teamA || 0;

          const scoreA = match.score?.teamA ?? 0;
          const scoreB = match.score?.teamB ?? 0;

          if (scoreB > scoreA) {
            // Team B won
            expectedStats.won++;
            expectedStats.points += 3;
          } else if (scoreB < scoreA) {
            // Team B lost
            expectedStats.lost++;
          } else {
            // Draw
            expectedStats.drawn++;
            expectedStats.points += 1;
          }
        }
      }

      // Get current stats with defaults for missing values
      const currentStats = team.stats || {
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      };
      
      // Check for inconsistencies
      const discrepancies = [];
      
      if (currentStats.played !== expectedStats.played) {
        discrepancies.push(`Played: current=${currentStats.played}, expected=${expectedStats.played}`);
      }
      if (currentStats.won !== expectedStats.won) {
        discrepancies.push(`Won: current=${currentStats.won}, expected=${expectedStats.won}`);
      }
      if (currentStats.drawn !== expectedStats.drawn) {
        discrepancies.push(`Drawn: current=${currentStats.drawn}, expected=${expectedStats.drawn}`);
      }
      if (currentStats.lost !== expectedStats.lost) {
        discrepancies.push(`Lost: current=${currentStats.lost}, expected=${expectedStats.lost}`);
      }
      if (currentStats.goalsFor !== expectedStats.goalsFor) {
        discrepancies.push(`Goals for: current=${currentStats.goalsFor}, expected=${expectedStats.goalsFor}`);
      }
      if (currentStats.goalsAgainst !== expectedStats.goalsAgainst) {
        discrepancies.push(`Goals against: current=${currentStats.goalsAgainst}, expected=${expectedStats.goalsAgainst}`);
      }
      if (currentStats.points !== expectedStats.points) {
        discrepancies.push(`Points: current=${currentStats.points}, expected=${expectedStats.points}`);
      }
      
      if (discrepancies.length > 0) {
        inconsistenciesFound++;
        teamReport.push({
          teamId: team._id,
          teamName: team.name,
          hasDiscrepancies: true,
          discrepancies,
          currentStats,
          expectedStats
        });
        console.log(`Found ${discrepancies.length} discrepancies for team ${team.name}`);
      } else {
        teamReport.push({
          teamId: team._id,
          teamName: team.name,
          hasDiscrepancies: false
        });
        console.log(`No discrepancies found for team ${team.name}`);
      }
    }
    
    console.log(`Validation complete. Found inconsistencies in ${inconsistenciesFound} teams`);
    
    return { 
      success: true,
      teamsChecked: teams.length,
      matchesExamined: matches.length,
      inconsistenciesFound,
      teamReport
    };
  },
}); 