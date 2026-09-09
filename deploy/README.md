# Deploying Stayora to a shared VPS

Ubuntu · nginx · PM2 · an existing Postgres · **two other projects already on
the box**. Nothing here touches them.

The shape: nginx listens on **one extra port** and serves both halves of
Stayora from it — the Next app at `/`, the Nest API at `/api`. That makes the
whole product a **single origin**, which is what you want here:

- no CORS at all, so nothing to get wrong;
- the session cookie is same-origin, so `SameSite` never enters into it;
- one port to open in the firewall instead of two.

It also avoids fighting the other two projects for nginx's default server. They
almost certainly match on `server_name`; a bare IP matches none of them and
falls through to whichever is default. Its own port sidesteps that entirely.

```
                    :8080
  browser ──────────► nginx ──┬── /      ──► 127.0.0.1:3020   next start
                              └── /api   ──► 127.0.0.1:4020   node dist/main
                                                    │
                                                    └──► postgres  stayora
```

Both Node processes bind **127.0.0.1 only**. That is not tidiness — see
`HOST` in `backend/src/config/env.ts`. The API trusts one proxy hop, so if its
port were reachable from outside, anyone could set `X-Forwarded-For` themselves
and the rate limiter would count every request as a different client.

---

## 0. Pick ports that are free

Two projects are already here, so check rather than assume:

```bash
sudo ss -tlnp | sort -k4
```

Anything in the table below that is taken, change everywhere — the nginx file,
the PM2 file and the two env files all name them.

| what | port | reachable from |
|---|---|---|
| nginx (public) | `8080` | the internet |
| Next.js | `3020` | localhost only |
| Nest API | `4020` | localhost only |
| Postgres | `5432` | localhost only (existing) |

---

## 1. A database of its own

The other projects have their own. Stayora gets one too — same server, separate
database, separate role:

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE stayora WITH LOGIN PASSWORD 'put-a-real-password-here';
CREATE DATABASE stayora OWNER stayora;
SQL
```

A dedicated role matters on a shared box: a bug or a leaked credential in one
project should not be able to read another project's tables.

---

## 2. Node

Nest 11 and Next 16 both want Node 20+. If the existing projects are pinned to
an older Node, install `nvm` and give Stayora its own — PM2 records the
interpreter per app, so the other two keep whatever they run today.

```bash
node -v      # 20.x or newer
```

---

## 3. Code and dependencies

```bash
sudo mkdir -p /var/www/stayora && sudo chown $USER:$USER /var/www/stayora
git clone <your-repo> /var/www/stayora
cd /var/www/stayora
```

**Build order is not optional.** `shared/` compiles to `dist/`, and both other
workspaces import from it. Build it first or they both fail with "has no
exported member":

```bash
cd shared   && npm ci && npm run build
cd ../backend  && npm ci
cd ../frontend && npm ci
```

---

## 4. Environment

Copy the two templates in this folder and fill them in:

```bash
cp deploy/backend.env.example  backend/.env
cp deploy/frontend.env.example frontend/.env.production
```

Then edit **`backend/.env`**:

```bash
# 48 bytes of real randomness. The one in the repo says so in its own value.
openssl rand -base64 48
```

Three values decide whether this works at all:

| variable | value | why |
|---|---|---|
| `WEB_ORIGIN` | `http://169.58.197.190:8080` | not only CORS — every verification link, password reset and payment return URL is built from it |
| `COOKIE_SECURE` | `false` | **only because there is no TLS yet.** Remove it the day a certificate exists |
| `HOST` | `127.0.0.1` | so nginx is the only thing that can reach the API |

And in **`frontend/.env.production`**:

```
NEXT_PUBLIC_API_URL=http://169.58.197.190:8080/api/v1
```

> **This one is frozen at build time.** Next replaces the expression with a
> literal, so changing it later and restarting does nothing — you have to
> rebuild. Get the address right before step 5.

---

## 5. Build

```bash
cd /var/www/stayora/backend  && npm run build
cd ../frontend && npm run build
```

`next build` is memory-hungry. On a small VPS already running two apps it can
be OOM-killed; if that happens, add swap:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
```

---

## 6. Migrate

```bash
cd /var/www/stayora/backend
npm run db:migrate
```

Demo data for testing is a **decision**, not a step. `npm run db:seed` refuses
to run when `NODE_ENV=production` — deliberately, because seeding and wiping
are the same operation from the data's point of view. If this box is genuinely
a test environment and you want the eight hotels:

```bash
NODE_ENV=development npm run db:seed    # reads DATABASE_URL from .env
```

Do that **once**, before anyone real uses it. It TRUNCATEs first.

---

## 7. PM2

```bash
cd /var/www/stayora
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

App names are prefixed `stayora-`, so `pm2 list` stays readable next to the
other two projects and `pm2 restart stayora-api` cannot hit the wrong thing.

If PM2 is not yet set to survive a reboot on this box:

```bash
pm2 startup      # prints a command to run with sudo
```

---

## 8. nginx

```bash
sudo cp deploy/nginx/stayora.conf /etc/nginx/sites-available/stayora
sudo ln -s /etc/nginx/sites-available/stayora /etc/nginx/sites-enabled/
sudo nginx -t          # never skip this — a bad file takes the OTHER sites down
sudo systemctl reload nginx
```

`nginx -t` before reload is the whole reason the other two projects stay up: a
reload with a broken config fails and leaves the running config in place, but a
restart would not.

```bash
sudo ufw allow 8080/tcp    # if ufw is in use
```

---

## 9. Check it actually works

```bash
curl -s http://169.58.197.190:8080/api/health          # {"ok":true,...}
curl -s http://169.58.197.190:8080/api/health/db       # {"ok":true,"latencyMs":..}
curl -sI http://169.58.197.190:8080/ | head -1         # 200
```

Then the part that the curls cannot tell you — **that a login sticks**:

```bash
curl -s -c /tmp/j -X POST http://169.58.197.190:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"guest@stayora.test","password":"correct horse battery staple"}' -o /dev/null
curl -s -b /tmp/j http://169.58.197.190:8080/api/v1/auth/me
```

If the second returns your user, the cookie survived. If it returns `401` after
a `200` login, `COOKIE_SECURE` is still `true` on a plain-HTTP host — that is
the failure this whole file warns about, and it looks like nothing at all in
the logs.

The QA suites can be pointed at the deployed box too:

```bash
cd qa && npm install
QA_WEB=http://169.58.197.190:8080 QA_API=http://169.58.197.190:8080/api/v1 npm run smoke
```

---

## Before this stops being a test box

Everything above is honest about being a staging setup. Four things must change
before anyone real uses it:

1. **A domain and TLS.** Then delete `COOKIE_SECURE=false` and let it default
   back to on. Until then every session cookie crosses the network in clear.
2. **Photo storage.** `STORAGE_DRIVER=fake` writes to `backend/.storage/` on
   this one machine. A redeploy that replaces the directory loses every upload,
   and a second instance cannot see the first one's files. S3 or R2 for real.
3. **Mail.** Set `MAIL_DRIVER` and its key. Until then `GET /api/v1/admin/notifications/health`
   answers `not_sending`, and the admin dashboard says so — which is the point.
4. **Backups.** `pg_dump` on a timer. The other two projects presumably have
   this; Stayora needs its own line in it.
