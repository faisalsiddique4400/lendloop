import { v, type Infer } from "convex/values";

export const CATEGORIES = ["Power tools", "Hand tools", "Garden", "Kitchen", "Camping", "Cleaning"] as const;
export const CONDITIONS = ["Like new", "Good", "Worn"] as const;
export const LOAN_EVENT_KINDS = [
  "request_created",
  "request_approved",
  "request_declined",
  "loan_returned",
  "overdue_reminder",
] as const;

const oneOf = <T extends string>(values: readonly T[]) => v.union(...values.map((value) => v.literal(value)));

export const category = oneOf(CATEGORIES);
export const condition = oneOf(CONDITIONS);
export const loanStatus = oneOf(["pending", "approved", "declined", "returned"]);
export const loanEventKind = oneOf(LOAN_EVENT_KINDS);
export const noteKind = oneOf([...LOAN_EVENT_KINDS, "automation_failed"]);

export type Category = Infer<typeof category>;
export type Condition = Infer<typeof condition>;
export type LoanStatus = Infer<typeof loanStatus>;
export type LoanEventKind = Infer<typeof loanEventKind>;
export type NoteKind = Infer<typeof noteKind>;
