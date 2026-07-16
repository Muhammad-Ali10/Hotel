# Stayora — Figma Fix List (Screen by Screen)

**Date:** July 15, 2026 · **For:** UI/UX Designer · **Portals:** Public Website · Customer Dashboard · Partner Extranet

## How to use this document

Every section below = **one screen in Figma**. Every line is one fix, written as:

> ❌ **Now:** what is currently wrong → ✅ **Fix:** exactly what to design/change

Priority tags: 🔴 = must fix (breaks the user journey) · 🟡 = should fix (screens contradict each other) · 🟢 = minor (content/polish)

Tick the checkbox when the Figma frame is updated.

---

## Screen index — where the work is

| # | Screen | Portal | Fixes | Top priority |
|---|--------|--------|-------|--------------|
| 1 | Hotel Detail Page | Website | 8 | 🔴 |
| 2 | Hotel Card (component) | Website | 3 | 🟡 |
| 3 | Hotels Listing + Filters | Website | 4 | 🟡 |
| 4 | Home — Hero Search | Website | 1 | 🟡 |
| 5 | Checkout | Website | 4 | 🔴 |
| 6 | Booking Confirmation | Website | 4 | 🟡 |
| 7 | Support | Website | 3 | 🟡 |
| 8 | Site Header (component) | Website | 2 | 🟡 |
| 9 | Signup | Website | 1 | 🟡 |
| 10 | Dashboard Home | Dashboard | 2 | 🟢 |
| 11 | My Bookings + Cancel/Modify | Dashboard | 3 | 🟡 |
| 12 | My Reviews | Dashboard | 4 | 🔴 |
| 13 | Favorites | Dashboard | 1 | 🟡 |
| 14 | Notifications + Support | Dashboard | 2 | 🟡 |
| 15 | Profile & Settings | Dashboard | 3 | 🟢 |
| 16 | Reservations + Cancellations | Extranet | 3 | 🟡 |
| 17 | Reviews + Property Score | Extranet | 3 | 🟡 |
| 18 | Rates / Promotions / Boost | Extranet | 2 | 🟢 |
| 19 | Finance | Extranet | 1 | 🟢 |
| 20 | Property Details / Policies / Descriptions | Extranet | 4 | 🔴 |
| 21 | Account / Team / Topbar | Extranet | 3 | 🟢 |

**Plus:** 12 new components/screens to design (list at the end) + 6 one-time design-system decisions.

---

# PUBLIC WEBSITE

## Screen 1 — Hotel Detail Page 🔴

The biggest problem in the whole product: **two different designs exist for the same hotel detail page.**
- **Version A** (tab layout: About / Amenities / Rooms / Reviews / Location tabs) — this is the one users reach, but its booking box CANNOT book (only "Check Availability" + WhatsApp + Call buttons).
- **Version B** (single long-scroll page with house rules, rating bars, price breakdown, room selector, similar hotels) — this one CAN book, but no link in the app leads to it.

- [ ] 🔴 **1.1 Merge into ONE detail page.**
  ❌ Now: two conflicting designs. → ✅ Fix: keep **Version B's single-scroll layout** as the final design (it is more complete). Delete/retire the tab version. This becomes THE hotel detail screen.
- [ ] 🔴 **1.2 Booking box must lead to checkout.**
  ❌ Now: "Check Availability" button does nothing; no way to book. → ✅ Fix: booking box = date picker + guests selector + selected room + price summary + one primary button **"Reserve"** that goes to Checkout. Remove WhatsApp/Call as the main actions (move to a small "Contact hotel" link if needed).
- [ ] 🟡 **1.3 Add a Save/Favorite heart button** (top area, near the hotel name or on the gallery).
  ❌ Now: a Favorites page exists in the dashboard, but there is NO heart button anywhere to save a hotel. → ✅ Fix: heart icon with saved/unsaved states.
- [ ] 🟡 **1.4 Reviews section — 3 changes:**
  ❌ Now: (a) every review shows a "Verified Guest" badge automatically, (b) there is no reply from the hotel, (c) there is no way to write a review.
  → ✅ Fix: (a) badge only as a real state (verified vs normal); (b) add a **"Response from [Hotel Name]"** block under a review (indented card, hotel avatar + reply text + date); (c) add a "Write a review" button (opens the review form — see Screen 12).
