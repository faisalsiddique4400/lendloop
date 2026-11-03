# LendLoop

Neighbors list tools, ask to borrow them for set dates, and get notices and reminders from n8n. Admins mark Trusted Lenders and remove listings.

Next.js 16, Clerk, Convex, n8n in Docker.

## Architecture

```
app ── Convex mutation ── n8n.send ──signed──> n8n "loan events" ──signed──> Convex /n8n/notify
n8n "overdue" (daily 09:00) ──signed──> Convex /n8n/overdue ──> /n8n/notify per late loan
n8n "errors" ──signed──> Convex /n8n/alert ──> admin inbox
```

Convex owns the data and every access check. n8n only formats and delivers messages.

## Security and data minimization

- Every public Convex function checks the caller first (`convex/lib/auth.ts`). Hidden buttons in the UI are only a convenience.
- Admin is granted from the CLI only (`users:makeAdmin`), never from the app.
- Both directions are signed with HMAC-SHA256 over the raw body. Requests older than 5 minutes are refused.
- The shared secret lives in a Convex env var and an n8n credential. The workflow JSON in `n8n/` has none.
- n8n gets ids, a tool name and dates. Never a name or an email.
- Signed-out visitors see free tool names only, no owners. A user's email is never shown to other users.
- Every notice has an `eventId`, so retries and reruns never send it twice.
- If n8n is down, Convex retries 3 times and then alerts admins. n8n failures alert admins too.

## Environment variables

| File or place | Name | Value |
|---|---|---|
| `.env.local` | `NEXT_PUBLIC_CONVEX_URL` | written by `npx convex dev` |
| `.env.local` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | from Clerk |
| Convex env | `CLERK_FRONTEND_API_URL` | Clerk Frontend API URL |
| Convex env | `LENDLOOP_HMAC_SECRET` | shared signing secret |
| Convex env | `N8N_WEBHOOK_URL` | `http://localhost:5678/webhook/lendloop-events` |
| `.env` | `TZ`, `N8N_ENCRYPTION_KEY`, `N8N_PUBLIC_URL` | for docker compose |

`.env.example` lists them all. Set Convex env vars with `npx convex env set NAME value`.

## Run it locally

1. `npm install`, then `npx convex dev` (keep it running).
2. In Clerk: create an app and activate the Convex integration. Under Sessions, Customize session token, add `{"name": "{{user.full_name}}", "email": "{{user.primary_email_address}}"}`. Put the keys in `.env.local` and set `CLERK_FRONTEND_API_URL` on Convex.
3. `npm run dev`, open http://localhost:3000 and sign in. Make yourself admin: `npx convex run users:makeAdmin '{"email":"you@example.com"}'`

### n8n

1. `cp .env.example .env`, set `N8N_ENCRYPTION_KEY` (`openssl rand -hex 32`) and `N8N_PUBLIC_URL=http://localhost:5678`.
2. `docker compose up -d n8n`, open http://localhost:5678 and create the owner account.
3. Pick a secret (`openssl rand -hex 32`). Set it on Convex as `LENDLOOP_HMAC_SECRET`, set `N8N_WEBHOOK_URL`, and add an n8n Crypto credential named `LendLoop HMAC` with the same secret.
4. Import and publish the workflows:
   ```bash
   docker compose cp n8n/. n8n:/tmp/wf
   docker compose exec n8n n8n import:workflow --separate --input=/tmp/wf
   docker compose exec n8n sh -c 'for id in lendloopErrors01 lendloopEvents01 lendloopOverdue1; do n8n publish:workflow --id=$id; done'
   docker compose restart n8n
   ```

n8n reaches local Convex at `http://host.docker.internal:3211`. With Convex cloud, use the `tunnel` service in `docker-compose.yml` and point the HTTP nodes at your `.convex.site` URL.

To see the error workflow, send a forged event. n8n answers 401 and the admin gets an alert:

```bash
curl -i -X POST http://localhost:5678/webhook/lendloop-events -H 'Content-Type: application/json' -H 'X-LendLoop-Signature: 00' --data '{"ts":1}'
```

## Tests

- `npm test`: 41 tests for access checks, loan rules, dates, signing, retries, idempotent notices and list filters.
- `scripts/smoke.sh`: checks the signed routes against a running deployment.
- `docs/test-cases.md`: manual cases with two users.

## For production

- n8n Cloud or a named tunnel instead of a quick tunnel.
- One secret per direction, rotated.
- Rate limits on `/n8n/*`.
- Separate Convex and Clerk production instances.
- Error tracking (Sentry) and an alert on `automation_failed`.
- Real email through Resend, with `eventId` as the idempotency key.
