import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { setup, signIn } from "./test.setup";

test("record writes each event once", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  const note = { eventId: "e1", userId: ali.id, kind: "request_created" as const, message: "Hello" };
  expect(await t.mutation(internal.notifications.record, note)).toEqual({ created: true });
  expect(await t.mutation(internal.notifications.record, note)).toEqual({ created: false });
  expect(await ali.as.query(api.notifications.mine, {})).toHaveLength(1);
});

test("people see and mark only their own notices", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  const sara = await signIn(t, "Sara");
  await t.mutation(internal.notifications.record, { eventId: "e1", userId: ali.id, kind: "request_created", message: "For Ali" });
  expect(await sara.as.query(api.notifications.mine, {})).toEqual([]);
  const [note] = await ali.as.query(api.notifications.mine, {});
  await expect(sara.as.mutation(api.notifications.markRead, { id: note._id })).rejects.toThrow("isn't yours");
  await ali.as.mutation(api.notifications.markRead, {});
  expect((await ali.as.query(api.notifications.mine, {}))[0].read).toBe(true);
});

test("alertAdmins tells every admin once", async () => {
  const t = setup();
  const ada = await signIn(t, "Ada", "admin");
  const bo = await signIn(t, "Bo", "admin");
  const ali = await signIn(t, "Ali");
  await t.mutation(internal.notifications.alertAdmins, { eventId: "x", message: "n8n is down" });
  await t.mutation(internal.notifications.alertAdmins, { eventId: "x", message: "n8n is down" });
  expect(await ada.as.query(api.notifications.mine, {})).toMatchObject([{ kind: "automation_failed", message: "n8n is down" }]);
  expect(await bo.as.query(api.notifications.mine, {})).toHaveLength(1);
  expect(await ali.as.query(api.notifications.mine, {})).toHaveLength(0);
});
