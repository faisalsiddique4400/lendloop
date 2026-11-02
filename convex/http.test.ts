import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { addDays, todayIso } from "./lib/dates";
import { sign } from "./lib/hmac";
import { addLoan, addTool, setup, signIn, type T } from "./test.setup";

async function post(t: T, path: string, payload: object, secret = "test-secret") {
  const body = JSON.stringify(payload);
  return t.fetch(path, { method: "POST", headers: { "X-LendLoop-Signature": await sign(secret, body) }, body });
}

test("notify writes once and says whether it was new", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  const note = { ts: Date.now(), eventId: "e1", recipientId: ali.id, kind: "request_created", message: "Hello" };
  const first = await post(t, "/n8n/notify", note);
  expect(first.status).toBe(200);
  expect(await first.json()).toEqual({ created: true });
  expect(await (await post(t, "/n8n/notify", note)).json()).toEqual({ created: false });
  expect(await ali.as.query(api.notifications.mine, {})).toMatchObject([{ message: "Hello", read: false }]);
});

test("bad, stale and malformed requests are refused", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  const note = { ts: Date.now(), eventId: "e1", recipientId: ali.id, kind: "request_created", message: "Hi" };
  expect((await post(t, "/n8n/notify", note, "wrong-secret")).status).toBe(401);
  expect((await post(t, "/n8n/notify", { ...note, ts: Date.now() - 6 * 60_000 })).status).toBe(401);
  expect((await post(t, "/n8n/notify", { ...note, recipientId: "nope" })).status).toBe(400);
  expect((await post(t, "/n8n/notify", { ...note, kind: "made_up" })).status).toBe(400);
  expect(await ali.as.query(api.notifications.mine, {})).toEqual([]);
});

test("overdue lists late loans and alert tells admins", async () => {
  const t = setup();
  const ada = await signIn(t, "Ada", "admin");
  const ali = await signIn(t, "Ali");
  const sara = await signIn(t, "Sara");
  const toolId = await addTool(ali);
  const late = await addLoan(t, toolId, sara.id, {
    startDate: addDays(todayIso(), -4),
    endDate: addDays(todayIso(), -1),
    status: "approved",
  });
  const overdue = await post(t, "/n8n/overdue", { ts: Date.now(), runDate: todayIso() });
  expect(await overdue.json()).toEqual([expect.objectContaining({ loanId: late, borrowerId: sara.id })]);
  await post(t, "/n8n/alert", { ts: Date.now(), executionId: "41", message: "Overdue reminders failed" });
  expect(await ada.as.query(api.notifications.mine, {})).toMatchObject([
    { kind: "automation_failed", message: "Overdue reminders failed" },
  ]);
});
