import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { addDays, todayIso } from "./lib/dates";
import { addLoan, addTool, scheduledKinds, setup, signIn, type T } from "./test.setup";

const days = (n: number) => addDays(todayIso(), n);

async function seed(t: T) {
  const ali = await signIn(t, "Ali");
  const sara = await signIn(t, "Sara");
  const toolId = await addTool(ali);
  return { ali, sara, toolId };
}

test("request checks the owner and the dates", async () => {
  const t = setup();
  const { ali, sara, toolId } = await seed(t);
  const ask = (startDate: string, endDate: string) => sara.as.mutation(api.loans.request, { toolId, startDate, endDate });
  await expect(ali.as.mutation(api.loans.request, { toolId, startDate: days(1), endDate: days(2) })).rejects.toThrow(
    "your own tool",
  );
  await expect(ask(days(-3), days(1))).rejects.toThrow("in the past");
  await expect(ask(days(3), days(2))).rejects.toThrow("before the start");
  await expect(ask("soon", days(2))).rejects.toThrow("Pick both dates");
  await addLoan(t, toolId, sara.id, { startDate: days(4), endDate: days(6), status: "approved" });
  await expect(ask(days(6), days(7))).rejects.toThrow("booked for those dates");
  const loanId = await ask(days(1), days(2));
  expect(await ali.as.query(api.loans.incoming, {})).toContainEqual(
    expect.objectContaining({ _id: loanId, status: "pending", toolName: "Cordless drill", borrowerName: "Sara", ownerName: "Ali" }),
  );
  expect(await scheduledKinds(t)).toEqual(["request_created"]);
});

test("only the owner decides, and only once", async () => {
  const t = setup();
  const { ali, sara, toolId } = await seed(t);
  const loanId = await sara.as.mutation(api.loans.request, { toolId, startDate: days(1), endDate: days(2) });
  await expect(sara.as.mutation(api.loans.decide, { loanId, approve: true })).rejects.toThrow("Only the owner");
  await ali.as.mutation(api.loans.decide, { loanId, approve: true });
  await expect(ali.as.mutation(api.loans.decide, { loanId, approve: false })).rejects.toThrow("already answered");
  expect(await sara.as.query(api.loans.mine, {})).toMatchObject([{ status: "approved" }]);
  expect(await scheduledKinds(t)).toEqual(["request_created", "request_approved"]);
});

test("approve refuses dates another approved loan holds", async () => {
  const t = setup();
  const { ali, sara, toolId } = await seed(t);
  const bo = await signIn(t, "Bo");
  const first = await sara.as.mutation(api.loans.request, { toolId, startDate: days(1), endDate: days(3) });
  const second = await bo.as.mutation(api.loans.request, { toolId, startDate: days(2), endDate: days(4) });
  await ali.as.mutation(api.loans.decide, { loanId: first, approve: true });
  await expect(ali.as.mutation(api.loans.decide, { loanId: second, approve: true })).rejects.toThrow("booked");
  await ali.as.mutation(api.loans.decide, { loanId: second, approve: false });
});

test("remind works once a day on late loans, then markReturned closes it", async () => {
  const t = setup();
  const { ali, sara, toolId } = await seed(t);
  const late = await addLoan(t, toolId, sara.id, { startDate: days(-5), endDate: days(-2), status: "approved" });
  const onTime = await addLoan(t, toolId, sara.id, { startDate: days(3), endDate: days(4), status: "approved" });
  await ali.as.mutation(api.loans.remind, { loanId: late });
  await t.mutation(internal.notifications.record, {
    eventId: `nudge:${late}:${todayIso()}`,
    userId: sara.id,
    loanId: late,
    kind: "overdue_reminder",
    message: "Please bring it back",
  });
  await expect(ali.as.mutation(api.loans.remind, { loanId: late })).rejects.toThrow("already sent a reminder today");
  await expect(ali.as.mutation(api.loans.remind, { loanId: onTime })).rejects.toThrow("Only late loans");
  await ali.as.mutation(api.loans.markReturned, { loanId: late });
  await expect(ali.as.mutation(api.loans.markReturned, { loanId: late })).rejects.toThrow("Only a lent tool");
  expect(await scheduledKinds(t)).toEqual(["overdue_reminder", "loan_returned"]);
});

test("overdue lists late approved loans for n8n", async () => {
  const t = setup();
  const { sara, toolId } = await seed(t);
  const late = await addLoan(t, toolId, sara.id, { startDate: days(-5), endDate: days(-2), status: "approved" });
  await addLoan(t, toolId, sara.id, { startDate: days(-1), endDate: days(1), status: "approved" });
  await addLoan(t, toolId, sara.id, { startDate: days(-9), endDate: days(-8), status: "returned" });
  expect(await t.query(internal.loans.overdue, { today: todayIso() })).toEqual([
    { loanId: late, borrowerId: sara.id, toolName: "Cordless drill", endDate: days(-2) },
  ]);
});

test("all is admin only, and recent shows tool names only", async () => {
  const t = setup();
  const { ali, sara, toolId } = await seed(t);
  const ada = await signIn(t, "Ada", "admin");
  const loanId = await addLoan(t, toolId, sara.id, { startDate: days(0), endDate: days(1), status: "approved" });
  await addLoan(t, toolId, sara.id, { startDate: days(3), endDate: days(4), status: "pending" });
  await expect(ali.as.query(api.loans.all, {})).rejects.toThrow("Admins only");
  expect(await ada.as.query(api.loans.all, {})).toHaveLength(2);
  expect(await t.query(api.loans.recent, {})).toEqual([{ _id: loanId, toolName: "Cordless drill", returned: false }]);
});
