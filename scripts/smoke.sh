#!/usr/bin/env bash
# Checks the signed n8n routes against a running Convex deployment.
set -euo pipefail
: "${CONVEX_SITE_URL:?Set CONVEX_SITE_URL to https://<deployment>.convex.site}"
: "${LENDLOOP_HMAC_SECRET:?Set LENDLOOP_HMAC_SECRET to the value on the deployment}"

now_ms() { python3 -c 'import time; print(int(time.time() * 1000))'; }
sig() { printf '%s' "$1" | openssl dgst -sha256 -hmac "$LENDLOOP_HMAC_SECRET" | awk '{print $NF}'; }
post() {
  curl -sS -o /tmp/lendloop-smoke.out -w '%{http_code}' -X POST "$CONVEX_SITE_URL$1" \
    -H 'Content-Type: application/json' -H "X-LendLoop-Signature: ${3:-$(sig "$2")}" --data-binary "$2"
}
expect() { if [ "$2" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1 (got $2, want $3)"; cat /tmp/lendloop-smoke.out; exit 1; fi; }

body="{\"ts\":$(now_ms),\"runDate\":\"$(date +%F)\"}"
expect "forged signature is refused" "$(post /n8n/overdue "$body" 00)" 401
expect "stale timestamp is refused" "$(post /n8n/overdue '{"ts":1,"runDate":"2026-01-01"}')" 401
expect "overdue list answers" "$(post /n8n/overdue "$body")" 200
echo "      overdue loans: $(cat /tmp/lendloop-smoke.out)"

if [ -n "${SMOKE_USER_ID:-}" ]; then
  note="{\"ts\":$(now_ms),\"eventId\":\"smoke:$(date +%s)\",\"recipientId\":\"$SMOKE_USER_ID\",\"kind\":\"request_created\",\"message\":\"Smoke test notice\"}"
  expect "notice is written" "$(post /n8n/notify "$note")" 200
  grep -q '"created":true' /tmp/lendloop-smoke.out && echo "ok    first write created a row" || { echo "FAIL  first write created a row"; exit 1; }
  post /n8n/notify "$note" >/dev/null
  grep -q '"created":false' /tmp/lendloop-smoke.out && echo "ok    replay wrote nothing new" || { echo "FAIL  replay wrote nothing new"; exit 1; }
fi
