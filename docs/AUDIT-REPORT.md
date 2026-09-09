# Stayora — Cross-Surface Data Consistency Audit

**Date:** 2026-07-14
**Scope:** Public site (`src/app/(site)`) · Customer dashboard (`src/app/dashboard`) · Partner extranet (`src/app/extranet`) — ~80 screens traced end-to-end across 5 flow chains: hotel content, booking lifecycle, reviews, account/support, pricing/promotions.

**Goal:** verify that every piece of information *shown* on one surface is actually *collected/managed* somewhere, that actions performed on one surface *reflect* on the others, and that screens do not contradict each other.

**Finding categories used throughout:**

- **A — Shown but never collected:** displayed data that no form or management screen anywhere provides.
- **B — Collected but never shown:** data a user/partner enters that nothing ever displays.
- **C — Action not reflected:** an action performed on one screen with no effect anywhere.
- **D — Mismatch:** the same concept represented with different values/shapes on different screens.

---

## 0. Root cause: three disconnected data universes

Almost every finding traces back to one structural problem — each surface has its own hardcoded dataset, and none of them reference each other:

| Surface | Data source | World it describes |
|---|---|---|
| Public site | `src/data/hotels.ts:57-216` | 10 hotels: the-ritz-carlton, burj-al-arab, aman-tokyo, four-seasons, one-and-only, the-peninsula, st-regis, mandarin-oriental, the-plaza, six-senses |
| Customer dashboard | `src/data/dashboard.ts` | John Doe (john.doe@example.com, Gold Member) — his bookings, trips, reviews, notifications |
| Partner extranet | `src/data/extranet/*` | "Aurora Hospitality" (Sarah Mitchell) — 5 different properties: Grand Horizon (Malibu), The Metropolitan (Chicago), Alpine Lodge Zermatt, Casa del Mar (Tulum), Sakura Ryokan (Kyoto) |

- No hotel ID, property name, guest name, booking ID, or review is shared between the three datasets.
- Verified by grep: `src/app/(site)/**` and `src/components/**` never import `@/data/extranet`; `src/app/extranet/**` never imports the public hotel data.
- **Consequence:** nothing a partner manages in the extranet can ever reach a public page (rates, photos, policies, amenities, promotions), and nothing a customer does can ever reach the partner (bookings, cancellations, reviews). Three booking-ID schemes coexist: checkout generates `STY-XXXXXX`, dashboard uses `b1–b4`, extranet uses `RSV-88xx`.

---

## 1. Critical flow breaks (P0)

### 1.1 Customers cannot book from the reachable hotel page

Two detail pages exist for the **same** hotel entity (both call `getHotel(id)`):

- **`/hotels/[id]`** — reachable: every card and link in the app targets it (`hotel-card.tsx:59`, `result-card.tsx:103`, `favorites/_components/favorite-card.tsx:38`, `checkout/page.tsx:45`). But its booking widget is a dead end — "Check Availability", WhatsApp, and Call buttons only fire toasts (`booking-widget.tsx:88, 119, 127`), it shows a static "Select a room to see total price / 0" (`:111-112`), and it never links to `/checkout`.
- **`/property/[id]`** — orphaned: a dedicated grep found **zero** links pointing to `/property/` anywhere in the app. Yet it is the **only** page wired to checkout (`reserve-card.tsx:178-187`). Its own "Similar Properties" cards link back out to `/hotels/`.

So the bookable page is unreachable and the reachable page is unbookable. The two pages also render the same entity differently (see §6.4).

### 1.2 Checkout creates no booking record anywhere

- `confirm()` builds a URL query string and routes to the confirmation page (`checkout-flow.tsx:117-135`). Nothing is written to dashboard bookings or extranet reservations.
- The confirmation page reconstructs everything from URL params and **recomputes the total itself** (`confirmation/page.tsx:52-53`) instead of receiving the amount the user approved.
- "View My Bookings" (`confirmation/page.tsx:149`) links to the static dashboard list that will never contain the booking just made.

### 1.3 Every mutation in the app is a toast-only no-op

All create/update/delete actions fire `toast.success(...)` and change no data:

