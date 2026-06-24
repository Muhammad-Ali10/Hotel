# Figma → Code rules (Stayora)

Rules for translating Figma designs into this codebase via the Figma MCP. Read this
before generating any UI from a Figma node. The golden rule: **map Figma to existing
tokens and components — never reproduce raw values from the Figma payload.**

> Stack at a glance: **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
> shadcn `base-nova` on Base UI (`@base-ui/react`, NOT Radix) · lucide-react v1.**
> See `AGENTS.md` for the canonical project conventions; this file is the design-import companion.

---

## 1. Token Definitions

**Single source of truth:** `src/app/globals.css`. There is **no `tailwind.config.js`** —
Tailwind v4 is configured entirely in CSS. `components.json` points `tailwind.config` at `""`.

Three layers, in order:

1. **`@theme inline { … }`** — maps Tailwind utility names to CSS variables. This is what makes
   `bg-primary`, `text-muted-foreground`, `rounded-xl`, `font-heading`, etc. resolve.
2. **`:root { … }`** — light-mode raw values, authored as **oklch**.
3. **`.dark { … }`** — dark-mode overrides (class-based dark mode via `@custom-variant dark`).

```css
@theme inline {
  --color-primary: var(--primary);
  --color-muted-foreground: var(--muted-foreground);
  --radius-xl: calc(var(--radius) * 1.4);
  --font-heading: var(--font-heading);
}
:root {
  --background: oklch(0.971 0.003 106); /* off-white */
  --foreground: oklch(0.16 0 0);        /* black */
  --primary: oklch(0.16 0 0);
  --radius: 0.625rem;
}
.dark { --background: oklch(0.15 0 0); --foreground: oklch(0.971 0.003 106); /* … */ }
```

**Token format:** colors are **oklch**, not hex/rgb. Radii are derived from one `--radius`
base via `calc()` (`sm`→`4xl`). Spacing/typography use Tailwind v4 defaults plus the two font vars.

### Color tokens (use the utility class, not the value)

| Role | Class examples |
|---|---|
| Surfaces | `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-sidebar` |
| Text | `text-foreground`, `text-muted-foreground`, `text-card-foreground` |
| Brand / actions | `bg-primary text-primary-foreground`, `bg-secondary`, `bg-accent` |
| Lines | `border` / `border-border`, `ring`, `input` |
| Status | `bg-destructive` / `text-destructive`, charts `chart-1`…`chart-5` |
| Sidebar | `bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`, … |

**Token-mapping rules when importing from Figma:**
- A Figma fill that is off-white → `background`/`card`; near-black → `foreground`/`primary`.
  Don't emit the literal oklch/hex — pick the role.
- **Only hardcoded colors allowed:** `amber-*` for star ratings and small status accents
  (e.g. `fill-amber-400 text-amber-400`). Everything else MUST be a theme token class.
- If a Figma color has no token, prefer the nearest existing token over inventing one. Add a
  new token to **all three** layers (`@theme inline`, `:root`, `.dark`) only if truly necessary.
- Radius: map to `rounded-md/lg/xl/2xl…` (they scale off `--radius`), not pixel values.

### Typography tokens

- **Headings:** Inter, applied via the `font-heading` class. `globals.css` `@layer base` already
  sets `h1–h6 { @apply font-heading }`, so semantic headings inherit it automatically.
- **Body:** Poppins, via `font-sans` (the default on `html`). Weights loaded: 300/400/500/600/700.
- Fonts are wired with `next/font/google` in `src/app/layout.tsx` exposing `--font-heading` /
  `--font-sans`. **Don't add `<link>` font tags or re-import fonts** — reuse these.
- For non-heading text that needs the display face (prices, card titles), add `font-heading`
  explicitly (see `HotelCard`, `CardTitle`).

---

## 2. Component Library

**Location:** `src/components/ui/*` — shadcn primitives (`button`, `card`, `input`, `select`,
`dialog`, `sheet`, `tabs`, `accordion`, `badge`, `avatar`, `calendar`, `command`, `table`,
`tooltip`, `sonner`, …). Always check here first; **reuse before you build.**

**Architecture (critical — differs from training data):**
- Style is **`base-nova` built on Base UI (`@base-ui/react`)**, NOT Radix. Imports look like
  `import { Button as ButtonPrimitive } from "@base-ui/react/button"`.
- **Composition uses the `render` prop, never `asChild`:**
  ```tsx
  <Button render={<Link href={`/hotels/${id}`}>Book Now</Link>} />
  <DropdownMenuTrigger render={<Button variant="ghost" size="icon">…</Button>} />
  ```
- Variants use **CVA** (`class-variance-authority`). Reference the variant API, don't reinvent:
  - `Button` variants: `default | outline | secondary | ghost | destructive | link`;
    sizes: `default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg`.
