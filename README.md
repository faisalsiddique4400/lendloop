# LendLoop

A tool-lending board for one neighborhood. Neighbors list tools, ask to borrow them for set dates, and get notices when something changes. An admin can mark Trusted Lenders and clean up listings.

Built for the Fluence Full-Stack Developer take-home.

## Stack

- Next.js 16 (App Router) and one plain stylesheet
- Clerk for sign-in, using Clerk's native Convex integration
- Convex for data, access checks and HTTP routes
- n8n 2.45 in Docker for notifications and the daily overdue run

## How it fits together

```
browser ──Clerk JWT──> Convex mutation ──schedules──> n8n.send (retries 2s, 8s, 30s)
                                                          │ signed POST
                                                          v
                         Convex /n8n/notify <──signed── n8n "loan events"
n8n "overdue" (daily 09:00) ──signed──> Convex /n8n/overdue, then /n8n/notify per loan
n8n "errors" ──signed──> Convex /n8n/alert ──> admins' inbox
```

- Every public Convex function checks the caller first (`convex/lib/auth.ts`). The UI hides buttons for convenience only.
- Both directions are signed: `X-LendLoop-Signature` is HMAC-SHA256 of the raw body. The body carries `ts`, and anything older than 5 minutes is refused.
- Inbox writes are idempotent on `eventId`, so n8n retries and reruns never duplicate a notice.
- No names or emails leave Convex. n8n sees ids, a tool name and dates.

## Run it locally

1. `npm install`
2. Convex: `npx convex dev` (log in, create a project). Leave it running.
3. Clerk: create an app, activate the Convex integration, and copy the keys into `.env.local` (see `.env.example`). Then `npx convex env set CLERK_FRONTEND_API_URL <frontend api url>`.
   In Clerk, go to Sessions, Customize session token, and add `{"name": "{{user.full_name}}", "email": "{{user.primary_email_address}}"}`. The default token has no name or email, so neighbors would show as "Neighbor" and `makeAdmin` could not find you.
4. `npm run dev` and open http://localhost:3000. Sign in once, then make yourself admin:
   `npx convex run users:makeAdmin '{"email":"you@example.com"}'`

### n8n

1. `cp .env.example .env`, then set `N8N_ENCRYPTION_KEY` (`openssl rand -hex 32`).
2. `docker compose up -d tunnel`, then read the tunnel URL: `docker compose logs tunnel | grep trycloudflare`.
3. Put it in `.env` as `N8N_PUBLIC_URL`, then `docker compose up -d n8n`.
4. Pick a secret and set it on Convex: `npx convex env set LENDLOOP_HMAC_SECRET <secret>` and `npx convex env set N8N_WEBHOOK_URL <N8N_PUBLIC_URL>/webhook/lendloop-events`.
5. In n8n (http://localhost:5678) create a Crypto credential named `LendLoop HMAC` with the same secret.
6. Import the three files in `n8n/`. In each HTTP Request node, replace the Convex site URL with yours. Publish "LendLoop loan events" and "LendLoop overdue reminders". Set "LendLoop errors" as the error workflow on both.

The quick-tunnel URL changes on every restart. Repeat steps 2 to 4 when it does.

### Demo the error workflow

n8n only runs error workflows for production runs. Send a forged event to the live webhook:

```bash
curl -i -X POST "$N8N_PUBLIC_URL/webhook/lendloop-events" -H 'Content-Type: application/json' -H 'X-LendLoop-Signature: 00' --data '{"ts":1}'
```

The run fails on purpose and the admin sees the alert in the Inbox and on the Admin page.

## Tests

- `npm test` runs the Convex tests (auth guards, loan rules, date overlap, once-a-day reminders, idempotent notices, HMAC good, bad and stale, retries) and the browse filter.
- `scripts/smoke.sh` checks the signed routes against a real deployment.

### Manual check

1. Sign in as two users in two browser profiles.
2. User B requests user A's tool. A sees it in Requests and Inbox without a reload.
3. A approves. B's Inbox shows the approval.
4. In the Convex dashboard, set that loan's `endDate` to yesterday. Run "LendLoop overdue reminders" in n8n twice. B gets one reminder.

## For production

- Use a named Cloudflare tunnel or n8n Cloud instead of a quick tunnel.
- Use one secret per direction and rotate them.
- Rate-limit the `/n8n/*` routes.
- Give production its own Convex deployment and Clerk instance.
- Add Sentry to the app and alert on `automation_failed` notices.
- Real email: an HTTP Request node to Resend with the `eventId` as the `Idempotency-Key`.
