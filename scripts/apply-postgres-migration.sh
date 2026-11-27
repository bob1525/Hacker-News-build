#!/usr/bin/env bash
# Apply prisma/migrations-postgres/*.sql to an empty PostgreSQL schema, then
# fail if that schema drifts from the Prisma datamodel.
# Does not edit prisma/schema.prisma and does not replay SQLite migrations.
set -euo pipefail

generate=0
if [[ "${1:-}" == "--generate" ]]; then
  generate=1
elif [[ $# -gt 0 ]]; then
  echo "usage: apply-postgres-migration.sh [--generate]" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

case "$DATABASE_URL" in
  postgresql://*|postgres://*) ;;
  *)
    echo "Refusing to apply because DATABASE_URL is not a PostgreSQL URL" >&2
    exit 1
    ;;
esac

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to execute the multi-statement migration SQL" >&2
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$root/node_modules/.cache"
schema_file="$(mktemp "$root/node_modules/.cache/hn-postgres-schema.XXXXXX.prisma")"
sql_file="$(mktemp)"
trap 'rm -f "$schema_file" "$sql_file"' EXIT

python3 - "$root" "$schema_file" <<'PY'
import pathlib, sys
root, dest = sys.argv[1:]
text = pathlib.Path(root, "prisma/schema.prisma").read_text()
old = 'provider = "sqlite"'
if old not in text:
    raise SystemExit("sqlite provider was not found")
text = text.replace(old, 'provider = "postgresql"', 1)
output = pathlib.Path(root, "node_modules/.prisma/client").as_posix()
generator = 'generator client {\n  provider = "prisma-client-js"\n}'
replacement = (
    'generator client {\n'
    '  provider = "prisma-client-js"\n'
    f'  output   = "{output}"\n'
    '}'
)
if generator not in text:
    raise SystemExit("generator block was not found")
pathlib.Path(dest).write_text(text.replace(generator, replacement, 1))
PY

mapfile -t migration_files < <(find "$root/prisma/migrations-postgres" -maxdepth 1 -type f -name '*.sql' | sort)
if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "No SQL files in prisma/migrations-postgres" >&2
  exit 1
fi

eval "$(python3 - "$DATABASE_URL" "${POSTGRES_SCHEMA:-}" <<'PY'
import shlex, sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
raw, override = sys.argv[1:]
parts = urlsplit(raw)
query = dict(parse_qsl(parts.query, keep_blank_values=True))
name = override or query.get("schema") or "public"
if not name.replace("_", "").isalnum() or name[0].isdigit():
    raise SystemExit(f"Unsafe schema name {name}")
query["schema"] = name
prisma_url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))
psql_url = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
print(f"SCHEMA_NAME={shlex.quote(name)}")
print(f"PRISMA_URL={shlex.quote(prisma_url)}")
print(f"PSQL_URL={shlex.quote(psql_url)}")
PY
)"

export DATABASE_URL="$PRISMA_URL"

python3 - "$sql_file" "$SCHEMA_NAME" "${migration_files[@]}" <<'PY'
import pathlib, sys
dest, schema, *files = sys.argv[1:]
parts = [
    f'DROP SCHEMA IF EXISTS "{schema}" CASCADE;',
    f'CREATE SCHEMA "{schema}";',
    f'SET search_path TO "{schema}";',
]
for path in files:
    parts.append(pathlib.Path(path).read_text())
    if not parts[-1].endswith("\n"):
        parts[-1] += "\n"
pathlib.Path(dest).write_text("\n".join(parts) + "\n")
PY

echo "Applying PostgreSQL migration SQL to empty schema ${SCHEMA_NAME}"
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f "$sql_file"

if [[ "$generate" -eq 1 ]]; then
  npx prisma generate --schema "$schema_file"
fi

set +e
diff_output="$(npx prisma migrate diff --from-url "$PRISMA_URL" --to-schema-datamodel "$schema_file" --exit-code --script 2>&1)"
diff_code=$?
set -e
if [[ "$diff_code" -ne 0 ]]; then
  printf '%s\n' "$diff_output" >&2
  echo "PostgreSQL migration drift check failed with exit ${diff_code}" >&2
  exit "$diff_code"
fi
echo "PostgreSQL migration drift check passed for schema ${SCHEMA_NAME}"

psql "$PSQL_URL" -v ON_ERROR_STOP=1 <<SQL
SET search_path TO "${SCHEMA_NAME}";
INSERT INTO "User" ("id", "username", "email", "passwordHash", "about", "createdAt")
VALUES ('ci-probe', 'ci-probe', 'ci-probe@example.com', 'x', '', CURRENT_TIMESTAMP);
DELETE FROM "User" WHERE "id" = 'ci-probe';
SQL
echo "PostgreSQL migration SQL applied on empty schema ${SCHEMA_NAME}"
