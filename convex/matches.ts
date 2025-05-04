import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// List all matches
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("matches").collect();
  },
});

// Get match by ID
export const getById = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.matchId);
  },
});

// Get match by ID (alternative function with different parameter name)
export const get = query({
  args: { id: v.id("matches") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get matches by group
export const getByGroup = query({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("matches")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();
  },
});

// Get matches by team (either as teamA or teamB)
export const getByTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const asTeamA = await ctx.db
      .query("matches")
      .filter((q) => q.eq(q.field("teamAId"), args.teamId))
      .collect();

    const asTeamB = await ctx.db
      .query("matches")
      .filter((q) => q.eq(q.field("teamBId"), args.teamId))
      .collect();

    return [...asTeamA, ...asTeamB];
  },
});

// Create a new match
export const create = mutation({
  args: {
    date: v.string(),
    time: v.string(),
    teamAId: v.id("teams"),
    teamBId: v.id("teams"),
    stage: v.string(),
    groupId: v.optional(v.string()),
    referees: v.array(v.id("staff")),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("matches", {
      date: args.date,
      time: args.time,
      teamAId: args.teamAId,
      teamBId: args.teamBId,
      stage: args.stage,
      groupId: args.groupId,
      referees: args.referees,
      status: args.status,
    });
  },
});

// Update match details
export const update = mutation({
  args: {
    matchId: v.id("matches"),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    referees: v.optional(v.array(v.id("staff"))),
    status: v.optional(v.string()),
    score: v.optional(v.object({
      teamA: v.number(),
      teamB: v.number()
    })),
    events: v.optional(v.array(
      v.object({
        type: v.string(),
        playerId: v.string(),
        teamId: v.id("teams"),
        minute: v.number(),
      })
    )),
    manOfTheMatch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { matchId, ...updateFields } = args;
    
    // Remove undefined fields
    const fieldsToUpdate = Object.fromEntries(
      Object.entries(updateFields).filter(([_, value]) => value !== undefined)
    );
    
    if (Object.keys(fieldsToUpdate).length === 0) {
      return await ctx.db.get(matchId);
    }
    
    return await ctx.db.patch(matchId, fieldsToUpdate);
  },
});