- [ ] 🟡 **1.5 Rating category bars — decide one of two options.**
  ❌ Now: bars show Cleanliness 4.9 / Comfort 4.8 / Location 4.9 / Facilities 4.7 / Staff 5.0 — but NO form anywhere asks users these ratings, so the numbers can never be real.
  → ✅ Fix: EITHER add these 5 category ratings to the "Write a review" form (Screen 12) and keep the bars, OR remove the bars. Do not show data no one can enter.
- [ ] 🟡 **1.6 Location section — real address.**
  ❌ Now: every hotel shows the same fake address "50 Central Park South". → ✅ Fix: address comes from the hotel's own data; also add the address field to the extranet Property Details screen (Screen 20.4) so partners can enter it.
- [ ] 🟡 **1.7 House rules must match the partner's policies.**
  ❌ Now: house rules are fixed sample text and CONTRADICT the extranet — public says "Pets: Not allowed", partner side says "Pets allowed, $35/night". → ✅ Fix: design house rules as data-driven rows (check-in time, check-out time, cancellation, payment, pets, smoking) that display whatever the partner sets in the extranet Policies screen.
- [ ] 🟢 **1.8 Remove the fake urgency banner** ("booked 18 times in the last 24 hours") — it is static text, same for every hotel. Remove it, or specify it as a real data-driven component with rules.

## Screen 2 — Hotel Card (component: Home, Listing, Favorites, Similar) 🟡

- [ ] 🟡 **2.1 Add a heart/save icon** on the card (top-right corner of the image) with saved/unsaved states. (Same reason as 1.3 — Favorites can never be filled without it.)
- [ ] 🟡 **2.2 Add a "Sold out" state** for the card AND the detail page.
  ❌ Now: partners manage availability in the extranet, but the public site has no sold-out/unavailable design at all. → ✅ Fix: grayed card + "Sold out for your dates" label; detail page variant with disabled Reserve.
- [ ] 🟢 **2.3 Discount badge system.**
  ❌ Now: badge only supports "15% OFF" text. But partner promotions include "$50 off", "3rd night free", long-stay deals, Genius discounts, Mobile-only rates. → ✅ Fix: one badge component with variants: percent-off, amount-off, free-night, Genius, Mobile deal, Preferred Partner (thumbs-up).

## Screen 3 — Hotels Listing + Filters 🟡

- [ ] 🟡 **3.1 Star Rating filter.**
  ❌ Now: options are 3★ 4★ 5★ — but all hotels are rated 4.6–4.9, so "5 stars" can never match anything. → ✅ Fix: change to score buckets: **4.5+ · 4.0+ · 3.5+**.
- [ ] 🟡 **3.2 Property Type filter.**
  ❌ Now: options Apartment / Villa / Boutique — none of these exist in the inventory (only Hotel and Resort). → ✅ Fix: options = Hotel · Resort (add others only when inventory has them).
- [ ] 🟡 **3.3 Room Type filter.**
  ❌ Now: options Single/Double/Suite/Family/Penthouse don't match the actual room names. → ✅ Fix: align options with real room types, or remove this filter.
- [ ] 🟢 **3.4 Amenity filter** — "Beach" exists on hotels but is missing from the filter options. Add it.

## Screen 4 — Home: Hero Search 🟡

- [ ] 🟡 **4.1 Search summary bar on the results page.**
  ❌ Now: hero search asks for destination + dates + guests, but the results page shows NO trace of the chosen dates/guests — the search feels broken. → ✅ Fix: design a summary bar on top of the listing: "Dubai · 25 Jun – 27 Jun · 2 guests" with an Edit action.

## Screen 5 — Checkout 🔴

- [ ] 🔴 **5.1 Add an "Arrival time" field** (dropdown: 14:00–15:00, 15:00–16:00, …).
  ❌ Now: the confirmation tells guests "Check-in from 3:00 PM" but we never ask when they arrive.
- [ ] 🔴 **5.2 Add an "Add-ons / Extras" section** (before payment step).
  ❌ Now: partners sell extras in the extranet — Airport Transfer $65, Early Check-in $35, Spa Package $120, Champagne $85 — but customers have NO way to buy them. → ✅ Fix: checkbox list of add-ons with prices, added into the price summary.
- [ ] 🟡 **5.3 Prefill logged-in user's details** (name, email, phone) — ❌ Now the form starts empty even for a logged-in user.
- [ ] 🟢 **5.4 Country/Region field** — collected but never used anywhere. Remove it, or connect it to something (phone code / currency).

