# Stayora — Data-Flow & Alignment Fix Plan

**Date:** July 15, 2026
**Input:** `AUDIT-REPORT.md` (all findings referenced below by section, e.g. §1.1)
**Goal:** one connected product — everything shown is collected somewhere, every action reflects everywhere, no screen contradicts another.

## Approved decisions (locked)

| Decision | Choice |
|---|---|
| Data layer | **zustand v5 store** (already installed) seeded from `src/data`, **persisted to localStorage** (versioned key `stayora-store-v1`) + "Reset demo data" action |
| New UI components | **Build now** using the existing design system (shadcn/base-nova, theme tokens); re-polish later when Figma updates arrive |
| Extranet portfolio | **Aurora Hospitality manages 5 of the 10 public hotels** (mapping table below) — extranet data rewritten onto real catalog hotels |
| Sync depth | **Full sync** — extranet edits (policies, descriptions, rates, promotions, value-adds, photos) reflect on the public site |

## Architecture (the foundation everything sits on)

### One store, three surfaces

```
src/store/
  index.ts            → createStore + persist(localStorage, v1) + resetDemo()
  seed.ts             → builds initial state from src/data/* (pure function, deterministic)
  slices/
    hotels.ts         → catalog + partner-editable content (policies, description, address, photos, rates)
    bookings.ts       → ONE booking list (dashboard reads own, extranet reads Aurora hotels')
    reviews.ts        → ONE review list keyed by hotelId (public/dashboard/extranet all read it)
    favorites.ts      → saved hotelIds
    notifications.ts  → customer + partner feeds, derived unread counts
    tickets.ts        → support tickets, all three surfaces
    promotions.ts     → promotions, genius, value-adds, tax config
    profile.ts        → user identity, settings
```

- **Hydration safety:** persist with `skipHydration` + a `<StoreHydration/>` client boundary in providers — prevents SSR/localStorage mismatch (screens render seed state on server, rehydrate on client).
- **Client boundaries:** pages stay server components where possible; any component displaying *mutable* data becomes a small client leaf (pattern already used: `_components/`).
- **Reset:** `resetDemo()` clears localStorage and re-seeds — exposed in dashboard Settings and extranet account page.

### One domain model (`src/types/index.ts` — replace the 3 parallel shapes)

- **`Booking`** — `id: "STY-XXXXXX"`, `hotelId`, `roomId`, `guest {firstName, lastName, email, phone}`, `checkIn/checkOut`, `guests`, `arrivalTime`, `specialRequests`, `addOns[]`, `pricing {subtotal, taxLines[], total}`, `status`, `source: "Direct"`, `createdAt`, `cancellation? {date, reason, refund, refundStatus}`. Kills the three incompatible shapes (§3-D5) and three ID schemes (§0).
- **`BookingStatus`** — single enum `confirmed | pending | checked_in | checked_out | completed | cancelled` + one shared `<StatusBadge/>` used by dashboard AND extranet (kills the 4 vocabularies, §3-D1).
- **`Review`** — `id`, `hotelId`, `bookingId?`, `author`, `rating /5`, `categories {cleanliness, comfort, location, facilities, staff}`, `title`, `body`, `date`, `status: published|pending|rejected`, `response? {text, date}`. One scale: **/5 everywhere** — delete the fabricated /10 (§4-A4); extranet /100 stays only as "page completeness score", relabeled (§4-D1).
- **`Hotel`** — extended with `address`, `checkInTime/checkOutTime`, `policies {pets, smoking, payment, cancellation}`, `managedBy?: "aurora"`, structured `discount? {type: percent|amount|freeNight, value}` (kills string-stripping badges, §6-A4). `rating`/`reviewCount` become **derived selectors** from the review slice (kills the fake 4.9/2847, §4-D2).

### Aurora portfolio mapping (applied mechanically across ALL extranet data files)

