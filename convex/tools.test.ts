import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { addDays, todayIso } from "./lib/dates";
import { addLoan, addTool, scheduledKinds, setup, signIn } from "./test.setup";

const days = (n: number) => addDays(todayIso(), n);

test("create checks the name and description", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  const base = { category: "Garden" as const, condition: "Good" as const, description: "" };
  await expect(ali.as.mutation(api.tools.create, { ...base, name: "  " })).rejects.toThrow("Give the tool a name.");
  await expect(ali.as.mutation(api.tools.create, { ...base, name: "Rake", description: "x".repeat(201) })).rejects.toThrow(
    "200 characters",
  );
  const id = await addTool(ali, "  Hedge trimmer ");
  expect(await ali.as.query(api.tools.mine, {})).toMatchObject([{ _id: id, name: "Hedge trimmer", status: "Available", onLoan: false }]);
});

test("list shows who has a tool and when it is booked", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  const sara = await signIn(t, "Sara");
  const toolId = await addTool(ali);
  await addLoan(t, toolId, sara.id, { startDate: days(-2), endDate: days(1), status: "approved" });
  await addLoan(t, toolId, sara.id, { startDate: days(5), endDate: days(6), status: "approved" });
  await addLoan(t, toolId, sara.id, { startDate: days(8), endDate: days(9), status: "pending" });
  const [tool] = await sara.as.query(api.tools.list, {});
  expect(tool).toMatchObject({ ownerName: "Ali", mine: false, available: false, overdue: false, backOn: days(1) });
  expect(tool.booked).toHaveLength(2);
  expect(await ali.as.query(api.tools.mine, {})).toMatchObject([{ status: "With Sara", onLoan: true }]);
});

test("the public list shows only free tools, without owners", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  const sara = await signIn(t, "Sara");
  const ladder = await addTool(ali, "Ladder");
  const drill = await addTool(ali, "Drill");
  await addLoan(t, drill, sara.id, { startDate: days(-1), endDate: days(1), status: "approved" });
  expect(await t.query(api.tools.listPublic, {})).toEqual([{ _id: ladder, name: "Ladder", category: "Power tools" }]);
});

test("only the owner edits", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  const sara = await signIn(t, "Sara");
  const toolId = await addTool(ali);
  const edit = { toolId, name: "Drill", category: "Power tools" as const, condition: "Worn" as const, description: "" };
  await expect(sara.as.mutation(api.tools.update, edit)).rejects.toThrow("Only the owner");
  await ali.as.mutation(api.tools.update, edit);
  expect(await ali.as.query(api.tools.mine, {})).toMatchObject([{ name: "Drill", condition: "Worn" }]);
});

test("remove is blocked while lent out, and declines waiting requests", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  const sara = await signIn(t, "Sara");
  const ada = await signIn(t, "Ada", "admin");
  const toolId = await addTool(ali);
  const lent = await addLoan(t, toolId, sara.id, { startDate: days(0), endDate: days(1), status: "approved" });
  await expect(ali.as.mutation(api.tools.remove, { toolId })).rejects.toThrow("lent out or booked");
  await t.run((ctx) => ctx.db.patch(lent, { status: "returned" }));
  const waiting = await addLoan(t, toolId, sara.id, { startDate: days(3), endDate: days(4), status: "pending" });
  await expect(sara.as.mutation(api.tools.remove, { toolId })).rejects.toThrow("Only the owner");
  await ada.as.mutation(api.tools.remove, { toolId });
  expect(await t.run((ctx) => ctx.db.get(waiting))).toMatchObject({ status: "declined" });
  expect(await t.run((ctx) => ctx.db.get(toolId))).toBeNull();
  expect(await scheduledKinds(t)).toEqual(["request_declined"]);
});
