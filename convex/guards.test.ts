import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { addDays, todayIso } from "./lib/dates";
import { addLoan, addTool, setup, signIn } from "./test.setup";

const days = (n: number) => addDays(todayIso(), n);

test("every signed-in function refuses a caller with no identity", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  const sara = await signIn(t, "Sara");
  const toolId = await addTool(ali);
  const loanId = await addLoan(t, toolId, sara.id, { startDate: days(1), endDate: days(2), status: "pending" });
  const notice = await t.run((ctx) =>
    ctx.db.insert("notifications", { eventId: "e1", userId: ali.id, kind: "request_created", message: "Hi", read: false }),
  );
  const tool = { name: "Rake", category: "Garden", condition: "Good", description: "" } as const;
  const calls = [
    () => t.query(api.tools.list, {}),
    () => t.query(api.tools.mine, {}),
    () => t.query(api.loans.mine, {}),
    () => t.query(api.loans.incoming, {}),
    () => t.query(api.loans.all, {}),
    () => t.query(api.notifications.mine, {}),
    () => t.query(api.users.list, {}),
    () => t.mutation(api.users.store, {}),
    () => t.mutation(api.users.setTrusted, { userId: ali.id, trusted: true }),
    () => t.mutation(api.tools.create, tool),
    () => t.mutation(api.tools.update, { toolId, ...tool }),
    () => t.mutation(api.tools.remove, { toolId }),
    () => t.mutation(api.loans.request, { toolId, startDate: days(1), endDate: days(2) }),
    () => t.mutation(api.loans.decide, { loanId, approve: true }),
    () => t.mutation(api.loans.markReturned, { loanId }),
    () => t.mutation(api.loans.remind, { loanId }),
    () => t.mutation(api.notifications.markRead, { id: notice }),
    () => t.mutation(api.notifications.markRead, {}),
  ];
  for (const call of calls) await expect(call()).rejects.toThrow("Sign in first");
});

test("a neighbor who does not own the tool cannot return or remind", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  const sara = await signIn(t, "Sara");
  const toolId = await addTool(ali);
  const loanId = await addLoan(t, toolId, sara.id, { startDate: days(-5), endDate: days(-2), status: "approved" });
  await expect(sara.as.mutation(api.loans.markReturned, { loanId })).rejects.toThrow("Only the owner");
  await expect(sara.as.mutation(api.loans.remind, { loanId })).rejects.toThrow("Only the owner");
});
