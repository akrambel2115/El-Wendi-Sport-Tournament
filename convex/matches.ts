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
      // Get default stats with fallbacks for undefined values
      const teamAStats = {
        played: (teamA.stats?.played || 0) + 1,
        won: teamA.stats?.won || 0,
        drawn: teamA.stats?.drawn || 0,
        lost: teamA.stats?.lost || 0,
        goalsFor: (teamA.stats?.goalsFor || 0) + args.teamAGoals,
        goalsAgainst: (teamA.stats?.goalsAgainst || 0) + args.teamBGoals,
        points: teamA.stats?.points || 0,
      };

      // Update team B stats with fallbacks
      const teamBStats = {
        played: (teamB.stats?.played || 0) + 1,
        won: teamB.stats?.won || 0,
        drawn: teamB.stats?.drawn || 0,
        lost: teamB.stats?.lost || 0,
        goalsFor: (teamB.stats?.goalsFor || 0) + args.teamBGoals,
        goalsAgainst: (teamB.stats?.goalsAgainst || 0) + args.teamAGoals,
        points: teamB.stats?.points || 0,
      };

      // Determine match result for team stats
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
    return await ctx.db.delete(args.matchId);
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