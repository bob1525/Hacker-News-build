#!/usr/bin/env bash
# Generate a PostgreSQL Prisma client and apply the current schema.
# Checked-in migrations are SQLite SQL, so this uses `prisma db push` on a copy
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
bash "$root/scripts/with-postgres-schema.sh" prisma generate
bash "$root/scripts/with-postgres-schema.sh" prisma db push --skip-generate --accept-data-loss
bash "$root/scripts/with-postgres-schema.sh" prisma db execute --stdin <<'SQL'
INSERT INTO "User" ("id", "username", "email", "passwordHash", "about", "createdAt")
VALUES ('ci-probe', 'ci-probe', 'ci-probe@example.com', 'x', '', CURRENT_TIMESTAMP);
SQL
bash "$root/scripts/with-postgres-schema.sh" prisma db execute --stdin <<'SQL'
DELETE FROM "User" WHERE "id" = 'ci-probe';
SQL
echo "PostgreSQL schema push and probe write succeeded"