// Record match result (previously updateResult)
export const recordMatchResult = mutation({
  args: {
    matchId: v.id("matches"),
    teamAGoals: v.number(),
    teamBGoals: v.number(),
    events: v.optional(v.array(
      v.object({
        type: v.string(),
        playerId: v.string(),
        teamId: v.id("teams"),
        minute: v.number(),
      })
    )),
    manOfTheMatch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    // Update the teams' stats
    const teamA = await ctx.db.get(match.teamAId);
    const teamB = await ctx.db.get(match.teamBId);

    if (teamA && teamB) {
      // Check if this is a new result or updating an existing one
      const isUpdateExisting = match.status === "completed";
      
      // Calculate previous result impact if this is an update to reverse it
      let prevTeamAPoints = 0;
      let prevTeamBPoints = 0;
      let prevTeamAWon = 0;
      let prevTeamBWon = 0;
      let prevTeamADrawn = 0;
      let prevTeamBDrawn = 0;
      let prevTeamALost = 0;
      let prevTeamBLost = 0;
      
      if (isUpdateExisting && match.score) {
        // Reverse previous result effect
        if (match.score.teamA > match.score.teamB) {
          // Team A won previously
          prevTeamAPoints = 3;
          prevTeamAWon = 1;
          prevTeamBLost = 1;
        } else if (match.score.teamA < match.score.teamB) {
          // Team B won previously
          prevTeamBPoints = 3;
          prevTeamBWon = 1;
          prevTeamALost = 1;
        } else {
          // Previous result was a draw
          prevTeamAPoints = 1;
          prevTeamBPoints = 1;
          prevTeamADrawn = 1;
          prevTeamBDrawn = 1;
        }
      }
      
      // Get default stats with fallbacks for undefined values
      const teamAStats = {
        // Only increment played count for new matches, not updates
        played: (teamA.stats?.played || 0) + (isUpdateExisting ? 0 : 1),
        won: (teamA.stats?.won || 0) - prevTeamAWon,
        drawn: (teamA.stats?.drawn || 0) - prevTeamADrawn,
        lost: (teamA.stats?.lost || 0) - prevTeamALost,
        // Update goals by first removing previous goals if updating
        goalsFor: (teamA.stats?.goalsFor || 0) - (isUpdateExisting && match.score ? match.score.teamA : 0) + args.teamAGoals,
        goalsAgainst: (teamA.stats?.goalsAgainst || 0) - (isUpdateExisting && match.score ? match.score.teamB : 0) + args.teamBGoals,
        points: (teamA.stats?.points || 0) - prevTeamAPoints,
      };

      // Update team B stats with fallbacks
      const teamBStats = {
        // Only increment played count for new matches, not updates
        played: (teamB.stats?.played || 0) + (isUpdateExisting ? 0 : 1),
        won: (teamB.stats?.won || 0) - prevTeamBWon,
        drawn: (teamB.stats?.drawn || 0) - prevTeamBDrawn,
        lost: (teamB.stats?.lost || 0) - prevTeamBLost,
        // Update goals by first removing previous goals if updating
        goalsFor: (teamB.stats?.goalsFor || 0) - (isUpdateExisting && match.score ? match.score.teamB : 0) + args.teamBGoals,
        goalsAgainst: (teamB.stats?.goalsAgainst || 0) - (isUpdateExisting && match.score ? match.score.teamA : 0) + args.teamAGoals,
        points: (teamB.stats?.points || 0) - prevTeamBPoints,
      };

      // Apply new result
      if (args.teamAGoals > args.teamBGoals) {
        // Team A won
        teamAStats.won += 1;
        teamAStats.points += 3;
        teamBStats.lost += 1;
      } else if (args.teamAGoals < args.teamBGoals) {
        // Team B won
        teamBStats.won += 1;
        teamBStats.points += 3;
        teamAStats.lost += 1;
      } else {
        // Draw
        teamAStats.drawn += 1;
        teamAStats.points += 1;
        teamBStats.drawn += 1;
        teamBStats.points += 1;
      }

      // Update both teams with complete stat objects (not spreading)
      await ctx.db.patch(match.teamAId, { stats: teamAStats });
      await ctx.db.patch(match.teamBId, { stats: teamBStats });
    }

    // Update match score and status
    return await ctx.db.patch(args.matchId, {
      score: {
        teamA: args.teamAGoals,
        teamB: args.teamBGoals,
      },
      events: args.events,
      manOfTheMatch: args.manOfTheMatch,
      status: "completed",
    });
  },
});