| Old extranet property | Becomes (public hotel) |
|---|---|
| Grand Horizon (Malibu) | **The Ritz-Carlton** (New York) — flagship/"active" property |
| The Metropolitan (Chicago) | **Four Seasons** (Paris) |
| Casa del Mar (Tulum) | **One&Only** (Maldives) |
| Sakura Ryokan (Kyoto) | **Aman Tokyo** (Tokyo) |
| Alpine Lodge (Zermatt) | **The Peninsula** |

Files to rewrite with this table: `properties.ts`, `reservations.ts`, `engagement.ts`, `inbox-detail.ts`, `notifications.ts`, `finance*.ts`, `rates-detail.ts`, `property-detail.ts`, `property-extra.ts`, `account*.ts` — every property name, city, and seed.

---

## Phase 0 — Safety net (before touching anything)

1. Create branch `fix/data-flow-alignment`.
2. Baseline: `npm run typecheck && npm run lint && npm run build` — record green state.
3. Commit after every phase; typecheck must be green before each commit. **This is the "no chance of mistake" mechanism: small phases, verified gates, revertible commits.**

## Phase 1 — Foundation (no visible change yet)

1. Write the unified types (above).
2. Build `src/store/` slices + `seed.ts` + persist + hydration boundary in `src/components/providers/index.tsx`.
3. `resetDemo()` action.
4. **Gate:** typecheck green; app renders identically (store not consumed yet).

## Phase 2 — Data unification (rewrite the dummy data once, correctly)

Fixes audit §0 and every "demo content contradiction":