- Dashboard booking **cancel** (`cancel-booking.tsx:44-53`) and **modify** (`modify-booking.tsx:58-69`) — the booking still renders "confirmed" on return.
- Extranet reservation **cancel** (`reservations-table.tsx:409-417`) — the row never appears on the Cancellations screen.
- Extranet **rate edit** (`calendar-view.tsx:235-239`, default hardcoded `189` at `:227`), promotions/value-adds/VAT dialogs (`vat-tax-view.tsx:145-149`), Genius/Preferred "Join" (`boost/genius/page.tsx:62-72`, `boost/preferred/page.tsx:36-47`).
- Review **reply / approve / reject** (`review-actions.tsx:55-90`).
- Favorites **"Remove from saved"** (`favorite-card.tsx:28-33`).
- Support **ticket creation** on all three surfaces (see §5.2).
- Dashboard **settings toggles + currency select** — static `defaultChecked`/`defaultValue`, no handlers (`settings-list.tsx:31-75`).

---

## 2. Chain: Hotel content (public detail pages ↔ extranet property management)

### A — Shown publicly but never collected/managed anywhere

1. **Street address** — `hotel-tabs.tsx:23` hardcodes `"50 Central Park South, {city}, {country}"` for every hotel. The public `Hotel` type (`src/types/index.ts:27-44`) has no address field; no extranet screen collects one.
2. **House rules** on `/property/[id]` — check-in/out times, cancellation, payment method, pets "Not allowed", smoking — hardcoded inline (`property/[id]/page.tsx:47-54`), not sourced from the extranet policies screens that exist for exactly this purpose.
3. **Rating category bars** (Cleanliness 4.9, Comfort 4.8, Location 4.9, Facilities 4.7, Staff 5.0) — hardcoded (`property/[id]/page.tsx:56-62`); no review form collects category ratings anywhere in the app.
4. **Urgency banner** "In high demand — booked 18 times in the last 24 hours" — hardcoded literal (`property/[id]/page.tsx:167-174`), not derived from the extranet availability data that would justify scarcity.
5. **Room `features`** ("City View", "Free WiFi", "Smart TV") — from `hotels.ts:10,19`; the extranet room-types screen uses a different `amenities` field and never feeds these.
6. **Discount fields** `originalPrice` / `discountLabel` ("15% OFF") — hardcoded on 4 hotels (`hotels.ts:155-157, 172-173, 189-190, 205-207`); no extranet screen manages a public discount.
7. **Booking-widget marketing copy** — "BEST PRICE GUARANTEE", "Free Cancellation… 24 hours", guest/room options, default dates 2026-06-25/27 — all hardcoded (`booking-widget.tsx:24-29, 45-48, 56, 63, 96-98`; `reserve-card.tsx:70-73`).
8. **Gallery photos** — procedurally generated from `hotel.seed` (`hotel-gallery.tsx:22-28`, `property-gallery.tsx:14-16`); the extranet Photos screen exists but its photos feed nothing.

### B — Managed in extranet but never shown publicly

(All of these are structurally unreachable because of the disjoint universes; the notable ones:)

1. **Facilities & Services** — 6 categories, ~40 toggles (`property-extra.ts:32-110`; `facilities/page.tsx`). The public section literally titled "Amenities & Facilities" renders only the flat `hotel.amenities` (`property/[id]/page.tsx:243-257`).
2. **Room amenities** — ~45 toggles (`property-detail.ts:109-167`) — never surfaced.
3. **VAT / Tax / Charges config** — VAT/GST 10%, City Tax $3.50/person/night, Resort Fee $25/room/night, Service Charge 5%, Tourism Levy 2% (`vat-tax-view.tsx:39-80`) — the public checkout hardcodes a flat 12% instead (§6.2).
4. **Policies (9) + Reservation policies (10)** (`property-detail.ts:185-240`; `property-extra.ts:114-125`) — never shown; the public page hardcodes its own 6 house rules.
5. **Descriptions** — 5 multi-language, scored descriptions (`descriptions-view.tsx:32-74`) — never shown; all 10 public hotels share one generic description constant (`hotels.ts:54-55`).
6. **Property meta** — floors, year built, renovated, timezone, parking, contact phone/email/website, languages (`property/page.tsx:44-62`) — never public.
7. **Room inventory** — units/booked/available per room type (`property-detail.ts:9-100`) — never public; no sold-out state exists anywhere.

### D — Mismatches

