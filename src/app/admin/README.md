# Stayora Super Admin (`/admin`)

Internal platform-administration panel. Desktop-first (1280px+), with a tablet
fallback and a sheet-based nav below `lg`.

Built from the "Super admin" Figma file (`LqV3kJePF48sNQjxXiojZF`, 30
artboards). Everything is mock data — see [What's mocked](#whats-mocked-vs-real).

---

## Phase 1 decisions this build encodes

The Figma had several unresolved conflicts. These were signed off before build:

| ID | Conflict | Resolution |
|----|----------|-----------|
| D2 | Figma is orange-accented; Stayora's system is off-white + black | Use Stayora's existing oklch tokens. No orange, no new palette. Dark mode inherited free. Also fixes an AA contrast failure (orange `#EA580C` at 13px ≈ 4.0:1). |
| D3 | Sidebar "Clients" listed *travellers*, while Billing/Finance/Analytics referenced *tenant orgs* that had no screen | Split: `/admin/clients` = tenant organisations (new), `/admin/guests` = travellers |
| D4 | Finance→Payouts/Invoices and Promotions used PKR + Pakistani hotels; everything else USD + international. Property counts read 3/6/12/14 | One canonical USD dataset. Every count derived from the source arrays. |
| D5 | Figma listed 5 *tenant-side* roles; brief asked for platform roles | RBAC enforces `super_admin` / `ops` / `finance` / `support`. The Figma's 5 tenant roles remain per-manager data under Managers & Users. |
| D6 | Property detail offered Approve + Request Changes + Re-approve simultaneously on a screen saying "Rejected" | A real state machine — only legal transitions render. See `allowedTransitions()`. |
| D7 | "Generate Invoice" ended on *Preview Invoice* with no preview screen and no way to issue | Two-step dialog: form → computed preview → **Issue invoice** |

---

## Routes

23 routes. All are gated by `AdminRouteGuard`, which resolves the pathname to a
resource and renders `PermissionDenied` if the role can't view it.

| Route | Screen | Figma |
|-------|--------|-------|
| `/admin` | Platform dashboard — 8 KPIs, revenue/bookings chart (6M·1Y), activity feed, client grid | S1 |
| `/admin/clients` | Tenant organisations | **new** (D3) |
| `/admin/clients/[id]` | Tenant detail — org, team, properties | **new** (D3) |
| `/admin/guests` | Registered travellers | S2 |
| `/admin/guests/[id]` | Guest detail + reservation history | **new** |
| `/admin/properties` | Master property list | S3 |
| `/admin/properties/[id]` | Property detail — approval panel, verification video, rooms, taxes, photos | S4, S5 |
| `/admin/users` | Managers & users + Invite Manager | S6, S7 |
| `/admin/reservations` | Global reservations + detail & cancel dialogs | S8, S9 |
| `/admin/reservations/cancellations` | Cancellations | **new** (in Figma nav, never designed) |
| `/admin/promotions` | Active promotions + hotel-list dialog | S23, S25 |
| `/admin/promotions/rankings` | Discount rankings | S24 |
| `/admin/inbox` | Three-pane inbox — tickets + guest messages | S10, S11 |
| `/admin/reviews` | Review moderation | S12 |
| `/admin/finance` | Revenue by property | S13 |
| `/admin/finance/revenue` | Revenue breakdown vs prior year | S14 |
| `/admin/finance/commissions` | Commission breakdown | S15 |
| `/admin/finance/payouts` | Payouts + detail dialog + retry | S16, S17 |
| `/admin/finance/invoices` | Commission invoices + generate/detail dialogs | S18, S19, S20 |
| `/admin/analytics` | Client performance comparison | S21 |
| `/admin/analytics/demand` | Demand by city | S22 |
| `/admin/content` | Description moderation + editor | S26 |
| `/admin/billing` | Subscriptions & SaaS invoices | S29 |
| `/admin/audit` | Platform audit log | S27 |
| `/admin/settings` | General, plans, permission matrix, integrations | S28 |

Header overlays from S30 (notification popover, profile menu) live in
`components/admin/layout/topbar.tsx`.

---

## Components

### Reused from the extranet — not duplicated

`StatCard` · `StatGrid` · `StatusPill` · `DeltaBadge` · `SectionCard` ·
`PageHeader` · `ConfirmDialog` · `ActionButton` · `Icon` · `BarChart` ·
`Breadcrumbs`, plus the 27 shadcn primitives in `components/ui/*` and the
`format` / `images` helpers. Re-exported through
`components/admin/shared/index.tsx` so screens have one import.

### Refactored so both surfaces share one implementation

| File | Change |
|------|--------|
| `components/shared/app-sidebar.tsx` | **New.** Collapse/submenu/badge/active logic extracted from the extranet sidebar. Both surfaces pass their own nav, brand and footer. |
| `components/extranet/layout/sidebar.tsx` | Now a thin wrapper over `AppSidebar`. Behaviour unchanged. |
| `components/extranet/shared/breadcrumbs.tsx` | Took `nav` + `root` props (defaulting to the extranet's) instead of hard-importing the extranet nav. |
| `components/extranet/shared/page-header.tsx` | Passes `breadcrumbNav` / `breadcrumbRoot` through. |

### New and reusable

| Component | Why |
|-----------|-----|
| **`components/shared/data-table/`** | No table abstraction existed — all ~40 extranet tables are hand-rolled markup. Provides sort, search, faceted filters, pagination, bulk selection, column visibility, sticky header, and built-in loading/empty/error states. Powers 12 screens. The extranet can adopt it. |
| `components/shared/states/` | `EmptyState`, `ErrorState`, `PermissionDenied`, `NothingSelected` — **none of these existed in the Figma** (0 of 30 artboards). |
| `components/ui/form.tsx` | shadcn `Form` for Base UI. Upstream ships against Radix (`Slot`, Radix Label); this uses `cloneElement` + the local `Label`. |
| `components/admin/shared/` | `AdminPageHeader`, `Money`, `DescriptionList`, `StarRating`, `CellStack`, `InfoNote` |
| `components/admin/role-provider.tsx` | `useCan()`, `RoleGate`, and the dev role switcher |

### Screen-local

Each route's `_components/` folder. Notable: `ApprovalPanel` (state machine),
`GenerateInvoiceDialog` (two-step), `InboxView` (three-pane), `ReviewCard`,
`PermissionMatrix`.

---

## RBAC

Defined in `lib/admin/rbac.ts`, enforced in two places:

- **Section level** — `AdminRouteGuard` in the layout. `canView` hides the nav
  item and blocks the route.
- **Control level** — `useCan().do("property.approve")` / `<RoleGate>` inside
  screens, for narrower actions.

`/admin/settings` renders the live matrix, so what you see is what the app
enforces.

There is no auth. The topbar has a **dev-only role switcher** that persists to
`localStorage`. When real sessions land, seed the role in `AdminRoleProvider`
and delete `setRole` — every `useCan()` call site keeps working.

---

## Data layer

```
components  →  lib/admin/api/hooks.ts     (react-query)
            →  lib/admin/api/endpoints.ts (typed API surface)
            →  lib/admin/api/transport.ts (the swap seam)
            →  lib/admin/api/store.ts     (in-memory mutable DB)
            →  data/admin/*               (immutable fixtures)
```

Screens never import `data/admin` for anything they mutate.

**To attach a real backend:** reimplement `request()` in `transport.ts` with
`fetch`. Endpoint signatures, hooks and components stay unchanged.

Two env vars make the states reachable in development:

```bash
NEXT_PUBLIC_ADMIN_MOCK_LATENCY=320       # ms; 0 for instant
NEXT_PUBLIC_ADMIN_MOCK_FAILURE_RATE=0.2  # 0–1; exercises every ErrorState
```

Mutations write to the in-memory store, so approving a property or suspending a
guest persists for the session and is visible on every screen — including the
audit log, which prepends your session's actions.

---

## What's mocked vs real

**Real:** routing, RBAC, all form validation (react-hook-form + zod), table
sort/search/filter/pagination/bulk actions, the property approval state machine,
invoice computation (commission + per-country tax), optimistic cache
invalidation, every loading/empty/error/no-permission state, dark mode.

**Mocked:** all data (`data/admin/*`); no auth or sessions; no persistence
across reloads; video playback, PDF/CSV export, receipts, email reminders and
integration connections are toast-only stubs; images are Unsplash placeholders.

---

## Known gaps

Carried from the Phase 1 audit, not built:

- No admin login / 2FA screen (no auth layer exists yet).
- The 6 integrations toggle state but connect to nothing.
- Client and guest detail screens were designed by us — they have no Figma
  reference and should be reviewed.
- **Not yet verified by clicking through in a browser.** Verified so far: clean
  typecheck / lint / production build; all 25 route variants return 200 with no
  error markers; and 21 data-consistency assertions pass against the live
  modules (counts reconcile across every screen, no orphan foreign keys, no PKR
  residue, the approval state machine rejects the Figma's contradictory
  transitions, and the four roles resolve to genuinely different access —
  15/13/9/12 of 15 sections). What that does *not* cover is hydration,
  client-side react-query fetching, dialog focus traps and keyboard nav.

---

## Commands

```bash
npm run dev        # http://localhost:3000/admin
npm run typecheck
npm run lint
npm run build
```