- Components expose **`data-slot="…"`** attributes (`card`, `card-header`, `card-footer`, `button`).
  Layout hooks key off these (e.g. Card padding reacts to `has-data-[slot=card-footer]`). Preserve them.
- Every primitive merges classes through **`cn()`** (`src/lib/utils.ts` = `twMerge(clsx(...))`).
  Author overrides as className props; `cn` resolves conflicts.

**Higher-level / domain components:**
- `src/components/layout/*` — shared chrome (`site-header`, `site-footer`, `dashboard-header`,
  `dashboard-sidebar`, `dashboard-footer`, `mode-toggle`).
- `src/components/marketplace/*` — domain pieces (`HotelCard`, `StarRating`, `HeroSearch`).
- `src/components/providers/*` — `ThemeProvider`, `QueryProvider`, composed in `providers/index.tsx`.

**No Storybook / MDX docs.** The components themselves + `AGENTS.md` are the reference.

**Add new shadcn components via the CLI** (don't hand-write registry files):
config is `components.json` (`style: base-nova`, `rsc: true`, `iconLibrary: lucide`,
aliases `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`).

---

## 3. Frameworks & Libraries

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16**, App Router | Read `node_modules/next/dist/docs/` before using new APIs — this is not the Next.js in your training data. |
| UI runtime | **React 19** | Server Components by default; add `"use client"` only when needed. |
| Language | **TypeScript 5** | `npm run typecheck` = `tsc --noEmit`. |
| Styling | **Tailwind v4** + `tw-animate-css` + `shadcn/tailwind.css` | CSS-first config (no JS config file). |
| Primitives | **Base UI** `@base-ui/react` | NOT Radix. |
| Variants | `class-variance-authority`, `clsx`, `tailwind-merge` | via `cn()`. |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers` | |
| Data/state | `@tanstack/react-query` (+ devtools), `zustand` | dummy data today; query layer is wired. |
| Theming | `next-themes` (class strategy, default light) | |
| Toasts | `sonner` | `<Toaster richColors closeButton position="top-center" />` |
| Dates | `date-fns`, `react-day-picker` (Calendar) | |
| Command menu | `cmdk` | |
| Build/lint | `next build`, ESLint 9 (`eslint-config-next`), Prettier + `prettier-plugin-tailwindcss` | |

**Client vs Server:** layouts/pages are Server Components. Interactive pieces (`mode-toggle`,
`providers`, `*-form`, `*-browser`, `booking-widget`, screen `_components` with state) start with
`"use client"`. When importing an interactive Figma component, mark it client; keep static layout server-side.

Scripts: `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm run format`.

---

## 4. Asset Management

- **No local image assets / no `public/` image pipeline.** All imagery is **remote placeholder**
  helpers in `src/lib/images.ts`:
  - `hotelImage(seed, w, h)` / `placeholderImage(...)` → Unsplash CDN, deterministic by hash.
  - `destinationImage(name, w, h)` → city-keyed Unsplash pool.
  - `avatarImage(seed, size)` → pravatar.
- A **stable string hash** keeps the same entity on the same photo across renders — pass a
  `seed` (entities carry a `seed` field in `src/types`). Don't hardcode image URLs from Figma; route
  through these helpers.
- **Always use `next/image`** with `fill` + `sizes` (and `object-cover`) for responsive media:
  ```tsx
  <Image src={placeholderImage(hotel.seed, 560, 350)} alt={hotel.name} fill
         sizes="(max-width: 768px) 100vw, 300px" className="object-cover …" />
  ```
- **Remote hosts must be whitelisted** in `next.config.ts › images.remotePatterns`. Currently:
  `images.unsplash.com`, `i.pravatar.cc`, `picsum.photos`, `loremflickr.com`, `placehold.co`.
  Add a host there before using a new image domain.
- If a Figma frame ships real exported assets, use the Figma MCP `download_assets`, place under
  `public/`, and import locally — but for mock/marketplace UI prefer the existing seeded helpers.

---

## 5. Icon System

- **`lucide-react` v1.x** is the icon set (`iconLibrary: "lucide"` in `components.json`).
  Import named components: `import { MapPin, Star, Moon, Sun } from "lucide-react"`.
- **v1 BREAKING CHANGE — brand icons were removed.** `Facebook`, `Twitter`, `Instagram`,
  `Linkedin`, `Github` **do not exist**. Never import them. For socials use generic icons
  (or text/emoji as `siteConfig.socials` does). Verify an icon exists before using it.
- **Sizing:** Tailwind size utilities, not props — `<Star className="size-3.5" />`,
  `className="size-5"`. Button auto-sizes bare icons to `size-4` via
  `[&_svg:not([class*='size-'])]:size-4`, so only set a size to override.
- **Color:** inherit via `text-*` tokens (`text-muted-foreground`). Stars are the amber exception:
  `fill-amber-400 text-amber-400`.
- Map any Figma icon to its closest lucide name (kebab in Figma → PascalCase import). If there's
  no equivalent, pick the nearest generic glyph — do not inline raw SVG from the Figma payload.

---

## 6. Styling Approach

- **Utility-first Tailwind v4**, composed inline and merged via `cn()`. No CSS Modules, no
  styled-components, no per-component `.css` files. The only global stylesheet is
  `src/app/globals.css` (tokens + `@layer base` resets).
- **Class-based dark mode** (`@custom-variant dark (&:is(.dark *))`, driven by `next-themes`).
  Author light styles with tokens; tokens auto-flip in `.dark`. Only add explicit `dark:` utilities
  for true dark-specific tweaks (see `mode-toggle` icon rotation, button `dark:` states).
- **Responsive:** mobile-first Tailwind breakpoints (`sm: md: lg: xl:`) and container queries
  (`@container/...`, `@container/card-header`). Page width via `mx-auto max-w-* px-*` wrappers,
  full-height via `min-h-dvh` / `min-h-full flex flex-col`.
- **Use token classes, not arbitrary values.** Avoid `bg-[#…]`, `text-[12px]`, inline `style`.
  When an exact non-token value is unavoidable, prefer `color-mix(in oklch, …)` against a token
  (as `Button` secondary hover does) over a raw literal.
- **State styling via data/aria selectors**, matching Base UI: `aria-expanded:`, `aria-invalid:`,
  `data-[size=sm]:`, `has-data-[slot=…]:`, `group/…` + `group-data-[…]`. Reuse these patterns
  instead of adding state classes ad hoc.

---

## 7. Project Structure

```
src/
  app/
    layout.tsx            # root: fonts (Inter/Poppins), <Providers>, metadata
    globals.css           # ★ all design tokens (light + dark) + base layer
    not-found.tsx
    (site)/               # public pages — header+footer from (site)/layout.tsx
      page.tsx  hotels/  hotels/[id]/  support/
    dashboard/            # customer dashboard — header+sidebar from dashboard/layout.tsx
      page.tsx  bookings/ favorites/ reviews/ notifications/ profile/ settings/ support/
    (auth)/               # login / signup — minimal (auth)/layout.tsx
  components/
    ui/                   # shadcn base-nova primitives (Base UI)
    layout/               # shared chrome: site-/dashboard- header, footer, sidebar, mode-toggle
    marketplace/          # domain: HotelCard, StarRating, HeroSearch
    providers/            # theme + react-query, composed in index.tsx
  config/site.ts          # brand, nav, footer, socials (siteConfig)
  data/                   # dummy data: hotels, destinations, content, dashboard → import from "@/data"
  lib/                    # utils.ts (cn), images.ts (placeholders), format.ts (currency/date)
  types/index.ts          # domain types: Hotel, Booking, Review, Destination, …
```

**Routing & feature conventions:**
- **Route groups** `(site)` / `(dashboard via dashboard/)` / `(auth)` each own a `layout.tsx` that
  supplies the chrome. Place a new public page under `(site)`, dashboard page under `dashboard/`,
  auth page under `(auth)`. Match the surrounding layout — a Figma "screen" maps to a route + its group.
- **Screen-local components live in a route's `_components/` folder** (underscore = not a route),
  e.g. `app/(site)/hotels/_components/result-card.tsx`. Build one-off, page-specific pieces from a
  Figma frame here; promote to `components/marketplace/` or `components/ui/` only when reused.
- **Import aliases:** `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/data`, `@/types`,
  `@/config/site`. Use these, not deep relative paths.
- **Data & formatting:** pull content from `@/data`, type with `@/types`, format with
  `@/lib/format` (`formatCurrency`, `formatNumber`, `formatDate`), image via `@/lib/images`.

---

## Import checklist (run through this for every Figma node)

1. **Identify the screen → route group** (`(site)` / `dashboard` / `(auth)`) and whether it's a
   page, a shared chrome piece, or a screen-local `_components/` part.
2. **Reuse a `components/ui` primitive** for every control. Compose with `render`, never `asChild`.
3. **Map fills/text/radii to token classes** (`bg-*`, `text-*`, `rounded-*`) — never emit oklch/hex.
   Amber for stars is the only literal color.
4. **Headings → semantic tags / `font-heading`; body → default `font-sans`.** No new font loading.
5. **Icons → lucide v1 named imports**, sized with `size-*`. No brand icons; no inline SVG.
6. **Images → `next/image` + `@/lib/images` seeded helpers**; whitelist any new host in `next.config.ts`.
7. **Mark interactive pieces `"use client"`**; keep layout/static server-side.
8. **Verify:** `npm run typecheck` and `npm run lint` clean before considering it done.
