#!/usr/bin/env bash
#
# Pull, build, migrate, restart — in the one order that works.
#
#   ./deploy/deploy.sh
#
# Safe to run again after a failure: every step is idempotent, and the script
# stops at the first one that does not succeed rather than restarting a build
# that never finished.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# ---------------------------------------------------------------- preflight

# Checked before anything is touched. A missing .env after a successful build
# and a stopped process is a much worse place to find out.
for f in backend/.env frontend/.env.production; do
  [ -f "$f" ] || { echo "Missing $f — see deploy/README.md step 4." >&2; exit 1; }
done

step "Pulling"
git pull --ff-only

# --------------------------------------------------------------------- build

# `shared` FIRST. It compiles to dist/, and both other workspaces import from
# it — build them first and they fail with "has no exported member", which
# reads like a code error and is not one.
step "shared"
(cd shared && npm ci --silent && npm run build)

step "backend"
(cd backend && npm ci --silent && npm run build)

# `next build` reads .env.production and BAKES NEXT_PUBLIC_API_URL into the
# bundle. That is why this runs on every deploy rather than only when the
# frontend changed: a changed address needs a rebuild, not a restart.
step "frontend"
(cd frontend && npm ci --silent && npm run build)

# ------------------------------------------------------------------ migrate

# After the build, before the restart. A migration that fails leaves the OLD
# processes serving the OLD schema, which is a working site; running it after
# the restart would leave the new code against the old schema, which is not.
step "Migrations"
(cd backend && npm run db:migrate)

# ------------------------------------------------------------------ restart

# `reload`, not `restart`: PM2 brings the replacement up before taking the old
# one down, so a deploy is not a small outage.
step "Reloading"
pm2 reload deploy/ecosystem.config.cjs --update-env
pm2 save

# -------------------------------------------------------------------- check

# The script does not get to say it succeeded. The server does.
step "Health"
PORT_PUBLIC="${STAYORA_PORT:-8080}"
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${PORT_PUBLIC}/api/health" >/dev/null 2>&1; then
    curl -s "http://127.0.0.1:${PORT_PUBLIC}/api/health"; echo
    curl -s "http://127.0.0.1:${PORT_PUBLIC}/api/health/db"; echo
    echo
    echo "Deployed."
    exit 0
  fi
  sleep 2
done

echo "The API did not answer within 40s. Try: pm2 logs stayora-api --lines 50" >&2
exit 1