1. **Check-out time contradicts itself inside the extranet:** property details say 12:00 (`property/page.tsx:49-50`; `edit-details-dialog.tsx:28-29`) but both policy screens say 11:00 AM (`property-detail.ts:195`; `property-extra.ts:115-116`). Public house rules hardcode 12:00 PM.
2. **Pets:** extranet says allowed at $35/night (`property-detail.ts:207`; `property-extra.ts:121`); public house rules say "Not allowed" (`property/[id]/page.tsx:52`).
3. **Three contradictory descriptions of Grand Horizon:** "beachfront resort… three signature restaurants" (`property/page.tsx:131-140`) vs "coastal retreat… two infinity pools" (`edit-details-dialog.tsx:23-25`) vs "city-center hotel… Luxury City Hotel" (`descriptions-view.tsx:38-39`) — a Malibu beach property described as a city hotel.
4. **Amenity naming/shape:** public flat `string[]` ("WiFi", "Breakfast") vs extranet grouped `{name, enabled}` objects ("Free WiFi", breakfast as a Food & Drink toggle).
5. **Room types:** public = the same 2 generic rooms for every hotel ("Deluxe King Room"/"Premier Suite", string sizes — `hotels.ts:3-22`) vs extranet = 6 rooms with numeric m², units, availability (`property-detail.ts:9-100`). Different names, fields, shapes.
6. **Hotels-page filter bugs** (`filters-panel.tsx`, `hotels-browser.tsx`):
   - 5-star filter can never match: `Math.floor(rating) >= s` with all ratings 4.6–4.9 (`hotels-browser.tsx:36`).
   - Room Type filter options are collected but **never applied** in the filter loop (`hotels-browser.tsx:33-48`).
   - Property Type offers Apartment/Villa/Boutique — data only contains Hotel/Resort.
   - "Beach" exists in data but is missing from the amenity filter options.

---

## 3. Chain: Booking lifecycle (checkout → confirmation → dashboard → extranet)

### Field inventories (what each step collects/shows)

- **Checkout collects** (`checkout-flow.tsx:59-72, 192-319`): firstName, lastName, email, phone, country/region, specialRequests, payMethod (card|property), cardName, cardNumber, cardExpiry, cardCvv, T&C agree — plus hotel/room/dates/guests from URL params.
- **`confirm()` forwards only** (`checkout-flow.tsx:122-133`): hotel, room, dates, guests, ref, `name = firstName` only, email, pay. **Dropped: phone, lastName, country, specialRequests, all card fields.**
- **Confirmation displays** (`confirmation/page.tsx`): firstName greeting, hotel, email, reference, pay status, city/country, dates + hardcoded "from 3:00 PM"/"until 12:00 PM" (`:112,115`), guests, payment method, room + nights, single total (no tax breakdown).
- **Dashboard booking displays** (`booking-card.tsx:52-63`): hotel, room, status, dates, guests, total. Shape (`types/index.ts:70-81`) has no guest/email/phone/breakdown.
- **Extranet reservation displays** (`reservations-table.tsx:151-190, 298-356`): id, guest, email, room, roomNo, dates, guests, source (Direct/Booking.com/Expedia/Travel Agency), status, total, property, createdAt, notes.

### A — Shown but never collected

- Arrival/departure clock times on confirmation — hardcoded; checkout never asks arrival time.
- "Paid"/"Confirmed" payment status — derived purely from `pay === "card"` (`confirmation/page.tsx:82`); no payment processed.
- Extranet guest email, roomNo, source, property, createdAt, notes — static data; the booking flow never provides them (and never creates extranet reservations at all).

### B — Collected but never shown

- **phone** — shown only transiently on the Review step (`:354-357`); absent from confirmation, dashboard, extranet.
- **country/region** — displayed nowhere after collection.
- **specialRequests** — shown on Review step only (`:368-370`); dropped on confirm; extranet `notes` is unrelated static text.
- **lastName** — used on Review step; confirmation greeting uses firstName only.

### C — Actions not reflected

- Dashboard cancel/modify: toast + redirect, no data change (§1.3).
- Extranet cancel: cancelled row never appears on the Cancellations screen.
- **The Cancellations screen is a fully separate static dataset** (`reservations.ts:248-369`): RSV-8827…8818, guests Daniel Kim, Grace Lee… — shares zero IDs and zero guest names with `reservations` (RSV-8842…8828, Emma Richardson…). `reservations` contains no `"Cancelled"` rows even though the type and UI filter support the status.
- Checkout → no booking record ties to the dashboard (§1.2).

### D — Mismatches

