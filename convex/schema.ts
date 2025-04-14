import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  users: defineTable({
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    lastLogin: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
  }),

  teams: defineTable({
    name: v.string(),
    players: v.array(
      v.object({
        fullName: v.string(),
        dateOfBirth: v.string(),
        feeStatus: v.boolean(),
        photoUrl: v.optional(v.string()),
        paymentDate: v.optional(v.string()),
      })
    ),
    groupId: v.optional(v.string()),
    stats: v.object({
      played: v.number(),
      won: v.number(),
      drawn: v.number(),
      lost: v.number(),
      goalsFor: v.number(),
      goalsAgainst: v.number(),
      points: v.number(),
    }),
  }),

  matches: defineTable({
    date: v.string(),
    time: v.string(),
    teamAId: v.id("teams"),
    teamBId: v.id("teams"),
    stage: v.string(), // "group", "round16", "quarter", "semi", "final"
    groupId: v.optional(v.string()),
    referees: v.array(v.id("staff")),
    status: v.string(), // "scheduled", "live", "completed"
    score: v.optional(
      v.object({
        teamA: v.number(),
        teamB: v.number(),
      })
    ),
    events: v.optional(
      v.array(
        v.object({
          type: v.string(), // "goal", "yellowCard", "redCard"
          playerId: v.string(),
          teamId: v.id("teams"),
          minute: v.number(),
        })
      )
    ),
    manOfTheMatch: v.optional(v.string()),
  }).index("by_date", ["date"]),

  staff: defineTable({
    name: v.string(),
    role: v.string(), // "referee", "medical", "security", "organizer"
    photoUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    availability: v.optional(v.array(v.string())),
  }),

  groups: defineTable({
    name: v.string(),
    teams: v.array(v.id("teams")),
    completed: v.boolean(),
  }),

  tournament: defineTable({
    currentStage: v.string(), // "group", "round16", "quarter", "semi", "final"
    startDate: v.string(),
    endDate: v.string(),
    settings: v.object({
      teamsPerGroup: v.number(),
      maxPlayersPerTeam: v.number(),
      playerFeeAmount: v.optional(v.number()),
    }),
  }),
};

// Extend authTables with custom fields
const extendedAuthTables = {
  ...authTables,
  authAccounts: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    providerAccountId: v.string(),
    secret: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
    isAdmin: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...extendedAuthTables,
  ...applicationTables,
});
