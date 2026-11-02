import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin, requireOwner, requireUser } from "./lib/auth";
import { approvedLoans, clashes } from "./lib/bookings";
import { addDays, isIsoDate, todayIso } from "./lib/dates";
import { emitLoanEvent } from "./lib/events";

async function loadLoan(ctx: QueryCtx, loanId: Id<"loans">) {
  const loan = await ctx.db.get(loanId);
  const tool = loan && (await ctx.db.get(loan.toolId));
  if (!loan || !tool) throw new ConvexError("That request no longer exists.");
  return { loan, tool };
}

function withNames(ctx: QueryCtx, loans: Doc<"loans">[]) {
  return Promise.all(
    loans.map(async (loan) => {
      const [tool, owner, borrower] = await Promise.all([
        ctx.db.get(loan.toolId),
        ctx.db.get(loan.ownerId),
        ctx.db.get(loan.borrowerId),
      ]);
      return {
        ...loan,
        toolName: tool?.name ?? "Removed tool",
        ownerName: owner?.name ?? "A neighbor",
        borrowerName: borrower?.name ?? "A neighbor",
      };
    }),
  );
}

export const request = mutation({
  args: { toolId: v.id("tools"), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { toolId, startDate, endDate }) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError("That tool is no longer listed.");
    if (tool.ownerId === user._id) throw new ConvexError("You can't borrow your own tool.");
    if (!isIsoDate(startDate) || !isIsoDate(endDate)) throw new ConvexError("Pick both dates.");
    // Browsers send local dates, so allow one day of time-zone slack.
    if (startDate < addDays(todayIso(), -1)) throw new ConvexError("The start date is in the past.");
    if (endDate < startDate) throw new ConvexError("The end date is before the start.");
    if (clashes(await approvedLoans(ctx, toolId), { startDate, endDate })) {
      throw new ConvexError("This tool is booked for those dates.");
    }
    const loanId = await ctx.db.insert("loans", {
      toolId,
      ownerId: tool.ownerId,
      borrowerId: user._id,
      startDate,
      endDate,
      status: "pending",
    });
    await emitLoanEvent(ctx, "request_created", (await ctx.db.get(loanId))!, tool.name);
    return loanId;
  },
});

export const decide = mutation({
  args: { loanId: v.id("loans"), approve: v.boolean() },
  handler: async (ctx, { loanId, approve }) => {
    const user = await requireUser(ctx);
    const { loan, tool } = await loadLoan(ctx, loanId);
    requireOwner(user, tool);
    if (loan.status !== "pending") throw new ConvexError("This request was already answered.");
    if (approve && loan.endDate < todayIso()) throw new ConvexError("This request's dates have passed.");
    if (approve && clashes(await approvedLoans(ctx, tool._id), loan, loan._id)) {
      throw new ConvexError("This tool is booked for those dates.");
    }
    await ctx.db.patch(loanId, { status: approve ? "approved" : "declined" });
    await emitLoanEvent(ctx, approve ? "request_approved" : "request_declined", loan, tool.name);
  },
});

export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const { loan, tool } = await loadLoan(ctx, loanId);
    requireOwner(user, tool);
    if (loan.status !== "approved") throw new ConvexError("Only a lent tool can be marked returned.");
    await ctx.db.patch(loanId, { status: "returned" });
    await emitLoanEvent(ctx, "loan_returned", loan, tool.name);
  },
});

export const remind = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const { loan, tool } = await loadLoan(ctx, loanId);
    requireOwner(user, tool);
    const today = todayIso();
    if (loan.status !== "approved" || loan.endDate >= today) throw new ConvexError("Only late loans get reminders.");
    const eventId = `nudge:${loanId}:${today}`;
    const sent = await ctx.db
      .query("notifications")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .unique();
    if (sent) throw new ConvexError("You already sent a reminder today.");
    await emitLoanEvent(ctx, "overdue_reminder", loan, tool.name, eventId);
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .order("desc")
      .take(100);
    return await withNames(ctx, loans);
  },
});

export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(100);
    return await withNames(ctx, loans);
  },
});

export const all = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await withNames(ctx, await ctx.db.query("loans").order("desc").take(100));
  },
});

export const recent = query({
  args: {},
  handler: async (ctx) => {
    const loans = await ctx.db.query("loans").order("desc").take(40);
    const shown = loans.filter((loan) => loan.status === "approved" || loan.status === "returned").slice(0, 10);
    return await Promise.all(
      shown.map(async (loan) => ({
        _id: loan._id,
        toolName: (await ctx.db.get(loan.toolId))?.name ?? "A tool",
        returned: loan.status === "returned",
      })),
    );
  },
});

export const overdue = internalQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status_end", (q) => q.eq("status", "approved").lt("endDate", today))
      .collect();
    return await Promise.all(
      loans.map(async (loan) => ({
        loanId: loan._id,
        borrowerId: loan.borrowerId,
        toolName: (await ctx.db.get(loan.toolId))?.name ?? "tool",
        endDate: loan.endDate,
      })),
    );
  },
});