1. **Four status vocabularies for one concept:** dashboard `confirmed|pending|completed|cancelled` (`types/index.ts:68`) vs extranet `Confirmed|Checked In|Checked Out|Cancelled|Pending` (`lib/extranet/types.ts:35-40`) vs refund statuses `Full Refund|Partial|No Refund|Pending|Processed` (`types.ts:69`) vs confirmation's invented "Paid"/"Confirmed" strings.
2. **Dashboard totals don't reconcile with the site's own price math:** booking b1 = Ritz-Carlton Premier Suite × 3 nights, stored total **$2,850** (`dashboard.ts:57-67`); site math = round(580 × 1.6) = $928/night × 3 + 12% tax = **$3,118**.
3. **Tax breakdown disappears at confirmation:** reserve-card and checkout both show subtotal + "Taxes & fees" (12%); confirmation shows a single total only (`confirmation/page.tsx:135-139`).
4. **Price basis differs between the two detail pages:** `/hotels/[id]` widget shows `hotel.pricePerNight` (`booking-widget.tsx:107`) while checkout uses `room.pricePerNight` — they coincide only for the default room; any other room diverges.
5. **Incompatible booking shapes:** dashboard `Booking` has city+seed, no guest identity; extranet `Reservation` has guest/email/roomNo/source, no city; neither carries what checkout collects.

---

## 4. Chain: Reviews

### Foundation: three independent review datasets

- Public: `hotel.reviews` — every one of the 10 hotels reuses the **same** `defaultReviews` array of 3 reviews by "Alexandra Chen / Michael Torres / Emma Watson" (`hotels.ts:24-52`). Type `HotelReview` (`types/index.ts:18-25`).
- Dashboard: `userReviews` (`dashboard.ts:110-141`). Type `UserReview` (`types/index.ts:104-112`).
- Extranet: `reviews` (`data/extranet/engagement.ts:9-176`). Type `Review` (`lib/extranet/types.ts:125-138`).
- No shared IDs, guests, or properties across the three.

### A — Shown but never collected

1. **There is no review-writing UI anywhere in the app.** Dashboard "My Reviews" is display-only (`dashboard/reviews/page.tsx:5-19`) — no form, no rating input, no textarea, no edit/delete. The only review-adjacent input in the whole app is the partner's reply box.
2. Extranet review cards show **room stayed, booking ID, and title** (`reviews-list.tsx:170-174`) — fields no form collects and that don't exist on the other two review types.
3. Public "Verified Guest" badge is hardcoded JSX for every review (`hotel-tabs.tsx:185-189`); the stored `badge` field is dead.
4. Dashboard shows a **/10 score fabricated at render time** by doubling the 5-star value (`review-card.tsx:9-12, 41`).

### C — Actions not reflected

1. **Partner reply is invisible to guests:** `response` exists only in the extranet type/data and is rendered only there (`reviews-list.tsx:180-184`). Neither the public reviews section nor dashboard "My Reviews" has a reply concept.
2. Reply/Approve/Reject are toast-only no-ops (`review-actions.tsx:55-90`).
3. **Customer reviews never reach the hotel page:** John Doe's Ritz-Carlton review (`dashboard.ts:122-130`) does not appear on the public Ritz-Carlton page, which shows the shared `defaultReviews`.
4. Extranet moderation status (Pending/Flagged/Rejected) has no effect on the public page, which unconditionally renders its own set.

### D — Mismatches

1. **Three rating scales:** /5 public and extranet, /10 badge on dashboard (fabricated), /100 on extranet property score (`property/score/page.tsx:45-73`).
2. **Aggregate rating is fiction:** headline `rating: 4.9` / `reviewCount: 2847` are hardcoded per hotel (`hotels.ts:66-71`) above a list of the same 3 reviews (true avg 4.67, count 3).
3. **Extranet contradicts itself:** reviews page derives avg 4.3/5 and 3 pending from data (`engagement.ts:178-193`); the score page hardcodes "Average rating 4.2/5" and "4 pending reviews" (`property-extra.ts:18`).

---

## 5. Chain: Identity, favorites, notifications, support

### A — Shown but never collected

