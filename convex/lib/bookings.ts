import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { overlaps } from "./dates";

export function approvedLoans(ctx: QueryCtx, toolId: Id<"tools">) {
  return ctx.db
    .query("loans")
    .withIndex("by_tool", (q) => q.eq("toolId", toolId).eq("status", "approved"))
    .collect();
}

export function clashes(loans: Doc<"loans">[], span: { startDate: string; endDate: string }, exceptId?: Id<"loans">) {
  return loans.some((loan) => loan._id !== exceptId && overlaps(loan, span));
}