## Screen 6 — Booking Confirmation 🟡

- [ ] 🟡 **6.1 Full price breakdown.**
  ❌ Now: checkout shows "Subtotal + Taxes & fees + Total", then confirmation shows only one Total. → ✅ Fix: same breakdown block on confirmation.
- [ ] 🟡 **6.2 Show phone + special requests** the guest entered. ❌ Now they disappear after checkout.
- [ ] 🟢 **6.3 Greeting** uses first name only although full name is collected — use full name.
- [ ] 🟢 **6.4 Check-in/out times** ("from 3:00 PM" / "until 12:00 PM") must come from the hotel's policy, not fixed text (linked to fix 20.1).

## Screen 7 — Support (public) 🟡

- [ ] 🟡 **7.1 "My Tickets" list is missing.**
  ❌ Now: user submits a ticket → it vanishes; there is no screen showing submitted tickets. → ✅ Fix: design a ticket list (subject, category, date, status badge: Open / In Progress / Resolved) + ticket detail/thread view. Same component for Dashboard Support (14.2).
- [ ] 🟢 **7.2 FAQ mentions a "Rewards page"** that does not exist. Fix the copy (or design a Rewards screen — client decision).
- [ ] 🟢 **7.3 Old brand leftovers:** "LuxeStay" name and booking-ID example "LXS-2026-00123". → Replace with Stayora / "STY-XXXXXX".

## Screen 8 — Site Header (component) 🟡

- [ ] 🟡 **8.1 Currency label.**
  ❌ Now: header says **"PKR"** but every price on the site is in **USD**. → ✅ Fix: show USD (or design a working currency switcher — one decision, see design-system table).
- [ ] 🟡 **8.2 Add a notification bell** with unread-count badge + dropdown list (title, time, unread dot, "Mark all as read"). ❌ Now: notifications exist in the dashboard but there is no bell anywhere.

## Screen 9 — Signup 🟡

- [ ] 🟡 **9.1 Profile data has no source.**
  ❌ Now: signup asks only name/email/password, but the Profile screen shows phone, avatar, travel preferences, membership tier, points — where did they come from? → ✅ Fix: EITHER add an optional "Complete your profile" step (phone, avatar, preferences) after signup, OR design Profile with proper empty states ("Add phone", "Upload photo").

---

# CUSTOMER DASHBOARD

## Screen 10 — Dashboard Home 🟢

- [ ] 🟢 **10.1 Stat says "Saved Hotels: 4"** but the Favorites page shows 6 — one number, one source.
- [ ] 🟢 **10.2 Demo content uses hotels that don't exist** in the catalog ("Marina Bay Sands", "Atlantis The Palm", "Four Seasons **Maldives**" — the catalog's Four Seasons is in **Paris**). → Replace demo bookings/trips with real catalog hotels so screens can link to each other.

## Screen 11 — My Bookings + Cancel/Modify 🟡

- [ ] 🟡 **11.1 One status system.**
  ❌ Now: customer side uses confirmed/pending/completed/cancelled; partner side uses Confirmed/Checked In/Checked Out/Cancelled/Pending — different words, different casing. → ✅ Fix: define ONE status set + badge colors, used on BOTH portals (see design-system table).
- [ ] 🟡 **11.2 Cancelled/modified result states.**
  ❌ Now: after cancelling, the booking still looks "Confirmed" — there is no cancelled-card design. → ✅ Fix: design the booking card in "Cancelled" state (muted, red badge, refund note) and "Modified" state (updated dates highlighted).
- [ ] 🟢 **11.3 Booking reference number** missing on the card/detail. Checkout generates "STY-XXXXXX" — show the same reference here (and on the partner side).

## Screen 12 — My Reviews 🔴

- [ ] 🔴 **12.1 Design the "Write a Review" form — it does not exist anywhere in the product.**
  Entry point: a "Write review" button on a completed booking (Screen 11) and on the hotel detail page (1.4c). Form fields: overall star rating, title, review text — **plus the 5 category ratings** (Cleanliness, Comfort, Location, Facilities, Staff) IF the detail-page bars stay (decision 1.5).
- [ ] 🟡 **12.2 One rating scale.**
  ❌ Now: this screen shows 5 stars AND a "/10" score for the same review; public pages use /5; extranet score uses /100. → ✅ Fix: /5 stars everywhere (recommendation). Remove the /10 badge.
