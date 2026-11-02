import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubEnv("LENDLOOP_HMAC_SECRET", "test-secret");
  vi.stubEnv("N8N_WEBHOOK_URL", "https://n8n.test/webhook/lendloop-events");
  vi.stubGlobal("fetch", vi.fn(async (_url: string, _init?: RequestInit) => new Response("ok")));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