1. **Phone** on profile (`profile-form.tsx:38-44`) — signup collects only name/email/password (`signup/page.tsx:34-43`).
2. **Travel preferences** ("Luxury", "City", "Spa" pre-selected) — hardcoded initial state (`profile-form.tsx:47-61`).
3. **Avatar** — rendered in sidebar and profile, generated from seed; no upload/change control anywhere.
4. **"Gold Member" + 12,450 reward points** — sidebar/profile/stat card; no tier or earning flow exists.
5. **First/Last name split** on profile — hardcoded "John"/"Doe", not derived from signup's single full-name field.

### B — Collected but never shown

1. **All support forms are black holes:** public support form (`support-ticket-form.tsx:38-44`), dashboard support form (`support-forms.tsx:38-43`), "Message a Hotel" forms, extranet "Generate Ticket" (`generate-ticket-dialog.tsx:103-138`) and "New Message"/"Reply" — all collect full submissions and only toast. No surface renders a ticket list containing what was submitted; the extranet's fixed `supportTickets` list never gains the new ticket.
2. Login "Remember me" bound to nothing (`login/page.tsx:47`).
3. Dead profile data: `dashboardUser.location` and `.joined` defined but rendered nowhere.

### C — Actions not reflected

1. **No favorite/save action exists on any public surface** — no heart on grid cards, result cards, detail pages, or widgets. Nothing can put a hotel into dashboard favorites.
2. **Favorites page is a static slice:** `savedHotels = hotels.slice(0, 6)` (`favorites/page.tsx:7`); "Remove from saved" only toasts.
3. **Favorites count mismatch:** stat card says 4 saved (`dashboard.ts:21`); the page renders 6.
4. **No notification bell in either header;** the sidebar badge is the literal `2` (`dashboard-sidebar.tsx:31`). "Mark all as read" updates local state only and never changes the badge.
5. Settings toggles/currency mapped to nothing; currency change affects no prices (`format.ts:1-7` hardcoded USD).

### D — Mismatches