- [ ] 🟡 **12.3 Show the hotel's reply** under the customer's own review (same "Response from hotel" block as 1.4b).
- [ ] 🟢 **12.4 Edit/Delete actions** on own reviews — currently none. Decide and design (usually a ⋯ menu).

## Screen 13 — Favorites 🟡

- [ ] 🟡 **13.1 Empty state missing.**
  ❌ Now: page always shows 6 hotels (fake). Once real saving works (hearts from 1.3/2.1), a user may have zero saved. → ✅ Fix: empty state — illustration + "No saved hotels yet" + "Browse hotels" button.

## Screen 14 — Notifications + Dashboard Support 🟡

- [ ] 🟡 **14.1 Bell + live count.**
  ❌ Now: sidebar badge is a fixed "2" that never changes; "Mark all as read" doesn't affect it; no bell in the header. → ✅ Fix: bell in header (8.2); sidebar badge spec'd as "count of unread items".
- [ ] 🟡 **14.2 "My Tickets" list** — same as 7.1, reuse the component here.

## Screen 15 — Profile & Settings 🟢

- [ ] 🟢 **15.1 Avatar upload control missing** — photo is shown but cannot be changed. Add upload/change action (also part of 9.1).
- [ ] 🟢 **15.2 "Gold Member" + 12,450 points shown with zero explanation** — add a tooltip/info popover ("How do points work?") or a small tiers section; otherwise remove.
- [ ] 🟢 **15.3 Currency selector in Settings does nothing** and conflicts with the "PKR" header (8.1). One currency decision for the whole product.

---

# PARTNER EXTRANET

## Screen 16 — Reservations + Cancellations 🟡

- [ ] 🟡 **16.1 Align reservation fields with what a real booking contains.**
  ❌ Now: the reservation detail shows Room No. and Source channel (Booking.com/Expedia) — which our booking flow never provides — but does NOT show the guest's **phone** or **special requests**, which checkout DOES collect. → ✅ Fix: add Phone + Special requests + Arrival time to the reservation detail; keep Source/Room No. only if the client confirms channel-manager integration.
- [ ] 🟡 **16.2 Cancelled state on the reservations table.**
  ❌ Now: cancelling a reservation doesn't visually move it anywhere; the Cancellations screen shows an unrelated list. → ✅ Fix: design the reservation row in "Cancelled" state; spec: a cancelled reservation appears on the Cancellations screen with refund status.
- [ ] 🟢 **16.3 Status badges** — must use the same unified status set as the customer side (11.1).

## Screen 17 — Reviews + Property Score 🟡

- [ ] 🟡 **17.1 Numbers contradict between the two screens.**
  ❌ Now: Reviews page = average 4.3/5, "3 pending"; Property Score page = "4.2/5", "4 pending" — same hotel, same day. → ✅ Fix: both screens reference the same live values (spec note for dev; design shows one consistent sample value).
- [ ] 🟡 **17.2 Scale confusion.**
  ❌ Now: Property Score is /100 while guest reviews are /5 — looks like two different ratings of the hotel. → ✅ Fix: clearly label /100 as **"Page completeness score"** (content quality), visually distinct from guest rating.
- [ ] 🟢 **17.3 Review card shows Title + Room stayed + Booking ID** — the customer review form must collect a title for this to exist (add Title to 12.1 — done above); Room/Booking ID come from the booking automatically (spec note).

## Screen 18 — Rates / Promotions / Boost 🟢

- [ ] 🟢 **18.1 Public counterparts missing.**
  ❌ Now: partner creates promotions, Genius discounts, mobile rates, value-adds — but the public site has NO design that displays any of them, so the partner sees zero effect. → ✅ Fix: this is covered by 2.3 (badge system) + 5.2 (add-ons at checkout) + 1.2 (price summary showing applied promo line). No extra extranet change needed — just be aware these three public designs close the loop.
- [ ] 🟢 **18.2 Commission number appears as 12%, 12.4% and 15%** on different screens (Finance, KPI, Preferred criteria) — align the sample content to one number (e.g. 12%; Preferred threshold can stay 15% but label it "requires ≥15%").

## Screen 19 — Finance 🟢

