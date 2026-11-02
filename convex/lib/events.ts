import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { loanEventKind, type LoanEventKind } from "./validators";

export const eventFields = {
  kind: loanEventKind,
  eventId: v.string(),
  recipientId: v.id("users"),
  loanId: v.id("loans"),
  toolName: v.string(),
  startDate: v.string(),
  endDate: v.string(),
};

export async function emitLoanEvent(
  ctx: MutationCtx,
  kind: LoanEventKind,
  loan: Doc<"loans">,
  toolName: string,
  eventId = `${kind}:${loan._id}`,
) {
  await ctx.scheduler.runAfter(0, internal.n8n.send, {
    kind,
    eventId,
    recipientId: kind === "request_created" ? loan.ownerId : loan.borrowerId,
    loanId: loan._id,
    toolName,
    startDate: loan.startDate,
    endDate: loan.endDate,
    attempt: 0,
  });
}
