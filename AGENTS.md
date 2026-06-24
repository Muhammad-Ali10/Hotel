<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Stayora — project conventions

Luxury hotel-booking marketplace. Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript · shadcn/ui.

**shadcn is the `base-nova` style built on Base UI (`@base-ui/react`), NOT Radix.** For composition (the old `asChild`) use the **`render` prop**: `<Button render={<Link href="/x">Go</Link>} />`. Never use `asChild`.

**lucide-react is v1.x** — brand icons (Facebook/Twitter/Instagram/Linkedin/Github) were removed and do not exist. Use generic icons only.

**Design tokens:** headings use Inter (`font-heading` class), body uses Poppins. Palette is off-white + black via oklch CSS variables in `src/app/globals.css` (light + dark). Use theme token classes only (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `border`, …) — no hardcoded colors except amber for stars and status accents.

**Structure:**
- `src/app/(site)/*` — public pages (header/footer from `(site)/layout.tsx`): `/`, `/hotels`, `/hotels/[id]`, `/support`.
- `src/app/dashboard/*` — customer dashboard (header + sidebar from `dashboard/layout.tsx`): dashboard, bookings, favorites, reviews, notifications, profile, settings.
- `src/app/(auth)/*` — `/login`, `/signup`.
- `src/components/ui/*` shadcn, `src/components/layout/*` shared chrome, `src/components/marketplace/*` (HotelCard, StarRating), `src/components/providers/*` (theme + react-query).
- `src/data/*` dummy data (import from `@/data`), `src/lib/images.ts` placeholder images (picsum), `src/lib/format.ts` formatters, `src/config/site.ts` brand/nav.
- Screen-local components live in a route's `_components/` folder.

**Run:** `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint`.
