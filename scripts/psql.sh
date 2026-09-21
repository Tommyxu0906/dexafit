#!/usr/bin/env bash
#
# Runs psql against SUPABASE_DB_URL with the arguments given.
#
#   scripts/psql.sh -f supabase/tests/security.sql
#
# Exists for two reasons: SUPABASE_DB_URL lives in .env.local and is not
# exported into the shell, and psql is not on the PATH on a Mac where Homebrew
# is installed under /opt/homebrew while the shell profile points at /usr/local.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL is not set. Add it to .env.local:" >&2
  echo "  SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres" >&2
  echo "Find it in Supabase under Project Settings -> Database -> Connection string." >&2
  exit 1
fi

PSQL="$(command -v psql || true)"
for candidate in \
  /opt/homebrew/opt/postgresql@17/bin/psql \
  /opt/homebrew/bin/psql \
  /usr/local/opt/postgresql@17/bin/psql \
  /usr/local/bin/psql
do
  [ -n "$PSQL" ] && break
  [ -x "$candidate" ] && PSQL="$candidate"
done

if [ -z "$PSQL" ]; then
  echo "psql not found. Install it with: brew install postgresql@17" >&2
  exit 1
fi

exec "$PSQL" "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 "$@"
