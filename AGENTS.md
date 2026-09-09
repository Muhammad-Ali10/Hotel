<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Stayora — project conventions

Luxury hotel-booking marketplace.

## Repo layout

Four workspaces, each with its own `package.json` and `node_modules`. There is
no install at the repo root — always `cd` into one first.

```
E:\Hotel\
├─ frontend/     Next.js 16 · React 19 · Tailwind v4 · TypeScript · shadcn/ui
├─ backend/      NestJS 11 · PostgreSQL · Drizzle ORM
├─ shared/       zod contracts + domain rules, built to dist/ and imported by both
├─ qa/           browser + API checks against a RUNNING stack (see qa/README.md)
├─ deploy/       nginx + PM2 + env templates for a shared VPS (see deploy/README.md)
└─ docs/         backend-plan.md + historical audit reports
```

`shared/` compiles to `dist/`, so a new export is invisible to the other two
until `cd shared && npm run build`. A "has no exported member" error on
something you just added is almost always this.

Paths below are relative to their own workspace: `src/app/…` means
`frontend/src/app/…`.

---

## Frontend (`frontend/`)

**shadcn is the `base-nova` style built on Base UI (`@base-ui/react`), NOT Radix.** For composition (the old `asChild`) use the **`render` prop**: `<Button render={<Link href="/x">Go</Link>} />`. Never use `asChild`.

**lucide-react is v1.x** — brand icons (Facebook/Twitter/Instagram/Linkedin/Github) were removed and do not exist. Use generic icons only.

**Design tokens:** headings use Inter (`font-heading` class), body uses Poppins. Palette is off-white + black via oklch CSS variables in `src/app/globals.css` (light + dark). Use theme token classes only (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `border`, …) — no hardcoded colors except amber for stars and status accents.

**Structure:**
- `src/app/(site)/*` — public pages (header/footer from `(site)/layout.tsx`): `/`, `/hotels`, `/hotels/[id]`, `/support`.
- `src/app/dashboard/*` — customer dashboard (header + sidebar from `dashboard/layout.tsx`): dashboard, bookings, favorites, reviews, notifications, profile, settings.
- `src/app/(auth)/*` — `/login`, `/signup`.
- `src/app/extranet/*` partner surface · `src/app/admin/*` super admin · `src/app/join/*` partner registration wizard.
- `src/components/ui/*` shadcn, `src/components/layout/*` shared chrome, `src/components/marketplace/*` (HotelCard, StarRating), `src/components/providers/*` (theme + react-query).
- `src/data/*` dummy data (import from `@/data`), `src/lib/images.ts` placeholder images (picsum), `src/lib/format.ts` formatters, `src/config/site.ts` brand/nav.
- Screen-local components live in a route's `_components/` folder.

**Run:** `cd frontend` → `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint`.

---

## Backend (`backend/`)

NestJS + Drizzle, served under `/api`. Roadmap and design decisions live in
**`docs/backend-plan.md`** — read it before adding tables or endpoints.

**Structure:**
- `src/main.ts` — bootstrap: `/api` global prefix, helmet, cookie-parser, CORS, shutdown hooks.
- `src/config/env.ts` — zod-validated environment. The process refuses to boot on a bad value.
- `src/db/drizzle.module.ts` — `@Global`. Inject with `@Inject(DRIZZLE) private readonly db: Database`.
- `src/db/schema/` — Drizzle tables. **Empty on purpose**, see the last section.
- `src/common/` — one error shape for the whole API, plus the zod validation pipe.
- `src/modules/<feature>/` — one folder per feature module.

**Conventions:**
- **No path aliases.** `nest build` compiles with `tsc`, which does not rewrite `@/…` in the emitted output — they break at runtime in `dist/`. Use relative imports.
- **Validation is zod, not class-validator.** There is deliberately no global `ValidationPipe` — it hard-crashes the boot without class-validator installed. Apply `ZodValidationPipe` per route, so the API and the Next forms can eventually share one schema.
- **Pricing is server-authoritative.** The client sends `roomId + dates + guests + addOns`, never a total.
- **Overbooking is prevented by the database, not JavaScript** — a `CHECK` constraint plus `SELECT … FOR UPDATE` inside the booking transaction.

**Run:** `cd backend` → `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm run db:generate` · `npm run db:migrate`.

**The suite has its own database and its own drivers.** `TEST_DATABASE_URL` is
REQUIRED when `NODE_ENV=test` and the process refuses to boot without it: the
specs `TRUNCATE` between files, and pointed at the development database that is
also what `npm run dev` is serving, a test run wipes the seeded catalogue out
from under a browser. Create it once:

```
docker exec stayora-db psql -U postgres -c "CREATE DATABASE stayora_test;"
npm run db:migrate:test
```

`MAIL_DRIVER` and `STORAGE_DRIVER` are FORCED to `fake` under `NODE_ENV=test`,
whatever `.env` says — a developer with SendGrid configured was otherwise
running a suite that really emailed `amelia@example.com` on every run.

Health: `GET /api/health` (no database needed) · `GET /api/health/db` (proves the Postgres connection).

---

## The one thing to know before touching data

`backend/src/db/schema/` is empty because the frontend still carries **three
diverged type systems for the same concepts**:

| File | Names |
|---|---|
| `frontend/src/types/index.ts` | `Hotel` · `Booking` · `UserProfile` · `Review.status: "published"` |
| `frontend/src/lib/admin/types.ts` | `Property` · `Reservation` · `Guest` · `Review.status: "Published"` |
| `frontend/src/lib/extranet/types.ts` | a third `Property`, different shape again |

Writing tables against any one of them bakes that split into the database, and the
partner's extranet would never see the same booking row as the customer's dashboard.
Unify the types first — `docs/backend-plan.md` §2.
