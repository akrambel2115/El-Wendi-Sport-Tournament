import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, Anonymous],
});

// Add a utility function to check admin status
export async function checkIsAdmin(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return false;
  }
  
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return false;
  }
  
  // Check if user has an admin account
  const authAccount = await ctx.db
    .query("authAccounts")
    .filter((q: any) => q.eq(q.field("userId"), userId))
    .first();
    
  return authAccount?.isAdmin === true;
}

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return user;
  },
});

// Add a function to record user login time
export const recordLogin = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId } = args;
    
    // Update the user's last login timestamp
    await ctx.db.patch(userId, {
      lastLogin: new Date().toISOString()
    });
    
    return { success: true };
  },
});

// Update the validateCredentials function to record login time
export const validateCredentials = mutation({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const { username, password } = args;
    
    // Find the user with this username
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("name"), username))
      .first();
    
    if (!user) {
      return { 
        valid: false, 
        message: "User not found" 
      };
    }
    
    // Find the auth account for this user
    const authAccount = await ctx.db
      .query("authAccounts")
      .filter((q) => 
        q.and(
          q.eq(q.field("userId"), user._id),
          q.eq(q.field("provider"), "password")
        )
      )
      .first();
    
    if (!authAccount || authAccount.secret !== password) {
      return { 
        valid: false, 
        message: "Invalid credentials" 
      };
    }
    
    // Record the login time
    await ctx.db.patch(user._id, {
      lastLogin: new Date().toISOString()
    });
    
    return { 
      valid: true, 
      userId: user._id 
    };
  },
});

// Register a user with username/password
export const registerUser = mutation({
  args: {
    name: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const { name, password } = args;
    
    // Create user record
    const userId = await ctx.db.insert("users", {
      name,
    });
    
    try {
      // Create auth account record directly
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: name, // Using name as the account ID
        secret: password, // This would normally be hashed in a real implementation
      });
      
      console.log("Successfully registered user:", name);
      return { success: true, userId };
    } catch (error) {
      // If auth account creation fails, delete the user
      await ctx.db.delete(userId);
      console.error("Failed to register user:", error);
      throw new Error("Failed to register user");
    }
  },
});

// Function to set a user as admin (for development/troubleshooting)
export const forceSetAdmin = mutation({
  args: {
    username: v.string(),
  },
  handler: async (ctx, { username }) => {
    // Find the user
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("name"), username))
      .first();
    
    if (!user) {
      return { success: false, message: "User not found" };
    }

    // Find the auth account for this user
    const authAccount = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();
    
    if (!authAccount) {
      return { success: false, message: "Auth account not found" };
    }
    
    // Update isAdmin flag
    await ctx.db.patch(authAccount._id, {
      isAdmin: true
    });
    
    console.log(`Set user ${username} as admin`);
    return { success: true, message: "User set as admin" };
  },
});
