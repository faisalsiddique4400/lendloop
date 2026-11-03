import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction, type ActionCtx } from "./_generated/server";
import { isIsoDate } from "./lib/dates";
import { verify } from "./lib/hmac";
import type { NoteKind } from "./lib/validators";

const MAX_AGE_MS = 5 * 60_000;
type Payload = Record<string, unknown>;

function signedRoute(handle: (ctx: ActionCtx, payload: Payload) => Promise<unknown>) {
  return httpAction(async (ctx, request) => {
    const body = await request.text();
    const secret = process.env.LENDLOOP_HMAC_SECRET;
    if (!secret || !(await verify(secret, body, request.headers.get("X-LendLoop-Signature")))) {
      return new Response("Bad signature", { status: 401 });
    }
    try {
      const payload = JSON.parse(body) as Payload;
      if (typeof payload.ts !== "number" || Math.abs(Date.now() - payload.ts) > MAX_AGE_MS) {
        return new Response("Stale request", { status: 401 });
      }
      const result = (await handle(ctx, payload)) ?? { ok: true };
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
      console.error(error);
      return new Response("Bad payload", { status: 400 });
    }
  });
}

const http = httpRouter();

http.route({
  path: "/n8n/notify",
  method: "POST",
  handler: signedRoute((ctx, p) =>
    ctx.runMutation(internal.notifications.record, {
      eventId: p.eventId as string,
      userId: p.recipientId as Id<"users">,
      loanId: p.loanId as Id<"loans">,
      kind: p.kind as NoteKind,
      message: p.message as string,
    }),
  ),
});

http.route({
  path: "/n8n/overdue",
  method: "POST",
  handler: signedRoute((ctx, p) => {
    if (typeof p.runDate !== "string" || !isIsoDate(p.runDate)) throw new Error("runDate must be YYYY-MM-DD");
    return ctx.runQuery(internal.loans.overdue, { today: p.runDate });
  }),
});

http.route({
  path: "/n8n/alert",
  method: "POST",
  handler: signedRoute((ctx, p) =>
    ctx.runMutation(internal.notifications.alertAdmins, { eventId: `alert:${p.executionId}`, message: p.message as string }),
  ),
});

export default http;
