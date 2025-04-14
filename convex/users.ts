import { query } from "./_generated/server";
import { v } from "convex/values";

// Get a user by their name
export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();
  },
});

// Get an auth account for a user
export const getAuthAccount = query({
  args: { 
    userId: v.id("users"),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("authAccounts")
      .filter((q) => 
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("provider"), args.provider)
        )
      )
      .first();
  },
}); 