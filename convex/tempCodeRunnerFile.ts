import { mutation } from "./_generated/server";

export const createDefaultAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if default admin already exists
    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("name"), "akram"))
      .first();
    
    if (!existingAdmin) {
      // Create default admin
      await ctx.db.insert("users", {
        name: "akram",
      });
    }
  },
});