1. **Dashboard bookings/trips reference hotels that don't exist in the catalog:** "Marina Bay Sands" (b3), "Atlantis The Palm" (b4, review ur1, notification n3), "Four Seasons Resort, **Maldives**" (b2) vs the data's Four Seasons in **Paris**. Only Ritz-Carlton and Mandarin Oriental references are valid.
2. **Checkout doesn't prefill the logged-in identity** — starts blank with generic placeholders despite John Doe being the persona everywhere else.
3. **Email drift:** `john.doe@example.com` (profile) vs `john@example.com` (placeholders).
4. **Currency/brand leftovers:** site header hardcodes "PKR" (`site-header.tsx:51`) while all prices are USD; stale "LuxeStay" brand leaks via CSS class `luxestay-support` (`support/page.tsx:172`) and booking-ID placeholder "LXS-2026-00123" (`support-forms.tsx:155`) vs the STY- scheme.
5. **Support FAQ references a "Rewards page"** that doesn't exist in the dashboard sidebar (`support/page.tsx:139-141`).
6. **Extranet internal drift:** notification feed invents a sixth property "Aurora Bay Resort" (`notifications.ts:42`) and renames guests ("James Carter" alert = inbox's "James Chen" conversation); `teamUsers` vs `contacts` lists disagree on members (Tom Bergman vs Hiroshi Tanaka) and job titles; topbar "Account" and "Settings" both link to `/extranet/account` (`topbar.tsx:139-144`).
7. Positive note: within the extranet, reviews/inbox/communications are internally consistent (same 5 properties, same guests, RSV-88xx IDs, ticket cross-refs valid), and the extranet bell count is genuinely derived from data.

---

## 6. Chain: Pricing, promotions, availability

### A — Shown publicly but never managed

1. Discount badges/strikethroughs ("15% OFF", "Save 15%") — hardcoded on 4 hotels; rendered at `hotel-card.tsx:27-29, 49-53`, `result-card.tsx:40-44, 89-93, 109-113`, `reserve-card.tsx:60-64`. The extranet's three discount systems (promotions, Genius, mobile rates) are separate data that never feed these fields.
2. "BEST PRICE GUARANTEE"/"Best Price" badges — hardcoded.
3. "Breakfast" amenity chip — from `hotels.ts` amenities; unrelated to the extranet's paid Breakfast value-add.
4. Discount labels are **reverse-engineered from display strings**: `result-card.tsx:42-43, 111` strip non-digits from `discountLabel` to derive "Save X%" — a non-percentage promo (e.g. "$50 off") would render nonsensically.

### B — Managed in extranet but never shown publicly

Grep for genius/preferred/mobile-rate/value-add/promotion across public code = zero matches. Never surfaced:

- **Promotions** — Early Bird 20%, Summer Getaway $50 off, Last Minute 35%, Loyalty 10%, Stay-Longer 15% (`operations.ts:80-141`).
- **Genius tiers** — 10/15/20% off + badge (`promotions-detail.ts:71-109`).
- **Preferred Partner** badge (`promotions-detail.ts:113-122`).
- **Mobile-only rates** 25–35% off (`rates-detail.ts:144-150`).
- **Value-adds** — Airport Transfer $65, Early Check-in $35, Spa $120, Champagne $85… (`rates-detail.ts:154-165`) — no ancillaries at checkout, only a free-text box.
- **Min-stay/restrictions** (`rates-detail.ts:96-103`) — the public widget accepts any date range.
- Per-night calendar rates, open/close, pricing-per-guest, country/currency rates, long-stay modules — none consumed publicly.

### C — Actions not reflected

- Extranet rate edit / promotion dialogs / Genius join: toast-only (§1.3).
- Public "Check Availability" never reads availability data; no sold-out or date validation anywhere.
- **Hero search discards dates & guests:** collects check-in/out + guest counts but pushes only `?city=` (`hero-search.tsx:56-68`).

### D — Money mismatches

1. **Tax:** public flat 12% hardcoded in three independent files (`reserve-card.tsx:31`, `checkout-flow.tsx:36`, `confirmation/page.tsx:21`) vs extranet's configured VAT 10% + Service 5% + Tourism 2% + City Tax + Resort Fee (`vat-tax-view.tsx:39-80`) vs extranet invoices implying ~8% (`finance-detail.ts:114`). The `/hotels` widget shows no tax at all.
2. **Commission stated three ways:** 12% (transactions/commission reports, `finance-detail.ts:37, 60-69`), 12.4% (KPI, `finance.ts:15-20`), 15% (Preferred criterion, `promotions-detail.ts:117`).
3. **Currency:** extranet country-rates are multi-currency (GBP/EUR/JPY/AUD/CNY/KRW — `rates-detail.ts:127-140`); the public site is USD-only (`format.ts:1-7`), and checkout's country field never affects price or currency.
4. **No like-for-like price mapping is possible** — extranet ADR $189–$541 on properties that have no public listing; public prices $383–$1,500 on hotels the partner doesn't manage; room taxonomies don't correspond.

---

## 7. Recommended fix plan (priority order)

### P0 — Make the core flow work

1. **Merge `/property/[id]` into `/hotels/[id]`** (property page is the functional superset: house rules, tax math, room selector, working reserve card) and delete the orphan route. Keep all inbound links on `/hotels/[id]`.
2. **Wire the booking flow:** detail page carries dates/guests/selected room → `/checkout` → on confirm, create a booking record in a shared store → it appears in dashboard bookings (and extranet reservations for the managed hotels).

### P1 — One shared data model

3. **Unify the universes:** make the extranet portfolio a subset of `hotels.ts` (same IDs — e.g. Aurora Hospitality manages 3–4 of the 10 public hotels); align dashboard booking/review/notification references to real catalog hotels.
4. **Introduce a client-side store** (React context or zustand, seeded from `src/data`) so mutations become real: cancel/modify updates status on both surfaces, extranet cancel moves rows to Cancellations, favorites add/remove works from public heart buttons, review replies appear under public reviews, "mark all read" drives the badge count.
5. **One booking shape + one status vocabulary + one ID scheme** shared by checkout, dashboard, and extranet.

### P2 — Field alignment & contradictions

6. Forward phone/lastName/country/specialRequests through checkout to confirmation; prefill logged-in identity; pass the approved total instead of recomputing.
7. Add a review-writing form (dashboard, post-stay) whose fields match what public pages display; derive `rating`/`reviewCount` from the review set.
8. Source tax from one config (the extranet VAT data); show the breakdown on confirmation.
9. Fix filters: 5-star matching, apply the room filter, align property-type/amenity options with data.
10. Resolve contradictions: check-out 12:00 vs 11:00, pets policy, the three Grand Horizon descriptions, commission 12/12.4/15, favorites 4 vs 6, pending reviews 3 vs 4, team vs contacts lists, notification persona names.
11. Cleanup: PKR label, LuxeStay/LXS leftovers, dead "Rewards page" FAQ reference, email drift, hardcoded street address, /10 fabricated score.
