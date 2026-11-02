# LendLoop stack research: Next.js + Clerk + Convex + n8n

Researched 2026-11-02 against primary sources (docs.convex.dev, clerk.com/docs, docs.n8n.io, official GitHub repos, npm registry). Where a doc disagreed with source code or another doc, that is called out. "Inference" marks a conclusion that the cited sources imply but don't state.

## 0. Current package versions (npm registry, 2026-11-02)

| Package | Latest | Note |
| --- | --- | --- |
| `convex` | 1.49.0 | https://registry.npmjs.org/convex/latest |
| `@clerk/nextjs` | 7.9.23 | https://registry.npmjs.org/@clerk/nextjs/latest |
| `@clerk/react` | 6.18.4 | Replaces `@clerk/clerk-react` (5.61.3, deprecated: "Please use @clerk/react instead"). https://registry.npmjs.org/@clerk/clerk-react |
| `next` | 16.4.3 | https://registry.npmjs.org/next/latest |
| `svix` | 2.9.1 | Only needed if you use the Clerk webhook. https://registry.npmjs.org/svix/latest |
| `n8n` | 2.45.7 | Pin the Docker tag to the same version. https://registry.npmjs.org/n8n/latest |
| `@convex-dev/action-retrier` | 0.3.1 | https://registry.npmjs.org/@convex-dev/action-retrier/latest |
| `@convex-dev/workpool` | 0.4.15 | https://registry.npmjs.org/@convex-dev/workpool/latest |

**Correction to prior knowledge:** `@clerk/clerk-react` is deprecated in favor of `@clerk/react` (Clerk Core 3). For Next.js, install only `@clerk/nextjs`. https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3

---

## 1. Clerk + Convex + Next.js App Router wiring

**Install:** `npm i convex @clerk/nextjs`. `ConvexProviderWithClerk` is imported from `convex/react-clerk`. https://docs.convex.dev/auth/clerk

**Native integration replaces the JWT template.** This changed from older setups.
- Clerk Dashboard → Convex integration page → "Activate Convex integration". Copy the Frontend API URL (dev: `https://verb-noun-00.clerk.accounts.dev`). https://clerk.com/docs/guides/development/integrations/databases/convex
- The activation maps the `aud` claim that Convex requires into the default session token, so you no longer need a separate JWT template. https://clerk.com/docs/guides/development/integrations/databases/convex
- The provider source supports both setups. If `sessionClaims.aud === "convex"`, it calls `getToken()` (native integration). Otherwise it falls back to `getToken({ template: "convex" })` (legacy JWT template). https://github.com/get-convex/convex-js/blob/main/src/react-clerk/ConvexProviderWithClerk.tsx
- **Doc conflict:** the Convex auth debugging page still says the Clerk JWT template must be named `convex`. That advice only applies to the legacy path. https://docs.convex.dev/auth/debug

**`convex/auth.config.ts`.** Clerk's doc shape:
```ts
import type { AuthConfig } from 'convex/server'
export default {
  providers: [
    { domain: process.env.CLERK_FRONTEND_API_URL!, applicationID: 'convex' },
  ],
} satisfies AuthConfig
```
https://clerk.com/docs/guides/development/integrations/databases/convex
- **Doc conflict (naming only):** Convex's page uses `CLERK_JWT_ISSUER_DOMAIN` for the same value. Pick one name and set it on the Convex deployment with `npx convex env set CLERK_FRONTEND_API_URL <url>`. https://docs.convex.dev/auth/clerk
- `applicationID: "convex"` must match the token's `aud`. https://docs.convex.dev/auth/clerk

