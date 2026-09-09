# Stayora API

NestJS + PostgreSQL (Drizzle). Serves the Next.js app in `../frontend/src`.

Roadmap and design decisions: **`../docs/backend-plan.md`**

---

## Setup

```bash
cd backend
npm install
cp .env.example .env      # then edit DATABASE_URL and SESSION_SECRET
npm run dev
```

- API: `http://localhost:4000/api`
- Liveness: `GET /api/health` — no database needed
- Readiness: `GET /api/health/db` — proves the Postgres connection

The pg pool connects lazily, so the API boots without Postgres running.
`/api/health/db` is what tells you the database is actually reachable.

## Scripts

| | |
|---|---|
| `npm run dev` | watch mode |
| `npm run build` · `npm start:prod` | compile to `dist/` and run |
| `npm run typecheck` · `npm run lint` | checks |
| `npm run db:generate` | SQL migration from the schema diff |
| `npm run db:migrate` | apply migrations |
| `npm run db:push` | direct sync — **local scratch DB only** |
| `npm run db:studio` | Drizzle Studio |

## Layout

```
src/
├─ main.ts                 bootstrap: /api prefix, helmet, cookies, CORS, shutdown hooks
├─ app.module.ts           feature modules register here as phases land
├─ config/env.ts           zod-validated env — process refuses to boot on a bad value
├─ db/
│  ├─ drizzle.module.ts    @Global — inject with @Inject(DRIZZLE) db: Database
│  └─ schema/index.ts      empty by design, see below
├─ common/
│  ├─ filters/             one error shape for the whole API
│  └─ pipes/               zod request validation
└─ modules/
   └─ health/
```

## Why `db/schema/` is still empty

Phase 0 is **done** — the canonical model now lives in `@stayora/shared`
(`../shared/src/types`), and `../docs/TYPE-MAP.md` records how the three old type
systems collapsed into it.

Tables land here in Module 2, once `shared/src/domain` encodes the 23 locked
business rules (`../docs/BUSINESS-RULES.md`). Writing schema before the rules are
executable would bake guesses into migrations.

## Two rules that are not negotiable

**Pricing is server-authoritative.** The client sends `roomId + dates + guests +
addOns`. Never a total. `/api/bookings/quote` and `POST /api/bookings` run the
identical calculation — the one already written in `../frontend/src/lib/domain.ts`.

**Overbooking is prevented by the database, not by JavaScript.** A
`CHECK (booked_units <= total_units)` on the availability calendar plus
`SELECT … FOR UPDATE` inside the booking transaction. Two guests checking out
simultaneously must not both get the last room. See `../docs/backend-plan.md` §6.

## Connecting the frontend

The Next app's `proxy.ts` (Next 16's new name for `middleware.ts`) rewrites
`/api/*` to this server. The browser sees one origin, so there is no CORS and no
cookie-domain problem. The `enableCors` block in `main.ts` only covers direct
calls — Postman, or a future mobile client.
