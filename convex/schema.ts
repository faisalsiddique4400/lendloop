import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { category, condition, loanStatus, noteKind } from "./lib/validators";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
    trusted: v.boolean(),
  }).index("by_token", ["tokenIdentifier"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category,
    condition,
    description: v.string(),
  }).index("by_owner", ["ownerId"]),

  loans: defineTable({
    toolId: v.id("tools"),
    ownerId: v.id("users"),
    borrowerId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    status: loanStatus,
  })
    .index("by_tool", ["toolId", "status"])
    .index("by_owner", ["ownerId"])
    .index("by_borrower", ["borrowerId"])
    .index("by_status_end", ["status", "endDate"]),

  notifications: defineTable({
    userId: v.id("users"),
    loanId: v.optional(v.id("loans")),
    kind: noteKind,
    message: v.string(),
    eventId: v.string(),
    read: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_loan", ["loanId"])
    .index("by_event", ["eventId"]),
});