**Next.js env:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CONVEX_URL`. https://docs.convex.dev/auth/clerk

**Client provider:** `components/ConvexClientProvider.tsx` is marked `'use client'`, creates a `ConvexReactClient`, and renders `<ConvexProviderWithClerk client={convex} useAuth={useAuth}>`, with `useAuth` from `@clerk/nextjs`. In `app/layout.tsx`, `<ClerkProvider>` must wrap `<ConvexClientProvider>`, not the other way round. https://docs.convex.dev/auth/clerk

**Middleware: `proxy.ts` on Next 16.** Clerk's docs name the file `proxy.ts` by default. Next.js 15 and earlier use `middleware.ts`, with identical contents. https://clerk.com/docs/reference/nextjs/clerk-middleware
```ts
import { clerkMiddleware } from '@clerk/nextjs/server'
export default clerkMiddleware()
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
```
https://clerk.com/docs/reference/nextjs/clerk-middleware
- Routes are public by default. https://docs.convex.dev/auth/clerk
- `createRouteMatcher()` is now marked **deprecated**. Clerk says to "protect access as close to the resource as possible". That fits LendLoop: enforce in Convex functions, not in the proxy. https://clerk.com/docs/reference/nextjs/clerk-middleware

**UI auth state:** Use Convex's `useConvexAuth()`, not Clerk's `useAuth()`. It confirms that the Convex backend has validated the token. Use `<Authenticated>`, `<Unauthenticated>` and `<AuthLoading>`; components that call authenticated queries must sit inside `<Authenticated>`. https://docs.convex.dev/auth/clerk

**Identity in functions:** `await ctx.auth.getUserIdentity()` returns `null` when the caller is unauthenticated. https://docs.convex.dev/auth/clerk
- It always includes `tokenIdentifier`, `subject` (the Clerk user ID) and `issuer`. With Clerk's native integration the default session token carries no `name` or `email`; add them under Sessions, Customize session token, and they are then returned as custom claims. https://docs.convex.dev/auth/functions-auth

**Server rendering (optional):** `preloadQuery` and `fetchQuery` come from `convex/nextjs`. Pass `{ token }`, where the token is `(await auth()).getToken()` from `@clerk/nextjs/server`. This is in beta. https://docs.convex.dev/client/nextjs/app-router/server-rendering

## 2. Users and roles: Convex `users` table vs Clerk `publicMetadata` claim

**What Convex recommends** (https://docs.convex.dev/auth/database-auth)
- **Option A, client mutation:** after login, the app calls a mutation that copies `ctx.auth` data into `users`. It can only store what's in the JWT. The docs call it simpler.
- **Option B, Clerk webhook to a Convex HTTP action:** this is the only option that can store data that isn't in the JWT, or keep other users' records current without them logging in. The docs recommend it when you need either of those.
- Webhook details: Clerk calls the `.convex.site` URL at `/clerk-users-webhook` and filters to `user` events (`user.created`, `user.updated`, `user.deleted`). The handler verifies with `svix` (`new Webhook(CLERK_WEBHOOK_SECRET).verify(...)`) and returns 400 on failure, then calls `internal.users.upsertFromClerk` or `internal.users.deleteFromClerk`. The schema is `users` with `externalId` (= `identity.subject`) and index `byExternalId`. A `getCurrentUser(ctx)` helper looks the user up by `identity.subject`.

**Clerk `publicMetadata` as a role claim** (https://clerk.com/docs/guides/secure/basic-rbac)
- Store `{"role":"admin"}` in **public** metadata, which is readable in the browser but not writable there.
- Expose it by adding `{"metadata": "{{user.public_metadata}}"}` under Sessions → Customize session token.
- To assign: Dashboard → Users → user → User metadata → Public → Edit. Or in code, call `clerkClient.users.updateUserMetadata(userId, { publicMetadata: { role } })`.
- Type it with `CustomJwtSessionClaims` in `types/globals.d.ts`.
- Limits: custom claims are capped at **1.2KB**, and the token refreshes every 60 s, so a role change can take up to a minute to show. https://clerk.com/docs/guides/sessions/customize-session-tokens
- Because the native integration now reuses the session token (section 1), these claims would reach `ctx.auth.getUserIdentity()`. Inference, from the provider source plus the statement that custom claims are returned: https://docs.convex.dev/auth/functions-auth
- Uncertain: Convex's docs show nested claims for custom JWT as dotted keys (`identity["properties.email"]`). They don't say how a nested `metadata.role` from Clerk appears, so test it before relying on it. https://docs.convex.dev/auth/functions-auth

**Implied choice for LendLoop:** keep `role` and `trustedLender` in the Convex `users` table and treat it as the authority.
- RBAC is checked inside Convex functions against data Convex owns. There is no claim-shape ambiguity and no 60 s lag.
- The admin's "mark Trusted Lender" action is a normal Convex mutation.
- Bootstrap the first admin with an internal mutation run from the CLI or dashboard (`npx convex run`). Never expose a public "make me admin" mutation.
- Use Option A (store-user mutation, keyed on `subject`) unless you need the webhook. It already captures `email` for notifications.
- Convex's own best practices back this up: "Public functions can be called by anyone", so check auth in every public function and never authorize from spoofable arguments such as an email. https://docs.convex.dev/understanding/best-practices/

## 3. Convex HTTP actions and HMAC

**Shape:** `convex/http.ts` default-exports `httpRouter()`. Register routes with `http.route({ path, method, handler: httpAction(async (ctx, request) => Response) })`. https://docs.convex.dev/functions/http-actions
- The URL is `https://<deployment>.convex.site`, **not** `.convex.cloud`. The system env var `CONVEX_SITE_URL` holds it. https://docs.convex.dev/functions/http-actions, https://docs.convex.dev/production/environment-variables
- **Raw body:** `request.text()` or `request.arrayBuffer()`; `.json()` and `.blob()` also exist. Read the body **once**, as text, verify the HMAC, then `JSON.parse`. https://docs.convex.dev/functions/http-actions
- **Status codes:** return `new Response(body, { status: 401 })` and so on, as with the standard Fetch `Response`. https://docs.convex.dev/functions/http-actions
- HTTP actions can call `ctx.runQuery`, `ctx.runMutation` and `ctx.runAction`. https://docs.convex.dev/functions/http-actions
- They are **not retried automatically**; the caller (n8n) owns retries. https://docs.convex.dev/functions/http-actions
- Limits: 64 MiB memory, 100 MiB response. https://docs.convex.dev/functions/http-actions

