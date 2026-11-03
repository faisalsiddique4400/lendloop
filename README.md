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

## Decisions and tradeoffs

- **n8n writes to an in-app inbox, not email.** It keeps the demo free of mail accounts and keeps names and emails inside Convex. Adding email is one node (see For production).
- **Convex sends events from the same transaction that changes the loan.** If the change commits, the event is queued; if it fails, nothing is sent.
- **n8n answers only after the notice is saved.** If delivery fails, Convex sees the failure and retries the whole path.
- **Overdue and available are worked out from the dates, never stored,** so they can't drift out of date.
- **Out of scope:** borrower cancel, pickup details between neighbors, image uploads.

## Security and data minimization

- Every public Convex function checks the caller first (`convex/lib/auth.ts`). Hidden buttons in the UI are only a convenience.
- Admin is granted from the CLI only (`users:makeAdmin`), never from the app.
- Both directions are signed with HMAC-SHA256 over the raw body. Requests older than 5 minutes are refused.
- The shared secret lives in a Convex env var and an n8n credential. The workflow JSON in `n8n/` has none.
- n8n gets ids, a tool name and dates. Never a name or an email.
- n8n can only notify someone who is the owner or borrower on that loan, even with the secret.
- Signed-out visitors see tool names and categories only: no owners, no ids. A user's email is never shown to other users.
- A borrower can have one pending request per tool, so nobody can spam an owner.
- Every notice has an `eventId`, so retries and reruns never send it twice.
- If n8n is down, Convex retries 3 times and then alerts admins. If n8n refuses a request (for example a wrong secret), Convex alerts at once instead of retrying.
- Forged requests get a 401 and nothing else runs, so they can't flood the admin inbox.
- n8n listens on 127.0.0.1 only.

## Environment variables

| Where | Name | Value |
|---|---|---|
| `.env.local` | `NEXT_PUBLIC_CONVEX_URL` | written by `npx convex dev` |
| `.env.local` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk, API keys page |
| Convex env | `CLERK_FRONTEND_API_URL` | Clerk Frontend API URL |
| Convex env | `LENDLOOP_HMAC_SECRET` | the shared signing secret |
| Convex env | `N8N_WEBHOOK_URL` | `http://localhost:5678/webhook/lendloop-events` |
| `.env` | `N8N_TZ`, `N8N_ENCRYPTION_KEY`, `N8N_PUBLIC_URL`, `LENDLOOP_HMAC_SECRET` | read by docker compose and the setup commands below |

`.env.example` shows every name. Convex env vars are set with `npx convex env set NAME value`.

## Run it locally

Everything runs on your machine: Convex runs locally, n8n runs in Docker, and they reach each other directly. You need Node 20+, Docker Desktop and a free Clerk account. No Convex account and no tunnel.

### 1. App and Convex

```bash
npm install
npx convex dev
```

When `convex dev` asks how to start, choose to run Convex **locally without an account**. Leave it running. It writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local` and serves the app's HTTP routes on port 3211.

### 2. Clerk

1. Create an application with email sign-in.
2. Configure, Integrations, **Convex**: click Activate. Copy the **Frontend API URL**.
3. Configure, Sessions, **Customize session token**: make the claims
   ```json
   { "aud": "convex", "name": "{{user.full_name}}", "email": "{{user.primary_email_address}}" }
   ```
   Without `name` and `email` the app can't show names or find you to make you admin.
4. Configure, API keys: copy both keys into `.env.local`.
5. Tell Convex where Clerk is:
   ```bash
   npx convex env set CLERK_FRONTEND_API_URL https://<your-app>.clerk.accounts.dev
   ```

### 3. First sign-in

```bash
npm run dev
```

Open http://localhost:3000, sign in, then click **Open LendLoop**. Your account is saved on that first visit. Make yourself admin:

```bash
npx convex run users:makeAdmin '{"email":"you@example.com"}'
```

### 4. n8n

1. Create `.env` from the example and fill it in:
   ```bash
   cp .env.example .env
   ```
   Set `N8N_ENCRYPTION_KEY` and `LENDLOOP_HMAC_SECRET` to two different values from `openssl rand -hex 32`. Keep `N8N_PUBLIC_URL=http://localhost:5678`.