1. **`hotels.ts`:** unique reviews per hotel (moved to review seed — kills shared `defaultReviews`, §4); per-hotel distinct room sets (Aurora hotels get the extranet's richer 6-room taxonomy — kills §2-D5); add address, check-in/out, policies, structured discount; delete `originalPrice`/`discountLabel` strings.
2. **`dashboard.ts` → booking seed:** every booking references a REAL catalog hotel (replace Marina Bay Sands, Atlantis, "Four Seasons Maldives" — §5-D1); totals recomputed as `rate × nights + tax` (kills $2,850 vs $3,118, §3-D2); STY- ids; enum statuses; John Doe books **Aurora hotels** so his bookings/reviews appear on the extranet side too; one email `john.doe@example.com` everywhere (§5-D3); stats (saved count, upcoming trips) become derived selectors (kills 4-vs-6, §5-C3).
3. **Extranet data:** apply the Aurora mapping table everywhere; reservations/cancellations become **one** booking list (cancelled = `status: cancelled` with `cancellation` record — kills the two disjoint datasets, §3-C); fix all internal contradictions in the seed: check-out **12:00 PM** in all three places (§2-D1), pets **allowed $35** everywhere (§2-D2), ONE Grand-Horizon→Ritz description (§2-D3), commission **12%** everywhere with Preferred labeled "requires ≥15%" (§6-D2), pending-review counts derived (§4-D3), team list = contacts list (§5-D6), delete "Aurora Bay Resort" + "James Carter"→"James Chen" (§5-D6).
4. **Gate:** typecheck; seed loads; every screen still renders with the new consistent data.

## Phase 3 — Core booking flow (audit P0 — §1)

1. **Merge `/property/[id]` into `/hotels/[id]`** (§1.1): single-scroll superset layout becomes THE detail page at the `/hotels/[id]` URL; delete the `/property` route; all links already point to `/hotels`. While merging: house rules read `hotel.policies` (data-driven), rating-category bars read derived review-category averages, real `hotel.address` in Location, 5 amenity chips, remove the fake urgency banner, fix the Base UI Select `items` prop bug in the booking widget (known latent bug — SelectValue shows raw value without it).
2. **Booking widget → checkout:** dates + guests + selected room + live subtotal/tax/total (from tax config) → `/checkout?` params; date picker enforces open/close availability + min-stay (sold-out state when closed) (§6-C).
3. **Checkout:** prefill logged-in profile (§5-D2); add **Arrival time** field (§3-A); add **Add-ons** step fed by the hotel's value-adds (§6-B); on confirm → `store.createBooking(...)` with ALL fields (phone, lastName, country, requests, add-ons, tax lines, total) — kills every "collected but dropped" item (§3-B).
4. **Confirmation:** reads the booking from the store by ref (no URL-param reconstruction, no recomputed total — §1.2); shows full tax breakdown, phone, requests, full-name greeting, policy check-in/out times.
5. **Dashboard bookings** read the store; **cancel** sets `status: cancelled` + cancellation record + notification; **modify** updates dates/guests + reprices; both render result states (§1.3).
6. **Extranet reservations** = store bookings for Aurora hotels (guest phone/requests/arrival now shown — §3-A); **Cancellations screen** = derived `status === cancelled` list with refund status. A booking made on the site appears here; a cancel on either side reflects on both.
7. **Gate:** manual walkthrough — book Ritz-Carlton as John Doe → confirmation → dashboard shows it → extranet shows it → cancel from dashboard → extranet cancellations shows it. Typecheck + build green.

## Phase 4 — Every action becomes real

1. **Favorites** (§5-C1-3): heart toggle on `HotelCard`, result card, detail page → favorites slice; favorites page reads store + empty state; sidebar/stat counts derived.
2. **Reviews** (§4): "Write a review" form (react-hook-form + zod — both installed) on completed bookings — rating, 5 category ratings, title, text; public reviews section reads store (`published` only — moderation now matters, §4-C4); partner Reply mutates `review.response` → renders under the review publicly AND in My Reviews (§4-C1); Approve/Reject mutate status; "Verified Guest" badge only when review has a `bookingId`.
3. **Notifications** (§5-C4): bell + unread badge in site header, dashboard header, (extranet already has one); mark-all-read mutates store; booking/cancel/review events push notifications to both customer and partner feeds.
4. **Support tickets** (§5-B1): submit → tickets slice → "My tickets" list with status on public support + dashboard support; extranet Generate Ticket appends to the same list; replies append to a thread.
5. **Profile/Settings:** editable fields persist; avatar change control (seed swap); settings toggles persist; signup writes the profile (name split done once at signup — §5-A5).
6. **Gate:** walkthrough — favorite from card → dashboard favorites; write review from completed booking → hotel page shows it → extranet reply → visible in My Reviews; ticket → appears in list; bell counts move.

## Phase 5 — Full sync: extranet edits → public site (approved scope)

1. **Property content:** edit dialogs for details/policies/descriptions mutate the hotel record → public About, house rules, address, check-in/out update live. The three description screens edit the SAME field.
2. **Rates:** room rate edits update `room.pricePerNight` → public prices; open/close + min-stay drive the public date picker; room inventory drives sold-out.
3. **Promotions** (§6-B): activating a promotion sets the hotel's structured `discount` → public badge + strikethrough derive from it (percent/amount/free-night variants); deactivating removes it. Genius/Preferred/Mobile render as badge variants on cards when enabled.
4. **Value-adds:** extranet value-add list = checkout add-ons source (already wired in 3.3 — this makes edits flow).
5. **Tax config** (§6-D1): extranet VAT screen edits the tax config; reserve card, checkout, confirmation, and extranet invoices all compute from it — delete the three hardcoded `TAX_RATE = 0.12` constants; breakdown lines (VAT, service, city tax, resort fee) shown at checkout.
6. **Photos:** extranet photo list (seeds/captions) drives the public gallery order.
7. **Gate:** walkthrough — change check-out time in extranet → detail page updates; create 20% promotion → card badge appears; close dates → widget blocks them.

## Phase 6 — Polish & cleanup (audit P2 leftovers)

1. **Filters** (§2-D6): rating buckets 4.5+/4.0+/3.5+; apply the room-type filter in the loop; property-type options = Hotel/Resort; add Beach amenity option.
2. **Brand/copy:** remove "PKR" from header (USD everywhere); purge "LuxeStay"/`LXS-` (§5-D4); fix "Rewards page" FAQ copy (§5-D5); extranet topbar Settings gets its own target (§5-D6).
3. Confirmation greeting full name; delete dead fields (`UserReview.city`, `badge`, `location/joined`) or render them; hero search passes dates+guests → listing summary bar (§6-C).
4. **Gate:** lint + typecheck + build green; grep sweep confirms zero `LuxeStay|LXS-|PKR|TAX_RATE` leftovers, zero `toast.success` calls that aren't backed by a store mutation.

## Phase 7 — Full re-verification (the "check everything again" pass)

1. `npm run typecheck && npm run lint && npm run build` — all green.
2. **End-to-end scenario matrix** (each run manually in the browser):
   - Book → confirm → dashboard → extranet → cancel (each direction) → refund status visible.
   - Review lifecycle: write → public → partner reply → moderation → customer sees reply.
   - Favorite → unfavorite → counts.
   - Promotion → badge → price math at checkout includes it → invoice consistent.
   - Extranet content edit → public reflection (description, policy, rate, close-out).
   - Refresh mid-flow → localStorage state intact; Reset demo → clean seed.
3. **Fresh cross-surface audit:** re-run the same 5 audit chains (hotel content, booking lifecycle, reviews, identity/support, pricing) with fresh agents against the fixed code. **Target: zero Category A/B/C/D findings.**
4. Route sweep: no orphan pages, no dead links, no console errors on any of the ~80 screens.

---

## Audit coverage matrix (every finding → its fix)

| Audit finding | Fixed in |
|---|---|
| §0 three data universes | Phase 1–2 (store + Aurora mapping) |
| §1.1 orphaned /property, unbookable /hotels | Phase 3.1–3.2 |
| §1.2 checkout creates nothing | Phase 3.3–3.4 |
| §1.3 toast-only mutations (all) | Phases 3.5–3.6, 4.1–4.5, 5.1–5.6 |
| §2-A shown-never-collected (address, house rules, category bars, urgency, discounts, photos) | Phases 2.1, 3.1, 5.3, 5.6 |
| §2-B extranet content never public (facilities, VAT, policies, descriptions, inventory) | Phase 5.1–5.5 |
| §2-D contradictions (check-out, pets, descriptions, amenities shape, room types) | Phase 2.3 (data) + 5.1 (live) |
| §2-D6 filter bugs | Phase 6.1 |
| §3-A/B checkout field drops, arrival time | Phase 3.3–3.4 |
| §3-C cancel/modify not reflected, disjoint cancellations | Phase 3.5–3.6 |
| §3-D status vocabularies, price math, tax breakdown, booking shapes | Phases 1 (types), 2.2, 3.4, 5.5 |
| §4 reviews (no form, reply invisible, scales, fake aggregates, moderation) | Phase 4.2 + 2.1 |
| §5 identity/favorites/notifications/support/profile | Phases 2.2, 4.1, 4.3–4.5, 6.2–6.3 |
| §6 promotions/genius/value-adds/availability/tax/commission/currency | Phases 5.2–5.5, 2.3, 6.2 |

## Risks & how the plan neutralizes them

| Risk | Mitigation |
|---|---|
| SSR hydration mismatch with localStorage | `skipHydration` + client hydration boundary (Phase 1, done once, tested first) |
| Big-bang breakage | 7 phases, each gated by typecheck/build + walkthrough, each a separate commit |
| Stale localStorage after schema changes | versioned persist key; version bump = auto reset to seed |
| Extranet data rewrite misses a reference | mapping applied by grep sweep per old property name; Phase 7 fresh audit catches leftovers |
| Next 16 API differences | consult `node_modules/next/dist/docs/` before route/layout changes (per AGENTS.md) |
| Regression in visual design | no visual redesign in this plan — only wiring + data; new components use existing tokens/shadcn patterns |

## Suggested execution order & rough effort

Phases are strictly sequential (each builds on the previous). Rough relative size: Phase 2 and Phase 3 are the big ones (~30% each); Phases 4–5 ~15% each; 0–1, 6–7 the rest. Everything is dummy-data/client-side — no backend, no new dependencies.
