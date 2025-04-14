import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// List all staff members
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("staff").collect();
  },
});

// Get staff by role
export const getByRole = query({
  args: {
    role: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("staff")
      .filter((q) => q.eq(q.field("role"), args.role))
      .collect();
  },
});

// Create a new staff member
export const create = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    photoUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    availability: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("staff", {
      name: args.name,
      role: args.role,
      photoUrl: args.photoUrl,
      phone: args.phone,
      email: args.email,
      availability: args.availability,
    });
  },
});

// Update a staff member
export const update = mutation({
  args: {
    staffId: v.id("staff"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    availability: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { staffId, ...updateFields } = args;
    return await ctx.db.patch(staffId, updateFields);
  },
});

// Remove a staff member
export const remove = mutation({
  args: {
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.staffId);
  },
});

// Create a new function to work around caching issues
export const addStaff = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    phone: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("staff", {
      name: args.name,
      role: args.role,
      photoUrl: args.photoUrl,
      phone: args.phone,
    });
  },
});

// New update function to work around caching issues
export const updateStaffMember = mutation({
  args: {
    staffId: v.id("staff"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    phone: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { staffId, ...updateFields } = args;
    return await ctx.db.patch(staffId, updateFields);
  },
}); 