2. Start n8n, then open http://localhost:5678 and create the owner account:
   ```bash
   docker compose up -d n8n
   ```
3. Give the secret to Convex and point Convex at n8n:
   ```bash
   source .env
   npx convex env set LENDLOOP_HMAC_SECRET "$LENDLOOP_HMAC_SECRET"
   npx convex env set N8N_WEBHOOK_URL http://localhost:5678/webhook/lendloop-events
   ```
4. Give the same secret to n8n. This creates the `LendLoop HMAC` credential with the id the workflows expect:
   ```bash
   printf '[{"id":"lendloopHmac0001","name":"LendLoop HMAC","type":"crypto","data":{"hmacSecret":"%s"}}]' "$LENDLOOP_HMAC_SECRET" \
     | docker compose exec -T n8n sh -c 'cat > /tmp/cred.json && n8n import:credentials --input=/tmp/cred.json; rm -f /tmp/cred.json'
   ```
5. Import and publish the three workflows, then restart n8n so it picks them up:
   ```bash
   docker compose cp n8n/. n8n:/tmp/wf
   docker compose exec n8n n8n import:workflow --separate --input=/tmp/wf
   docker compose exec n8n sh -c 'for id in lendloopErrors01 lendloopEvents01 lendloopOverdue1; do n8n publish:workflow --id=$id; done'
   docker compose restart n8n
   ```
6. Check the wiring. Every line should start with `ok`:
   ```bash
   CONVEX_SITE_URL=http://127.0.0.1:3211 LENDLOOP_HMAC_SECRET="$LENDLOOP_HMAC_SECRET" scripts/smoke.sh
   ```

The workflows call Convex at `http://host.docker.internal:3211`. The overdue run fires daily at 09:00 in `N8N_TZ`. Don't name it `TZ`: `npx convex dev` also reads `.env`, and a `TZ` there stops the local Convex backend from starting.

### Next time

Start the three parts again, each in its own terminal:

```bash
npx convex dev
npm run dev
docker compose up -d n8n
```

### Forged requests

A request without a valid signature gets a 401 and stops there:

```bash
curl -i -X POST http://localhost:5678/webhook/lendloop-events -H 'Content-Type: application/json' -H 'X-LendLoop-Signature: 00' --data '{"ts":1}'
```

### Using Convex cloud instead

Run `npx convex dev` and pick a cloud project. Cloud Convex can't reach your laptop, so start the tunnel too (`docker compose up -d tunnel`), read its URL with `docker compose logs tunnel | grep trycloudflare`, and use it for `N8N_PUBLIC_URL` and `N8N_WEBHOOK_URL`. Before importing the workflows, point their four HTTP Request nodes at your deployment:

```bash
sed -i '' 's#http://host.docker.internal:3211#https://<deployment>.convex.site#g' n8n/*.json
```

## Tests

- `npm test`: access checks, loan rules, dates, signing, retries, idempotent notices and list filters.
- `scripts/smoke.sh`: checks the signed routes against a running deployment.
- `docs/test-cases.md`: manual cases with two users.

## For production

What I would change before real users depend on it.

### Hosting

- Run Convex and Clerk as separate production instances, not the dev ones.
- Host n8n on n8n Cloud or a server with a fixed domain. A quick tunnel's URL changes on every restart.

### Security

- Use one signing secret per direction (Convex to n8n, n8n to Convex) and rotate them on a schedule.
- Rate-limit the `/n8n/*` routes so a flood of bad requests can't load the backend.
- Keep the n8n editor behind a login and a private network. Only the webhook needs to be public.

### Reliability

- Send app and backend errors to an error tracker such as Sentry.
- Alert the team when an `automation_failed` notice is written, not only the admins in the app.
- Back up the n8n data volume, which holds the workflows and the encrypted credential.

### Notifications

- Add real email next to the in-app inbox, for example through Resend.
- Pass the `eventId` as Resend's idempotency key, so a retried event never sends the same email twice.