// Remove a match
export const remove = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    // Get the match before deleting it
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    console.log(`Removing match ${args.matchId}`);
    
    try {
      // If the match was completed, we need to update team stats
      if (match.status === "completed" && match.score) {
        console.log(`Match was completed with score: ${match.score.teamA}-${match.score.teamB}, updating team stats`);
        
        const teamA = await ctx.db.get(match.teamAId);
        const teamB = await ctx.db.get(match.teamBId);

        if (!teamA || !teamB) {
          throw new Error(`Teams not found: TeamA: ${!!teamA}, TeamB: ${!!teamB}`);
        }

        // Calculate stats to remove based on the match result
        let teamAPoints = 0;
        let teamBPoints = 0;
        let teamAWon = 0;
        let teamBWon = 0;
        let teamADrawn = 0;
        let teamBDrawn = 0;
        let teamALost = 0;
        let teamBLost = 0;

        // Determine previous match result for team stats
        if (match.score.teamA > match.score.teamB) {
          // Team A won
          teamAPoints = 3;
          teamAWon = 1;
          teamBLost = 1;
        } else if (match.score.teamA < match.score.teamB) {
          // Team B won
          teamBPoints = 3;
          teamBWon = 1;
          teamALost = 1;
        } else {
          // Draw
          teamAPoints = 1;
          teamBPoints = 1;
          teamADrawn = 1;
          teamBDrawn = 1;
        }
        
        const teamAStatsOriginal = teamA.stats || { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
        const teamBStatsOriginal = teamB.stats || { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };

        console.log(`Original TeamA stats:`, teamAStatsOriginal);
        console.log(`Original TeamB stats:`, teamBStatsOriginal);

        // Update team A stats by removing this match's impact
        const teamAStats = {
          played: Math.max(0, (teamAStatsOriginal.played || 0) - 1),
          won: Math.max(0, (teamAStatsOriginal.won || 0) - teamAWon),
          drawn: Math.max(0, (teamAStatsOriginal.drawn || 0) - teamADrawn),
          lost: Math.max(0, (teamAStatsOriginal.lost || 0) - teamALost),
          goalsFor: Math.max(0, (teamAStatsOriginal.goalsFor || 0) - match.score.teamA),
          goalsAgainst: Math.max(0, (teamAStatsOriginal.goalsAgainst || 0) - match.score.teamB),
          points: Math.max(0, (teamAStatsOriginal.points || 0) - teamAPoints),
        };

        // Update team B stats by removing this match's impact
        const teamBStats = {
          played: Math.max(0, (teamBStatsOriginal.played || 0) - 1),
          won: Math.max(0, (teamBStatsOriginal.won || 0) - teamBWon),
          drawn: Math.max(0, (teamBStatsOriginal.drawn || 0) - teamBDrawn),
          lost: Math.max(0, (teamBStatsOriginal.lost || 0) - teamBLost),
          goalsFor: Math.max(0, (teamBStatsOriginal.goalsFor || 0) - match.score.teamB),
          goalsAgainst: Math.max(0, (teamBStatsOriginal.goalsAgainst || 0) - match.score.teamA),
          points: Math.max(0, (teamBStatsOriginal.points || 0) - teamBPoints),
        };

        console.log(`Updated TeamA stats:`, teamAStats);
        console.log(`Updated TeamB stats:`, teamBStats);

        // Update both teams
        await ctx.db.patch(match.teamAId, { stats: teamAStats });
        await ctx.db.patch(match.teamBId, { stats: teamBStats });
      } else {
        console.log("Match was not completed, no team stats to update");
      }

      // Delete the match
      await ctx.db.delete(args.matchId);
      console.log(`Match ${args.matchId} successfully deleted`);
      
      return { success: true, message: "Match deleted successfully" };
    } catch (error) {
      console.error("Error deleting match:", error);
      throw error;
    }
  },
});

// Basic function to save the match result - simplified version for testing
export const saveMatchResult = mutation({
  args: {
    matchId: v.id("matches"),
    scoreA: v.number(),
    scoreB: v.number(),
    events: v.optional(v.array(
      v.object({
        type: v.string(),
        playerId: v.string(),
        teamId: v.id("teams"),
        minute: v.number(),
      })
    )),
    manOfTheMatch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Just update the match - no team stats
    return await ctx.db.patch(args.matchId, {
      score: {
        teamA: args.scoreA,
        teamB: args.scoreB,
      },
      events: args.events,
      manOfTheMatch: args.manOfTheMatch,
      status: "completed",
    });
  },
});

// New function with a different name to avoid caching issues
export const updateMatchResult = mutation({
  args: {
    matchId: v.id("matches"),
    scoreA: v.number(),
    scoreB: v.number(),
    events: v.optional(v.array(
      v.object({
        type: v.string(),
        playerId: v.string(),
        teamId: v.id("teams"),
        minute: v.number(),
      })
    )),
    manOfTheMatch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Just update the match - no team stats
    return await ctx.db.patch(args.matchId, {
      score: {
        teamA: args.scoreA,
        teamB: args.scoreB,
      },
      events: args.events,
      manOfTheMatch: args.manOfTheMatch,
      status: "completed",
    });
  },
});

export const updateScore = mutation({
  args: {
    matchId: v.id("matches"),
    scoreA: v.number(),
    scoreB: v.number()
  },
  handler: async (ctx, args) => {
    // Check if match exists
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    // Update the match with new score
    await ctx.db.patch(args.matchId, {
      score: {
        teamA: args.scoreA,
        teamB: args.scoreB
      },
      status: "completed"
    });

    return { success: true };
  }
});

