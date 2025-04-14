import { mutation } from "./_generated/server";
import { api } from "./_generated/api";

export const createDefaultAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if default admin already exists
    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("name"), "akram"))
      .first();
    
    if (!existingAdmin) {
      // Create default admin with name and password
      const result = await ctx.runMutation(api.auth.registerUser, {
        name: "akram",
        password: "25577726"
      });
      
      if (result.success && result.userId) {
        // Find and update the auth account to set isAdmin flag
        const authAccount = await ctx.db
          .query("authAccounts")
          .filter((q) => q.eq(q.field("userId"), result.userId))
          .first();
          
        if (authAccount) {
          await ctx.db.patch(authAccount._id, {
            isAdmin: true
          });
        }
      }
      
      console.log("Default admin created with username 'akram' and password '25577726'");
    }
  },
});
