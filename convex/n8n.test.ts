import { expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { verify } from "./lib/hmac";
import { addLoan, addTool, setup, signIn, type T } from "./test.setup";

async function seed(t: T) {
  const ali = await signIn(t, "Ali");
  const sara = await signIn(t, "Sara");
  const toolId = await addTool(ali);
  const loanId = await addLoan(t, toolId, sara.id, { startDate: "2026-11-05", endDate: "2026-11-08", status: "pending" });
  return {
    ali,
    event: {
      kind: "request_created" as const,
      eventId: `request_created:${loanId}`,
      recipientId: ali.id,
      loanId,
      toolName: "Cordless drill",
      startDate: "2026-11-05",
      endDate: "2026-11-08",
      attempt: 0,
    },
  };
}

test("send posts a signed body with no names in it", async () => {
  const t = setup();
  const { event } = await seed(t);
  await t.action(internal.n8n.send, event);
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  const body = init!.body as string;
  expect(url).toBe("https://n8n.test/webhook/lendloop-events");
  expect(JSON.parse(body)).toEqual({ ts: expect.any(Number), ...event, attempt: undefined });
  expect(body).not.toContain("Ali");
  const signature = (init!.headers as Record<string, string>)["X-LendLoop-Signature"];
  expect(await verify("test-secret", body, signature)).toBe(true);
});

test("send retries three times, then tells admins", async () => {
  const t = setup();
  const ada = await signIn(t, "Ada", "admin");
  const { event } = await seed(t);
  vi.mocked(fetch).mockRejectedValue(new Error("offline"));
  await t.action(internal.n8n.send, event);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(fetch).toHaveBeenCalledTimes(4);
  expect(await ada.as.query(api.notifications.mine, {})).toMatchObject([
    {
      kind: "automation_failed",
      message: "Couldn't send the notice for the cordless drill after 4 tries. Check that n8n is running.",
    },
  ]);
});

test("send doesn't retry when n8n refuses the request, and says why", async () => {
  const t = setup();
  const ada = await signIn(t, "Ada", "admin");
  const { event } = await seed(t);
  vi.mocked(fetch).mockResolvedValue(new Response("Bad signature", { status: 401 }));
  await t.action(internal.n8n.send, event);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(await ada.as.query(api.notifications.mine, {})).toMatchObject([
    {
      kind: "automation_failed",
      message: "n8n refused the notice for the cordless drill (status 401). Check that both sides use the same signing secret.",
    },
  ]);
});

test("a missing webhook URL alerts admins instead of throwing", async () => {
  const t = setup();
  const ada = await signIn(t, "Ada", "admin");
  const { event } = await seed(t);
  vi.stubEnv("N8N_WEBHOOK_URL", "");
  await t.action(internal.n8n.send, event);
  expect(fetch).not.toHaveBeenCalled();
  expect(await ada.as.query(api.notifications.mine, {})).toMatchObject([
    {
      kind: "automation_failed",
      message: "LendLoop can't reach n8n: set N8N_WEBHOOK_URL and LENDLOOP_HMAC_SECRET on the Convex deployment.",
    },
  ]);
});