// Get upcoming matches sorted by date and time
export const getUpcoming = query({
  handler: async (ctx) => {
    const matches = await ctx.db
      .query("matches")
      .filter((q) => q.neq(q.field("status"), "completed"))
      .collect();
    
    // Sort by date first, then by time
    return matches.sort((a, b) => {
      // Compare dates first
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      
      // If dates are equal, compare times
      // Convert time strings (HH:MM) to comparable values
      const [hoursA, minutesA] = a.time.split(':').map(Number);
      const [hoursB, minutesB] = b.time.split(':').map(Number);
      
      // Compare hours
      if (hoursA !== hoursB) {
        return hoursA - hoursB;
      }
      
      // Compare minutes
      return minutesA - minutesB;
    });
  },
});

// Temporary function to replace a team in a match
export const replaceTeamInMatch = mutation({
  args: { 
    matchId: v.id("matches"),
    teamName: v.string(),
    isTeamA: v.boolean()
  },
  handler: async (ctx, args) => {
    console.log(`Replacing ${args.isTeamA ? 'TeamA' : 'TeamB'} in match ${args.matchId} with ${args.teamName}`);
    
    try {
      // Find the team by name
      const teams = await ctx.db
        .query("teams")
        .filter(q => q.eq(q.field("name"), args.teamName))
        .collect();
      
      if (teams.length === 0) {
        throw new Error(`Team "${args.teamName}" not found`);
      }
      
      const teamId = teams[0]._id;
      console.log(`Found team "${args.teamName}" with ID: ${teamId}`);
      
      // Update the match with the new team ID
      const fieldToUpdate = args.isTeamA ? "teamAId" : "teamBId";
      await ctx.db.patch(args.matchId, { [fieldToUpdate]: teamId });
      
      console.log(`Successfully replaced ${args.isTeamA ? 'TeamA' : 'TeamB'} in match ${args.matchId}`);
      return { success: true, message: `Team ${args.isTeamA ? 'A' : 'B'} replaced successfully with "${args.teamName}"` };
    } catch (error) {
      console.error("Error replacing team in match:", error);
      throw error;
    }
  },
});

// Temporary function to list all teams
export const listTeamNames = query({
  handler: async (ctx) => {
    const teams = await ctx.db.query("teams").collect();
    return teams.map(team => ({
      id: team._id,
      name: team.name
    }));
  },
});

// Get matches for a specific knockout round
export const getKnockoutMatches = query({
  args: {
    stage: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("matches")
      .filter((q) => q.eq(q.field("stage"), args.stage))
      .collect();
  }
});

// Update match with result and record winner for tournament progression
export const recordKnockoutResult = mutation({
  args: {
    matchId: v.id("matches"),
    scoreA: v.number(),
    scoreB: v.number(),
    events: v.array(
      v.object({
        type: v.string(),
        playerId: v.string(),
        teamId: v.id("teams"),
        minute: v.number(),
      })
    ),
    manOfTheMatch: v.optional(v.string()),
    nextRound: v.optional(v.string()),
    nextMatchDate: v.optional(v.string()),
    nextMatchTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Update the current match
    await ctx.db.patch(args.matchId, {
      score: {
        teamA: args.scoreA,
        teamB: args.scoreB,
      },
      events: args.events,
      manOfTheMatch: args.manOfTheMatch,
      status: "completed",
    });

    // Get the match
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    // Determine winner
    let winnerId: Id<"teams">;
    if (args.scoreA > args.scoreB) {
      winnerId = match.teamAId;
    } else if (args.scoreA < args.scoreB) {
      winnerId = match.teamBId;
    } else {
      // In case of a draw, we need tie-breaking rules
      // For now, let's just pick teamA as winner (this should be based on penalties etc.)
      winnerId = match.teamAId;
    }

    // If we have info for the next round's match, create it
    if (args.nextRound && args.nextMatchDate && args.nextMatchTime) {
      // Get winner's team info
      const winner = await ctx.db.get(winnerId);
      if (!winner) {
        throw new Error("Winner team not found");
      }

      // TODO: Create next round match - we would need the opposing team
      // This is complex logic that depends on bracket structure
      // For now, this would be handled by the client in our knock-out bracket component
    }

    // Update team stats (should call the shared stats update function)
    try {
      await ctx.db.query("tournament").first();
      // await ctx.db.mutation.tournament.syncTeamStats({});
      // Note: We need to call this through a different mechanism due to how Convex works
    } catch (error) {
      console.error("Failed to sync team stats after knockout match:", error);
    }

    return { success: true };
  }
});