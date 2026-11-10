#!/usr/bin/env bash
# Apply the current Prisma schema to PostgreSQL without touching the SQLite migrations.
# The checked-in migrations are SQLite SQL, so this uses `prisma db push` on a copy
# whose provider is postgresql. It does not rewrite prisma/schema.prisma.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

case "$DATABASE_URL" in
  postgresql://*|postgres://*) ;;
  *)
    echo "Refusing to push because DATABASE_URL is not a PostgreSQL URL" >&2
    exit 1
    ;;
esac

root="$(cd "$(dirname "$0")/.." && pwd)"
schema="$(mktemp)"
trap 'rm -f "$schema"' EXIT
cp "$root/prisma/schema.prisma" "$schema"
sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$schema"

if ! grep -q 'provider = "postgresql"' "$schema"; then
  echo "Failed to switch the datasource provider to postgresql" >&2
  exit 1
fi

npx prisma db push --schema "$schema" --skip-generate --accept-data-loss
npx prisma db execute --schema "$schema" --stdin <<'SQL'
INSERT INTO "User" ("id", "username", "email", "passwordHash", "about", "createdAt")
VALUES ('ci-probe', 'ci-probe', 'ci-probe@example.com', 'x', '', CURRENT_TIMESTAMP);
SQL
npx prisma db execute --schema "$schema" --stdin <<'SQL'
DELETE FROM "User" WHERE "id" = 'ci-probe';
SQL
echo "PostgreSQL schema push and probe write succeeded"
