/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

export const modules = import.meta.glob(["./**/*.*s", "!./**/*.*.*"]);
export const setup = () => convexTest(schema, modules);
export type T = ReturnType<typeof setup>;
type Person = Awaited<ReturnType<typeof signIn>>;

export async function signIn(t: T, name: string, role: "user" | "admin" = "user") {
  const as = t.withIdentity({ name, email: `${name.toLowerCase()}@example.com`, subject: name, tokenIdentifier: `test|${name}` });
  const id = await as.mutation(api.users.store, {});
  if (role === "admin") await t.run((ctx) => ctx.db.patch(id, { role: "admin" }));
  return { as, id };
}

export function addTool(owner: Person, name = "Cordless drill") {
  return owner.as.mutation(api.tools.create, { name, category: "Power tools", condition: "Good", description: "" });
}

export function addLoan(
  t: T,
  toolId: Id<"tools">,
  borrowerId: Id<"users">,
  fields: Pick<Doc<"loans">, "startDate" | "endDate" | "status">,
) {
  return t.run(async (ctx) => {
    const tool = (await ctx.db.get(toolId))!;
    return await ctx.db.insert("loans", { toolId, ownerId: tool.ownerId, borrowerId, ...fields });
  });
}

export async function scheduledKinds(t: T) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.map((job) => (job.args[0] as { kind: string }).kind);
}