**Web Crypto works in the default runtime, so no `"use node"` is needed.**
- The default Convex runtime lists `crypto`, `CryptoKey`, `SubtleCrypto`, `TextEncoder`, `TextDecoder`, `atob`, `btoa` and `fetch` (fetch in actions only). https://docs.convex.dev/functions/runtimes
- HTTP actions run in that same runtime, with no Node APIs. https://docs.convex.dev/functions/http-actions
- Web Crypto has no `timingSafeEqual`. Instead, import the key with `crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign","verify"])` and verify with `crypto.subtle.verify("HMAC", key, sigBytes, bodyBytes)`. That avoids a hand-written string compare. https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify
- Node's `crypto.timingSafeEqual` would need `"use node"`. That is allowed only in action files, which can't hold queries or mutations, and an HTTP action can't be one. You'd have to hop through `ctx.runAction`, which isn't worth it. https://docs.convex.dev/functions/runtimes

## 4. Calling n8n from Convex

- `fetch` is available "in Actions only", so queries and mutations can't call it. https://docs.convex.dev/functions/runtimes
- Mutations "cannot call third party APIs". https://docs.convex.dev/functions/mutation-functions
- **Recommended pattern:** the client calls a mutation, which writes the intent and then calls `ctx.scheduler.runAfter(0, internal.x, args)`. Calling actions directly from the client is "an anti-pattern". https://docs.convex.dev/functions/actions
- Scheduling from a mutation is **atomic**: if the mutation fails, nothing is scheduled. https://docs.convex.dev/scheduling/scheduled-functions
- **Guarantees:** scheduled mutations run exactly once. Scheduled **actions run at most once and are not retried**, so a transient error becomes a permanent failure. https://docs.convex.dev/scheduling/scheduled-functions
- You can inspect outcomes in the `_scheduled_functions` system table (state is Pending, InProgress, Success, Failed or Canceled). Results are kept for 7 days. https://docs.convex.dev/scheduling/scheduled-functions
- **Auth does not propagate** to scheduled functions, so pass the IDs you need as arguments. https://docs.convex.dev/scheduling/scheduled-functions
- Only schedule and `ctx.run*` `internal.*` functions, and `await` every promise. Otherwise `runAfter` can silently not schedule. https://docs.convex.dev/understanding/best-practices/
- Actions time out after 10 minutes. Memory is 64 MB in the Convex runtime and 512 MB in Node. https://docs.convex.dev/functions/actions

