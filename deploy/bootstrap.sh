#!/usr/bin/env bash
#
# Stayora, from a fresh clone to a running site — one command.
#
#   cd /var/www/stayora && ./deploy/bootstrap.sh
#
# Run it ON THE SERVER, as a normal user with sudo. It will ask for the sudo
# password when it needs one, and for nothing else.
#
# Safe to run again. Every step checks whether it has already been done, so a
# re-run after fixing one problem does not undo the steps that worked. It
# never overwrites an existing .env — secrets are generated once and kept.

set -euo pipefail

# ------------------------------------------------------------------ settings

SERVER_IP="${SERVER_IP:-169.58.197.190}"
PORT_PUBLIC="${PORT_PUBLIC:-8080}"   # what the internet sees
PORT_WEB="${PORT_WEB:-3020}"         # Next, localhost only
PORT_API="${PORT_API:-4020}"         # Nest, localhost only

DB_NAME="${DB_NAME:-stayora}"
DB_USER="${DB_USER:-stayora}"
DB_TEST="${DB_TEST:-stayora_test}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ------------------------------------------------------------------- output

bold() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
ok()   { printf '    \033[32mok\033[0m  %s\n' "$1"; }
warn() { printf '    \033[33m!!\033[0m  %s\n' "$1"; }
die()  { printf '\n\033[31mSTOPPED:\033[0m %s\n\n' "$1" >&2; exit 1; }

# =========================================================== 1. preflight ==
#
# Everything that can be checked before anything is changed, is. A missing
# dependency found after the build has run and the old process has stopped is
# a much worse place to be than a script that refused to start.

bold "Checking the box"

command -v node >/dev/null || die "node is not installed"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "node $NODE_MAJOR is too old — Nest 11 and Next 16 need 20 or newer"
ok "node $(node -v)"

command -v npm >/dev/null || die "npm is not installed"
command -v pm2 >/dev/null || die "pm2 is not installed — npm i -g pm2"
command -v psql >/dev/null || warn "psql not on PATH; the database step will be skipped"
ok "pm2 $(pm2 -v)"

# Ports, checked rather than assumed — there are already two projects here.
for port in "$PORT_PUBLIC" "$PORT_WEB" "$PORT_API"; do
  if ss -tlnp 2>/dev/null | grep -qE "[:.]$port[[:space:]]"; then
    die "port $port is already in use. Re-run with e.g. PORT_PUBLIC=8090 ./deploy/bootstrap.sh"
  fi
done
ok "ports $PORT_PUBLIC, $PORT_WEB, $PORT_API are free"

sudo -n true 2>/dev/null || warn "sudo will ask for your password"

# ============================================================ 2. database ==

bold "Database"

if sudo -u postgres psql -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
  ok "$DB_NAME already exists"
  DB_PASSWORD=""
else
  # Generated, not typed. A password somebody invents on the spot is one they
  # reuse, and this one only ever has to be pasted into a file by this script.
  DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  sudo -u postgres psql <<SQL
CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
CREATE DATABASE $DB_TEST OWNER $DB_USER;
SQL
  ok "created role $DB_USER, databases $DB_NAME and $DB_TEST"
fi

# ================================================================= 3. env ==

bold "Environment"

if [ -f backend/.env ]; then
  ok "backend/.env already exists — left alone"
else
  [ -n "$DB_PASSWORD" ] || die "backend/.env is missing but the database already exists — its password is not recoverable from here. Write backend/.env by hand from deploy/backend.env.example."

  SESSION_SECRET="$(openssl rand -base64 48)"
  sed \
    -e "s#<SERVER-IP>#$SERVER_IP#g" \
    -e "s#169.58.197.190#$SERVER_IP#g" \
    -e "s#<DB-PASSWORD>#$DB_PASSWORD#g" \
    -e "s#<PASTE-openssl-rand-base64-48>#$SESSION_SECRET#g" \
    -e "s#^PORT=.*#PORT=$PORT_API#" \
    -e "s#:8080#:$PORT_PUBLIC#g" \
    deploy/backend.env.example > backend/.env
  chmod 600 backend/.env
  ok "wrote backend/.env (session secret and database password generated)"
fi

if [ -f frontend/.env.production ]; then
  ok "frontend/.env.production already exists — left alone"
else
  sed \
    -e "s#<SERVER-IP>#$SERVER_IP#g" \
    -e "s#169.58.197.190#$SERVER_IP#g" \
    -e "s#:8080#:$PORT_PUBLIC#g" \
    deploy/frontend.env.example > frontend/.env.production
  ok "wrote frontend/.env.production"
fi

# The address is compiled INTO the bundle, so it has to be right before the
# build rather than before the restart.
grep -q "$SERVER_IP:$PORT_PUBLIC" frontend/.env.production \
  || die "frontend/.env.production does not point at $SERVER_IP:$PORT_PUBLIC — fix it, then re-run"
