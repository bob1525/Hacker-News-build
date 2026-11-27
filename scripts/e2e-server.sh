#!/bin/bash
set -euo pipefail
rm -f /tmp/hn-e2e-smtp.ready
: > /tmp/hn-e2e-mailbox.log
: > /tmp/hn-e2e-server.log
: > /tmp/hn-e2e-mail.log
node scripts/smtp-catcher.mjs >> /tmp/hn-e2e-smtp.log 2>&1 &
catcher=$!
cleanup() {
  kill "$catcher" 2>/dev/null || true
}
trap cleanup EXIT
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if [ -f /tmp/hn-e2e-smtp.ready ]; then
    break
  fi
  sleep 0.1
done
if [ ! -f /tmp/hn-e2e-smtp.ready ]; then
  echo "smtp catcher did not start" >&2
  exit 1
fi
npx prisma migrate deploy
npx tsx prisma/seed.ts
npx next build
npx next start --hostname 127.0.0.1 --port 3100 >> /tmp/hn-e2e-server.log 2>&1
