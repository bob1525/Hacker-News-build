#!/usr/bin/env bash
# Run a Prisma command against a temporary PostgreSQL copy of prisma/schema.prisma.
# The copy is deleted on exit. The checked-in schema stays on sqlite.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: with-postgres-schema.sh <prisma-args...>" >&2
  exit 1
fi

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
mkdir -p "$root/node_modules/.cache"
schema="$(mktemp "$root/node_modules/.cache/hn-postgres-schema.XXXXXX.prisma")"
trap 'rm -f "$schema"' EXIT

python3 - "$root" "$schema" <<'PY'
import pathlib, sys
root, dest = sys.argv[1:]
text = pathlib.Path(root, "prisma/schema.prisma").read_text()
old = 'provider = "sqlite"'
new = 'provider = "postgresql"'
if old not in text:
    raise SystemExit("sqlite provider was not found")
text = text.replace(old, new, 1)
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

npx "$@" --schema "$schema"
