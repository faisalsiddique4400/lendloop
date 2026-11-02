import { ConvexError, v, type ObjectType } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireOwner, requireUser } from "./lib/auth";
import { approvedLoans } from "./lib/bookings";
import { plural, todayIso } from "./lib/dates";
import { emitLoanEvent } from "./lib/events";
import { category, condition } from "./lib/validators";

const toolFields = { name: v.string(), category, condition, description: v.string() };

function clean(fields: ObjectType<typeof toolFields>) {
  const name = fields.name.trim();
  const description = fields.description.trim();
  if (!name) throw new ConvexError("Give the tool a name.");
  if (name.length > 60) throw new ConvexError("Keep the name under 60 characters.");
  if (description.length > 200) throw new ConvexError("Keep the description to 200 characters.");
  return { ...fields, name, description };
}

async function currentLoan(ctx: QueryCtx, tool: Doc<"tools">, today: string) {
  const loans = await approvedLoans(ctx, tool._id);
  return { loans, current: loans.find((loan) => loan.startDate <= today) };
}

async function loadTool(ctx: QueryCtx, toolId: Doc<"tools">["_id"]) {
  const tool = await ctx.db.get(toolId);
  if (!tool) throw new ConvexError("That tool is no longer listed.");
  return tool;
}

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const today = todayIso();
    const tools = await ctx.db.query("tools").order("desc").take(50);
    const free = [];
    for (const tool of tools) {
      if (!(await currentLoan(ctx, tool, today)).current) free.push({ _id: tool._id, name: tool.name, category: tool.category });
    }
    return free;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const today = todayIso();
    // ponytail: one neighborhood is small, so no paging. Switch to .paginate() past a few hundred tools.
    const tools = await ctx.db.query("tools").order("desc").collect();
    return await Promise.all(
      tools.map(async (tool) => {
        const [owner, { loans, current }] = await Promise.all([ctx.db.get(tool.ownerId), currentLoan(ctx, tool, today)]);
        return {
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          ownerName: owner?.name ?? "A neighbor",
          ownerTrusted: owner?.trusted ?? false,
          mine: tool.ownerId === user._id,
          available: !current,
          overdue: !!current && current.endDate < today,
          backOn: current?.endDate ?? null,
          booked: loans.filter((loan) => loan.endDate >= today).map(({ startDate, endDate }) => ({ startDate, endDate })),
        };
      }),
    );
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const today = todayIso();
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();
    return await Promise.all(
      tools.map(async (tool) => {
        const { current } = await currentLoan(ctx, tool, today);
        const waiting = await ctx.db
          .query("loans")
          .withIndex("by_tool", (q) => q.eq("toolId", tool._id).eq("status", "pending"))
          .collect();
        const borrower = current && (await ctx.db.get(current.borrowerId));
        const status = current
          ? `With ${borrower?.name.split(" ")[0] ?? "a neighbor"}${current.endDate < today ? ", overdue" : ""}`
          : waiting.length
            ? `${plural(waiting.length, "request")} waiting`
            : "Available";
        return { ...tool, onLoan: !!current, status };
      }),
    );
  },
});

export const create = mutation({
  args: toolFields,
  handler: async (ctx, fields) => {
    const user = await requireUser(ctx);
    return await ctx.db.insert("tools", { ...clean(fields), ownerId: user._id });
  },
});

export const update = mutation({
  args: { toolId: v.id("tools"), ...toolFields },
  handler: async (ctx, { toolId, ...fields }) => {
    const user = await requireUser(ctx);
    requireOwner(user, await loadTool(ctx, toolId));
    await ctx.db.patch(toolId, clean(fields));
  },
});

export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const user = await requireUser(ctx);
    const tool = await loadTool(ctx, toolId);
    if (user.role !== "admin") requireOwner(user, tool);
    if ((await approvedLoans(ctx, toolId)).length) throw new ConvexError("You can't delete a tool that is lent out or booked.");
    const waiting = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", toolId).eq("status", "pending"))
      .collect();
    for (const loan of waiting) {
      await ctx.db.patch(loan._id, { status: "declined" });
      await emitLoanEvent(ctx, "request_declined", loan, tool.name);
    }
    await ctx.db.delete(toolId);
  },
});