**Retries:**
- **Action Retrier** component: `retrier.run(ctx, internal.mod.action, args)` retries with exponential backoff (defaults: `initialBackoffMs` 250, `base` 2, `maxFailures` 4) and supports an `onComplete` mutation callback. https://github.com/get-convex/action-retrier
- **Workpool** component: queues with retries and parallelism limits. https://docs.convex.dev/functions/actions
- **Do it yourself** (the docs' suggestion): a mutation checks whether the outcome happened and reschedules the action if not. https://docs.convex.dev/scheduling/scheduled-functions
- Use Action Retrier with `onComplete` to write the delivery status (`sent` or `failed`) onto the request or notification row. Inference.

## 5. Can cloud Convex reach n8n on localhost?

- **No.** A cloud deployment can't reach your machine's `localhost`. Convex's own guidance for local-to-cloud traffic is "Set up a proxy like ngrok or use a cloud deployment". https://docs.convex.dev/cli/local-deployments
- AI Town (a Convex starter) documents the same fix: tunnel the local service, then `npx convex env set` the tunnel URL. https://github.com/a16z-infra/ai-town
- The other direction works without a tunnel: n8n reaching Convex `https://<dep>.convex.site` is just public HTTPS. https://docs.convex.dev/functions/http-actions

**Options**
1. **Cloudflare Quick Tunnel:** `cloudflared tunnel --url http://localhost:5678`. It needs no account and gives a `*.trycloudflare.com` URL that **changes every time you start it**. It allows at most 200 in-flight requests, has no uptime guarantee, and is for testing only. https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
   - Set n8n's public base URL to the tunnel URL with `N8N_WEBHOOK_URL`, and `N8N_PROXY_HOPS=1`. https://github.com/n8n-io/n8n-docs/blob/main/docs/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/endpoints.md
2. **n8n's own tunnel:**
   - **Correction to prior knowledge:** the docs no longer document `n8n start --tunnel`, and `packages/cli/src/commands/start.ts` no longer references a tunnel. https://github.com/n8n-io/n8n/blob/master/packages/cli/src/commands/start.ts
   - The current "tunnel" is a cloudflared container driven by the n8n source repo (`pnpm stack --tunnel`). It's useless for a plain Docker install. https://docs.n8n.io/deploy/host-n8n/install-options/install-with-docker
3. **n8n Cloud:** a public HTTPS URL out of the box, so no tunnel is needed. The Code node there already provides the `crypto` module. https://docs.n8n.io/code/code-node/
4. **Convex local deployment:**
   - It exists and is in **beta**. It runs as a subprocess of `npx convex dev`; switch with `npx convex deployment select local` and back with `npx convex deployment select dev`. No account is needed. https://docs.convex.dev/cli/local-deployments
   - Node actions "run directly on your computer", while Convex-runtime functions run in isolated environments. https://docs.convex.dev/cli/local-deployments
   - The docs **don't confirm** that a default-runtime action can `fetch("http://localhost:5678")`. Inference: likely, since the backend is a local process, but verify it. A `"use node"` action is the safer bet for reaching localhost.
   - The self-hosted backend listens on `127.0.0.1:3210`, with HTTP actions on `3211`. The local deployment page doesn't list ports, so read them from the CLI output. https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md
   - From the n8n container, reach the host with `http://host.docker.internal:<port>` (the pattern AI Town uses for Docker to host). https://github.com/a16z-infra/ai-town
   - Downsides: no public URL, and logs are cleared on restart. https://docs.convex.dev/cli/local-deployments

**Recommendation (inference):** cloud Convex dev deployment plus n8n in Docker plus a cloudflared quick tunnel, with the tunnel URL in a Convex env var (`N8N_WEBHOOK_URL`). Or use n8n Cloud and skip the tunnel entirely.

## 6. n8n specifics

**Product changes in n8n 2.x** (https://docs.n8n.io/2-0-breaking-changes/)
- Workflows are **published**, not activated. The publish/unpublish system replaces the active toggle.
- Task runners are on by default, and Code nodes run in them. External mode needs the separate `n8nio/runners` image.
- **`N8N_BLOCK_ENV_ACCESS_IN_NODE` now defaults to `true`.** `$env` is blocked in expressions and Code nodes unless you set it to `false`, and n8n advises moving secrets into credentials.
  - **Doc conflict:** the env-var reference page still lists the default as `false`. https://github.com/n8n-io/n8n-docs/blob/main/docs/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/security.md
  - The source is authoritative: env access is blocked unless the value is the string `'false'`. https://github.com/n8n-io/n8n/blob/master/packages/workflow/src/workflow-data-proxy-env-provider.ts
- `ExecuteCommand` and `LocalFileTrigger` are disabled by default.
- The Start node has been removed.

**Webhook node** (https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- Authentication: None, Basic, **Header Auth**, JWT, n8n User Auth. Header Auth adds a cheap shared-secret gate before the HMAC check.
- **Test URL vs Production URL:**
  - The test URL listens for only 120 s after "Listen for test event".
  - The production URL works only once the workflow is **published**, and its executions show in the Executions tab, not the editor. https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/
- Respond modes: Immediately, When Last Node Finishes, Using 'Respond to Webhook' Node, Streaming.
- Options: Raw Body, IP(s) Allowlist, Response Headers, and others.
- Payload limit: 16 MiB by default (`N8N_PAYLOAD_SIZE_MAX`).
- **Raw Body:** when on, the node outputs the parsed `json.body` **and** `binary.data` containing the raw bytes (base64-encoded internally). https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Webhook/Webhook.node.ts
  - In a Code node, read it with `await this.helpers.getBinaryDataBuffer(itemIndex, 'data')`, not via `binary.data.data`. https://docs.n8n.io/code/cookbook/code-node/get-binary-data-buffer/

**Crypto node, HMAC** (https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.crypto/)
- Actions: Hash, Hmac, Sign, Generate, Encrypt, Decrypt.
- Hmac parameters: Type (`SHA256` and others), Value **or** Binary File + Binary Property Name, Property Name, Encoding (`HEX`/`BASE64`).
- **The secret comes from a "Crypto" credential (`hmacSecret`), not a parameter.** This keeps it out of exported JSON. https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Crypto/v2/CryptoV2.node.ts
- **Verify inbound:** Webhook (Raw Body) → Crypto Hmac (Binary File = `data`) → compare with the signature header. Do the compare in a Code node with `crypto.timingSafeEqual`, so the Code node never needs the secret, or in an IF node if you accept a non-constant-time compare. Inference.
- **Sign outbound:** a Crypto Hmac on the exact string you'll send → HTTP Request with **Body Content Type = Raw** and that same string. https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/

**Code node modules**
- Self-hosted: `require` of built-ins is off by default. Enable it with `NODE_FUNCTION_ALLOW_BUILTIN=crypto`. With task runners, "add the environment variables to the Task Runners" instead of the main node. https://docs.n8n.io/hosting/configuration/configuration-examples/modules-in-code-node/
- n8n Cloud provides `crypto` (and `moment`) without configuration. https://docs.n8n.io/code/code-node/
- Code nodes can't read credentials, and `$secrets` isn't available in them. https://docs.n8n.io/code/builtin/n8n-metadata/

**Schedule Trigger** (https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/)
- Intervals: Days (with hour and minute) or Custom (Cron), for example `0 9 * * *`.
- Uses the workflow timezone, otherwise the instance timezone (`GENERIC_TIMEZONE`; the self-hosted default is America/New York).
- **The workflow must be published.** Cron values are evaluated at publish time.
- Missed runs: "Don't Run Missed Executions" is the default. The durable scheduler is on by default from 2.45.0.

**Retry On Fail** (a per-node setting) https://docs.n8n.io/workflows/components/nodes/
- Max Tries defaults to 3, with a range of **2–5**. Wait Between Tries defaults to 1000 ms, with a range of **0–5000 ms**. n8n clamps both at runtime. https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/features/ndv/shared/ndv.utils.ts, https://github.com/n8n-io/n8n/blob/master/packages/core/src/execution-engine/workflow-execute.ts
- On Error: Stop Workflow (the default), Continue, or Continue (using error output).

**HTTP Request node** (https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
- Bodies: JSON, Form URLencoded, Form-Data, **Raw**, n8n Binary File.
- Auth: Generic credentials, including **Header Auth**.
- Options: **Batching** (Items per Batch, Batch Interval ms), Timeout, Response → Never Error / Include Response Headers and Status, Pagination, Proxy.
- Retry isn't an HTTP option. It's the node-level Retry On Fail setting above.

**Error handling** (https://docs.n8n.io/flow-logic/error-handling/)
- The error workflow must start with an **Error Trigger**. Select it in each workflow under Settings → **Error workflow**. One error workflow can serve many workflows.
- Its payload includes `execution.id`, `execution.url`, `execution.error.message`, `execution.lastNodeExecuted` and `workflow.name`. A failing trigger produces a `trigger{}` variant instead.
- Use **Stop And Error** to force a failure, for example on a bad signature, so the error workflow fires.
- The error workflow **doesn't need to be published**. It **only runs when an automatic (production) execution fails**, so you can't test it with manual runs. https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.errortrigger/

**Exported JSON and credentials** (https://docs.n8n.io/workflows/export-import/)
- Exports contain credential **names and IDs**, not the secret values. Credential values are encrypted with the instance's `N8N_ENCRYPTION_KEY`. https://docs.n8n.io/hosting/configuration/configuration-examples/encryption-key/
- **Warning:** HTTP Request nodes "may contain authentication headers when imported from cURL". Literal header values typed into a node **are** exported, so always use credentials for secrets.

## 7. Minimal n8n Docker setup

- **Image:** `docker.n8n.io/n8nio/n8n`, the name used by the README and n8n-hosting. Some doc pages use `n8nio/n8n`. https://github.com/n8n-io/n8n/blob/master/README.md
- **Data:** volume `n8n_data:/home/node/.n8n`, which holds the SQLite DB and the encryption key. Port `5678`. https://docs.n8n.io/deploy/host-n8n/install-options/install-with-docker
- **Env:**
  - `GENERIC_TIMEZONE` sets the timezone for schedule nodes; `TZ` sets the system timezone. Also set `N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true`. https://docs.n8n.io/deploy/host-n8n/install-options/install-with-docker
  - `N8N_RUNNERS_ENABLED` is deprecated from 2.0, so don't set it. https://docs.n8n.io/deploy/host-n8n/install-options/install-with-docker
  - `N8N_ENCRYPTION_KEY` is a random key generated by default and stored in `~/.n8n`. Set it explicitly so the volume and credentials stay portable. https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/deployment
  - **`N8N_WEBHOOK_URL`** replaces **`WEBHOOK_URL`**, which is deprecated and logs a warning. https://github.com/n8n-io/n8n/blob/master/packages/cli/src/deprecation/deprecation.service.ts
    - **Doc conflict on the version:** one page says it's available from 2.30.0 (https://docs.n8n.io/hosting/installation/server-setups/docker-compose/), another says `WEBHOOK_URL` is deprecated from 2.35.0 (https://github.com/n8n-io/n8n-docs/blob/main/docs/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/endpoints.md). On 2.45 either name works.
- **Reference compose:** the official one uses Postgres plus an external `n8nio/runners:${N8N_VERSION}` sidecar (`N8N_RUNNERS_MODE=external`, `N8N_RUNNERS_AUTH_TOKEN`). https://github.com/n8n-io/n8n-hosting/blob/main/docker-compose/withPostgres/docker-compose.yml

**Minimal compose for the take-home.** I assembled this from the docs above; it is not a verbatim official file:
```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:2.45.7
    restart: unless-stopped
    ports: ["5678:5678"]
    environment:
      - GENERIC_TIMEZONE=${TZ}
      - TZ=${TZ}
      - N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - N8N_WEBHOOK_URL=${N8N_PUBLIC_URL}   # tunnel URL
      - N8N_PROXY_HOPS=1
      - NODE_FUNCTION_ALLOW_BUILTIN=crypto  # internal runner mode; for an external runner, set it on the runner
    volumes: ["n8n_data:/home/node/.n8n"]
volumes:
  n8n_data:
```
Commit an `.env.example` and keep the real `.env` out of git.

## 8. Idempotency in Convex

- Mutations are transactions. Reads see a consistent snapshot, and writes commit together or not at all. https://docs.convex.dev/functions/mutation-functions
- OCC "provides true serializability". On a conflict Convex re-runs the mutation automatically. https://docs.convex.dev/database/advanced/occ
- Convex internally retries a conflicting mutation several times before surfacing an error. https://docs.convex.dev/error
- **The read set records the *index range scanned*, not just the documents returned**, and a commit fails if a concurrent write overlaps it. "Developers don't have to worry about race conditions." https://stack.convex.dev/how-convex-works
- **So a check-then-insert in one mutation is race-safe** when the check is an indexed lookup. A concurrent insert into the scanned (empty) range conflicts, and on re-run the mutation sees the row. This is an inference from range-based read sets; no doc states the empty-range case literally.
- **Convex has no native unique constraint.** The documented pattern is an index on the key plus a lookup before writing. https://stack.convex.dev/ents
- Use `.unique()`, which returns null for zero rows and **throws** for more than one, so it doubles as an invariant check. https://docs.convex.dev/database/reading-data/
- **For reminder write-back:** the table holds `reminders { loanId, reminderKey, status, sentAt }`, with `.index("by_key", ["reminderKey"])` and `reminderKey = loanId + ":" + YYYY-MM-DD`. Inside the mutation, query `withIndex("by_key", q => q.eq("reminderKey", k)).unique()`. If the row exists, return it or patch the status; otherwise insert. The HTTP action verifies the HMAC and then calls this internal mutation, so a retry is a no-op. Inference.
- Keep the scanned range narrow (an indexed equality) so you don't conflict with unrelated writes. https://docs.convex.dev/error

## 9. Free email option

- **Resend over HTTP Request** (no dedicated n8n Resend node docs page exists; the URL 404s):
  - `POST https://api.resend.com/emails` with `Authorization: Bearer re_…` (store this in a Header Auth credential).
  - Required body fields: `from`, `to`, `subject`.
  - It supports an **`Idempotency-Key`** header (≤256 chars, 24 h window), so pass the Convex event or reminder key to make n8n retries safe end to end.
  - https://resend.com/docs/api-reference/emails/send-email
- **Free plan:** 3,000 emails/month, 100/day. https://resend.com/pricing
- **SMTP alternative:** the n8n **Send Email** node uses an SMTP credential. https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.sendemail
- **For the task:** a logged mock (a Code node or a No-Op node that records the would-be email) is acceptable. Keep the Resend branch behind an IF on a flag.

---

## Gotchas

1. **The Clerk JWT template is legacy.** Activate the native Convex integration in Clerk; `ConvexProviderWithClerk` auto-detects it through `aud === "convex"`. Convex's debug page still talks about the `convex` template.
2. **Two env-var names for the same Clerk URL:** `CLERK_JWT_ISSUER_DOMAIN` in Convex docs and `CLERK_FRONTEND_API_URL` in Clerk docs. The name must match `auth.config.ts`, and the variable must be set on **every** Convex deployment (dev and prod separately).
3. **Next 16 uses `proxy.ts`, not `middleware.ts`.** `createRouteMatcher` is deprecated, so don't build RBAC there.
4. **`<ClerkProvider>` must wrap `ConvexClientProvider`.** Queries that need auth must render inside `<Authenticated>`, or they run with a null identity on first load.
5. **Use `.convex.site` for HTTP actions, not `.convex.cloud`.**
6. **Read the body once, as text.** HMAC the exact bytes; never re-`JSON.stringify` a parsed body before verifying or signing. On the n8n side, send with **Raw** body, not JSON, so the signed string is byte-identical.
7. **Include a timestamp in the signed payload** (for example `t.body`, or an `X-Timestamp` header that is part of the HMAC input) and reject stale requests. HMAC alone doesn't stop replays. This is standard practice, not from the docs.
8. **Scheduled actions are at-most-once.** Without the Action Retrier or Workpool, a single network blip loses the notification silently. Record delivery status in Convex.
9. **Auth doesn't flow into scheduled functions.** Pass user and loan IDs explicitly.
10. **Cloud Convex can't reach `localhost:5678`.** You need a tunnel or n8n Cloud. A cloudflared quick-tunnel URL changes on every restart, so update both the Convex env var and `N8N_WEBHOOK_URL`.
11. **`n8n start --tunnel` is gone.** Don't plan on it.
12. **n8n 2.x blocks `$env` by default**, and the env-var reference page still says otherwise. Put secrets in **credentials** (Crypto credential for HMAC, Header Auth for API keys) rather than flipping `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, which would expose the whole process env to every Code node.
13. **Code nodes can't read credentials.** Compute the HMAC with the Crypto node, then compare in Code (`crypto.timingSafeEqual`, which needs `NODE_FUNCTION_ALLOW_BUILTIN=crypto` on self-hosted, set on the runner in external mode).
14. **Webhook test vs production URLs differ.** Convex must hold the **production** URL, and the workflow must be **published**, as must the Schedule workflow.
15. **Error workflows never fire for manual or test runs.** To demo one, trigger a failure through the published production webhook or schedule.
16. **Retry On Fail is capped at 5 tries and 5 s between them.** For longer outages, rely on the Convex-side retrier for workflow 1 and on the next daily run plus idempotent write-back for workflow 2.
17. **Respond mode matters.** "Immediately" returns 200 before the notification is sent, so Convex can't see downstream failures. Use "When Last Node Finishes" or a Respond to Webhook node after the signature check (401 on a bad signature), and let n8n's error workflow cover delivery failures.
18. **Exported workflow JSON leaks literal header values** (for example from a cURL import) but not credential secrets. Grep the export for secrets before committing it.
19. **Set `N8N_ENCRYPTION_KEY` explicitly.** Otherwise credentials are tied to the auto-generated key inside the volume.
20. **The `Date.now()` value is frozen for the whole Convex function run.** Compute "overdue" against it in a query, which is fine. Pass n8n's run date explicitly if reminder keys must be deterministic. https://docs.convex.dev/functions/runtimes
21. **Convex local deployments are beta**, and fetching localhost from a default-runtime action is undocumented. Verify it before betting the demo on it.
