import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkIsAdmin } from "./auth";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

/**
 * List function with absolutely no authentication checks or complex logic
 */
export const list = query({
  handler: async (ctx) => {
    try {
      // Get all users from the database
      const users = await ctx.db.query("users").collect();
      
      // Return all users formatted as admin objects
      return users.map(user => ({
        _id: user._id,
        username: user.name,
        role: user.role || "editor",
        lastLogin: user.lastLogin || null
      }));
    } catch (error) {
      console.error("Error in admin list query:", error);
      return [];
    }
  }
});

/**
 * Creates a new admin user.
 */
export const create = mutation({
  args: {
    username: v.string(),
    password: v.string(),
    role: v.optional(v.string())
  },
  handler: async (ctx, { username, password, role }) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("name"), username))
      .first();

    if (existingUser) {
      throw new Error("User already exists");
    }

    // Create new user
    const userId = await ctx.db.insert("users", { 
      name: username,
      role: role || "editor",
      createdAt: new Date().toISOString()
    });

    // Create new auth account and set as admin
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: username,
      secret: password, // Note: In production use a proper password hashing function
      isAdmin: true,
    });

    return userId;
  },
});

/**
 * Updates an admin user's role.
 */
export const updateRole = mutation({
  args: {
    adminId: v.id("users"),
    newRole: v.string()
  },
  handler: async (ctx, { adminId, newRole }) => {
    // Get the user to update
    const user = await ctx.db.get(adminId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Update user's role
    await ctx.db.patch(adminId, { role: newRole });
    
    return { success: true };
  }
});

/**
 * Updates an admin user's password.
 */
export const updatePassword = mutation({
  args: {
    adminId: v.id("users"),
    newPassword: v.string()
  },
  handler: async (ctx, { adminId, newPassword }) => {
    // Get the user to update
    const user = await ctx.db.get(adminId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Find the auth account for this user
    const authAccount = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), adminId))
      .first();
    
    if (!authAccount) {
      throw new Error("Auth account not found");
    }
    
    // Update the password
    await ctx.db.patch(authAccount._id, {
      secret: newPassword // Note: In production use a proper password hashing function
    });
    
    return { success: true };
  }
});

/**
 * Removes an admin user.
 */
export const remove = mutation({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, { adminId }) => {
    // Find and delete the auth account for this user
    const authAccount = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), adminId))
      .first();

    if (authAccount) {
      await ctx.db.delete(authAccount._id);
    }

    // Delete the user
    await ctx.db.delete(adminId);

    return { success: true };
  },
});

/**
 * Records user login activity
 */
export const recordLogin = mutation({
  args: {
    userId: v.id("users")
  },
  handler: async (ctx, { userId }) => {
    const now = new Date().toISOString();
    
    // Update the user's last login timestamp
    await ctx.db.patch(userId, {
      lastLogin: now
    });
    
    return { success: true };
  }
});

export const register = mutation({
  args: {
    name: v.string(),
    password: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { name, password, role } = args;

    // Check if the user already exists
    const existingUser = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("providerAccountId"), name))
      .unique();

    if (existingUser) {
      throw new Error("Username already exists");
    }

    // Create a new user
    const userId = await ctx.db.insert("users", {
      name,
      role: role || "admin",
      createdAt: new Date().toISOString(),
    });

    // Create auth account
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "username",
      providerAccountId: name,
      secret: password, // In a real app, hash this password
      isAdmin: true,
    });

    return { success: true, userId };
  },
});

export const login = mutation({
  args: {
    name: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const { name, password } = args;

    // Find the user
    const authAccount = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("providerAccountId"), name))
      .unique();

    if (!authAccount) {
      throw new Error("Invalid credentials");
    }

    // Check password
    if (authAccount.secret !== password) {
      throw new Error("Invalid credentials");
    }

    // Update last login
    const user = await ctx.db.get(authAccount.userId);
    if (user) {
      await ctx.db.patch(authAccount.userId, {
        lastLogin: new Date().toISOString(),
      });
    }

    return {
      success: true,
      user: {
        id: user?._id,
        name: user?.name,
        role: user?.role,
        isAdmin: authAccount.isAdmin,
      },
    };
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    // Get all users
    const users = await ctx.db.query("users").collect();
    const authAccountsPromises = users.map(async (user) => {
      const authAccount = await ctx.db
        .query("authAccounts")
        .filter((q) => q.eq(q.field("userId"), user._id))
        .unique();
      
      return {
        id: user._id,
        name: user.name,
        role: user.role || "admin",
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isAdmin: authAccount?.isAdmin || false,
      };
    });

    return Promise.all(authAccountsPromises);
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId as Id<"users">);
    if (!user) {
      return null;
    }

    const authAccount = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .unique();

    return {
      id: user._id,
      name: user.name as string,
      role: (user.role as string) || "admin",
      isAdmin: authAccount?.isAdmin || false,
    };
  },
});
