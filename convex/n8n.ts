import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { eventFields } from "./lib/events";
import { sign } from "./lib/hmac";

const BACKOFF_MS = [2_000, 8_000, 30_000];
const TIMEOUT_MS = 30_000;

export const send = internalAction({
  args: { ...eventFields, attempt: v.number() },
  handler: async (ctx, { attempt, ...event }) => {
    const url = process.env.N8N_WEBHOOK_URL;
    const secret = process.env.LENDLOOP_HMAC_SECRET;
    if (!url || !secret) {
      await ctx.runMutation(internal.notifications.alertAdmins, {
        eventId: `config:${event.eventId}`,
        message: "LendLoop can't reach n8n: set N8N_WEBHOOK_URL and LENDLOOP_HMAC_SECRET on the Convex deployment.",
      });
      return;
    }

    const body = JSON.stringify({ ts: Date.now(), ...event });
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-LendLoop-Signature": await sign(secret, body) },
        body,
        signal: abort.signal,
      });
      if (response.status >= 400 && response.status < 500) {
        await ctx.runMutation(internal.notifications.alertAdmins, {
          eventId: `refused:${event.eventId}`,
          message: `n8n refused the notice for the ${event.toolName.toLowerCase()} (status ${response.status}). Check that both sides use the same signing secret.`,
        });
        return;
      }
      if (!response.ok) throw new Error(`n8n answered ${response.status}`);
    } catch (error) {
      if (attempt < BACKOFF_MS.length) {
        await ctx.scheduler.runAfter(BACKOFF_MS[attempt], internal.n8n.send, { ...event, attempt: attempt + 1 });
        return;
      }
      console.error(`n8n.send gave up on ${event.eventId}`, error);
      await ctx.runMutation(internal.notifications.alertAdmins, {
        eventId: `failed:${event.eventId}`,
        message: `Couldn't send the notice for the ${event.toolName.toLowerCase()} after ${BACKOFF_MS.length + 1} tries. Check that n8n is running.`,
      });
    } finally {
      clearTimeout(timer);
    }
  },
});