- [ ] 🟢 **19.1 Tax model must be one story.**
  ❌ Now: invoices imply ~8% tax, the VAT screen configures 10% + 5% + 2% + fixed fees, and the public checkout charges a flat 12%. → ✅ Fix: sample content aligned to the VAT screen's model; public checkout breakdown (6.1) shows the same charge lines (VAT, service, tourism, city tax, resort fee).

## Screen 20 — Property Details / Policies / Descriptions 🔴

- [ ] 🔴 **20.1 Check-out time contradicts itself.**
  ❌ Now: Property Details says 12:00 PM; both Policies screens say 11:00 AM; public pages say 12:00 PM. → ✅ Fix: ONE value everywhere (pick 12:00 PM); spec: policy screens read the same field, entered once.
- [ ] 🔴 **20.2 Pets policy contradiction.**
  ❌ Now: extranet = "Pets allowed, $35/night"; public detail page = "Pets: Not allowed". → ✅ Fix: one value; public house rules display whatever the partner sets (linked to 1.7).
- [ ] 🟡 **20.3 Three different descriptions of the same property** on three screens ("beachfront resort, 3 restaurants" / "coastal retreat, 2 infinity pools" / "city-center hotel" — for a Malibu beach resort!). → ✅ Fix: one canonical description in the sample content; spec: edit dialog and descriptions screen edit the SAME text.
- [ ] 🟡 **20.4 Add a Street Address field** to Property Details.
  ❌ Now: no address field exists, which is why the public map section shows a fake address (1.6).

## Screen 21 — Account / Team / Topbar 🟢

- [ ] 🟢 **21.1 Team list vs Contacts list show different people** (one has Tom Bergman, the other Hiroshi Tanaka) and different job titles for the same person. → Align sample content to one team.
- [ ] 🟢 **21.2 Notification samples reference a property that doesn't exist** ("Aurora Bay Resort") and rename guests ("James Carter" = inbox's "James Chen"). → Align sample content.
- [ ] 🟢 **21.3 Topbar: "Account" and "Settings" open the same page.** → Give Settings its own destination or remove one menu item.

---

# New components/screens to design (summary checklist)

These do not exist anywhere yet — they are the core new design work:

- [ ] 1. **Write a Review** form/modal (12.1) — rating, title, text, category ratings
- [ ] 2. **"Response from hotel"** reply block — public reviews + My Reviews (1.4b, 12.3)
- [ ] 3. **Heart/favorite toggle** — hotel card + detail page (1.3, 2.1)
- [ ] 4. **Notification bell** + dropdown with unread count — both headers (8.2, 14.1)
- [ ] 5. **Add-ons/Extras section** at checkout (5.2)
- [ ] 6. **Arrival time field** at checkout (5.1)
- [ ] 7. **My Tickets** list + ticket thread — public & dashboard support (7.1, 14.2)
- [ ] 8. **Sold-out states** — card + detail page (2.2)
- [ ] 9. **Cancelled/Modified booking card states** — dashboard + extranet (11.2, 16.2)
- [ ] 10. **Empty states** — Favorites (13.1), notifications, tickets
- [ ] 11. **Search summary bar** on listing (4.1)
- [ ] 12. **Avatar upload control** + optional "Complete your profile" step (9.1, 15.1)

# One-time design-system decisions (apply everywhere)

| Decision | Now (broken) | Choose |
|---|---|---|
| Booking status set | 4 different vocabularies across screens | One set: Confirmed / Pending / Checked-in / Checked-out / Completed / Cancelled + fixed badge colors |
| Rating scale | /5, /10, /100 mixed | /5 stars everywhere (extranet /100 relabeled "page score") |
| Currency | USD prices, "PKR" in header, multi-currency extranet | USD everywhere (or design a real switcher once) |
| Booking ID | STY-XXXXXX vs b1 vs RSV-88xx | STY-XXXXXX shown on all three portals |
| Discount badges | "15% OFF" text only | Badge component with % / $ / free-night / Genius / Mobile / Preferred variants |
| Brand | "LuxeStay", "LXS-" leftovers | Stayora / STY- everywhere |

# Not your problem — dev team handles these ⚙️

- Buttons that show "success" but don't save (cancel, modify, favorites, replies, settings) — data wiring.
- Bookings not appearing in dashboard/extranet after checkout — data layer.
- The three portals running on separate demo datasets — dev unification.
- Filters not actually filtering — logic.

Your part of those fixes is only the **states** listed above (cancelled card, sold-out, empty states, unread counts, promo badges).
