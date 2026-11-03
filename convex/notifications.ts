import { ConvexError, v, type ObjectType } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { noteKind } from "./lib/validators";

const noteFields = {
  eventId: v.string(),
  userId: v.id("users"),
  loanId: v.optional(v.id("loans")),
  kind: noteKind,
  message: v.string(),
};

async function insertOnce(ctx: MutationCtx, note: ObjectType<typeof noteFields>) {
  const seen = await ctx.db
    .query("notifications")
    .withIndex("by_event", (q) => q.eq("eventId", note.eventId))
    .unique();
  if (seen) return false;
  await ctx.db.insert("notifications", { ...note, read: false });
  return true;
}

export const record = internalMutation({
  args: { ...noteFields, loanId: v.id("loans") },
  handler: async (ctx, note) => {
    const loan = await ctx.db.get(note.loanId);
    if (!loan || (note.userId !== loan.ownerId && note.userId !== loan.borrowerId)) {
      throw new ConvexError("That person is not part of that loan.");
    }
    return { created: await insertOnce(ctx, note) };
  },
});

export const alertAdmins = internalMutation({
  args: { eventId: v.string(), message: v.string() },
  handler: async (ctx, { eventId, message }) => {
    const admins = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();
    for (const admin of admins) {
      await insertOnce(ctx, { eventId: `${eventId}:${admin._id}`, userId: admin._id, kind: "automation_failed", message });
    }
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
  },
});

export const markRead = mutation({
  args: { id: v.optional(v.id("notifications")) },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    if (id) {
      const note = await ctx.db.get(id);
      if (!note || note.userId !== user._id) throw new ConvexError("That notice isn't yours.");
      await ctx.db.patch(id, { read: true });
      return;
    }
    const notes = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    await Promise.all(notes.filter((note) => !note.read).map((note) => ctx.db.patch(note._id, { read: true })));
  },
});