ok "frontend will be built against http://$SERVER_IP:$PORT_PUBLIC"

# =============================================================== 4. build ==
#
# `shared` FIRST. It compiles to dist/, and both other workspaces import from
# it — build them first and they fail with "has no exported member", which
# reads like a code error and is not one.

bold "Building (a few minutes)"

( cd shared   && npm ci --silent && npm run build --silent ) && ok "shared"
( cd backend  && npm ci --silent && npm run build --silent ) && ok "backend"
( cd frontend && npm ci --silent && npm run build ) && ok "frontend"

# =========================================================== 5. migrations ==

bold "Migrations"
( cd backend && npm run db:migrate ) >/dev/null && ok "$DB_NAME is up to date"
( cd backend && npm run db:migrate:test ) >/dev/null && ok "$DB_TEST is up to date"

# =============================================================== 6. pm2 ====

bold "Processes"

sudo mkdir -p /var/log/stayora
sudo chown "$USER":"$USER" /var/log/stayora

# `reload` when they already exist, so a re-run is not a small outage.
if pm2 describe stayora-api >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env >/dev/null
  ok "reloaded"
else
  pm2 start deploy/ecosystem.config.cjs >/dev/null
  ok "started"
fi
pm2 save >/dev/null

# ============================================================== 7. nginx ===

bold "nginx"

if [ -f /etc/nginx/sites-enabled/stayora ]; then
  ok "site already enabled"
else
  sudo cp deploy/nginx/stayora.conf /etc/nginx/sites-available/stayora
  sudo sed -i "s/listen 8080;/listen $PORT_PUBLIC;/; s/listen \[::\]:8080;/listen [::]:$PORT_PUBLIC;/" \
    /etc/nginx/sites-available/stayora
  sudo sed -i "s/127.0.0.1:3020/127.0.0.1:$PORT_WEB/; s/127.0.0.1:4020/127.0.0.1:$PORT_API/" \
    /etc/nginx/sites-available/stayora
  sudo ln -sf /etc/nginx/sites-available/stayora /etc/nginx/sites-enabled/stayora
  ok "installed"
fi

# THE line that keeps the other two projects up.
#
# A reload with a broken config fails and leaves the running config in place;
# a restart would not. Testing first means a mistake here costs nothing.
if ! sudo nginx -t 2>/dev/null; then
  sudo rm -f /etc/nginx/sites-enabled/stayora
  sudo nginx -t >/dev/null 2>&1 || warn "nginx config was ALREADY broken before this script ran"
  die "nginx rejected the config. Stayora's site file has been removed and nothing was reloaded — your other projects are untouched. Run: sudo nginx -t"
fi
sudo systemctl reload nginx
ok "reloaded (config tested first)"

command -v ufw >/dev/null && sudo ufw allow "$PORT_PUBLIC"/tcp >/dev/null 2>&1 && ok "opened $PORT_PUBLIC in ufw" || true

# ============================================================== 8. verify ==
#
# The script does not get to say it worked. The server does.

bold "Checking"

for _ in $(seq 1 25); do
  if curl -fsS "http://127.0.0.1:$PORT_PUBLIC/api/health" >/dev/null 2>&1; then break; fi
  sleep 2
done

curl -fsS "http://127.0.0.1:$PORT_PUBLIC/api/health"    >/dev/null 2>&1 || die "the API is not answering. Try: pm2 logs stayora-api --lines 50"
ok "API is up"
curl -fsS "http://127.0.0.1:$PORT_PUBLIC/api/health/db" | grep -q '"ok":true' || die "the API cannot reach Postgres. Check DATABASE_URL in backend/.env"
ok "database is reachable"
curl -fsS -o /dev/null "http://127.0.0.1:$PORT_PUBLIC/" || die "the site is not answering. Try: pm2 logs stayora-web --lines 50"
ok "site is up"

# The one a curl cannot answer: does a login STICK. On plain HTTP a `Secure`
# cookie is set by the server and thrown away by the browser — a login that
# succeeds and a session that never exists, with nothing in any log.
if grep -q '^COOKIE_SECURE=false' backend/.env; then
  ok "COOKIE_SECURE=false — correct while there is no certificate"
else
  warn "COOKIE_SECURE is not false. Without HTTPS every login will succeed and every request after it will be 401."
fi

cat <<DONE

  Stayora is running.

    http://$SERVER_IP:$PORT_PUBLIC

  Demo data (optional, and it TRUNCATES — run it once, before anyone real uses this):

    cd backend && NODE_ENV=development npm run db:seed

  Then sign in as   guest@stayora.test  /  owner@aurora.test  /  admin@stayora.test
  with the password  correct horse battery staple

  Logs:     pm2 logs stayora-api
  Restart:  pm2 reload deploy/ecosystem.config.cjs
  Update:   git pull && ./deploy/deploy.sh

DONE
