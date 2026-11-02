import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getUser, requireAdmin } from "./lib/auth";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Sign in first");
    const name = identity.name ?? identity.email ?? "Neighbor";
    const email = identity.email ?? "";
    const existing = await getUser(ctx);
    if (!existing) {
      return await ctx.db.insert("users", { tokenIdentifier: identity.tokenIdentifier, name, email, role: "user", trusted: false });
    }
    if (existing.name !== name || existing.email !== email) await ctx.db.patch(existing._id, { name, email });
    return existing._id;
  },
});

export const me = query({ args: {}, handler: (ctx) => getUser(ctx) });

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return await Promise.all(
      users.map(async (user) => ({
        _id: user._id,
        name: user.name,
        trusted: user.trusted,
        tools: (await ctx.db.query("tools").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect()).length,
      })),
    );
  },
});

export const setTrusted = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(userId, { trusted });
  },
});

export const makeAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
    if (!user) throw new ConvexError("No user with that email. Sign in once first.");
    await ctx.db.patch(user._id, { role: "admin" });
  },
});
