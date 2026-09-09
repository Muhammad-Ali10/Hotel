# Stayora — Backend Plan

**Stack:** NestJS 11 (alag API) · PostgreSQL + Drizzle ORM · Next.js 16 frontend
**Pehla target:** Site + Dashboard booking flow (search → detail → checkout → my bookings)

**Inputs (dono pad kar aayein):**
- `FRONTEND-AUDIT.md` — 144 routes ka poora check
- `BUSINESS-RULES.md` — **11 locked faisle**, schema ka source of truth

---

## 1. Kahan khade hain

| | |
|---|---|
| Routes | 144 · 5 surfaces · 372 `.tsx` |
| typecheck / lint / build | ✅ teenon clean |
| Broken links | 0 |
| API routes / server actions | **0** |
| Auth | **0** — `onSubmit()` form values leta tak nahi, koi gate nahi |
| "DB" | zustand + localStorage (`frontend/src/store/index.ts`, 760 L) |
| Domain logic | `frontend/src/lib/domain.ts` (517 L) — **framework-free, portable** |

### Char data duniyaein (audit §2)

```
1. Unified store       src/store          ← site + dashboard + extranet ka 1/3
2. Static extranet     src/data/extranet  ← 37 screens: analytics, finance, boost
3. Static admin        src/data/admin + src/lib/admin/api/store.ts  ← apna in-memory db
4. Join wizard draft   apna localStorage  ← kahin connect nahi
```

### Teen asset jo dobara nahi banane

| Asset | Kyun ahem |
|---|---|
| `frontend/src/lib/domain.ts` | Har pricing/availability/refund rule wahan hai, sirf types import karta hai. Server par **as-is** chalega. |
| `frontend/src/lib/admin/api/transport.ts` | `request()` — comment me hi "the swap seam" likha hai. Ek function badalne se 25 admin screens asli ho jayengi. |
| `frontend/src/data/*` | Realistic seed data. Migration ka seed input. |

---

## 2. Phase 0 — Schema unification (blocker)

Ek product, teen type systems:

```
frontend/src/types/index.ts        → Hotel    · Booking     · UserProfile · Review.status "published"
frontend/src/lib/admin/types.ts    → Property · Reservation · Guest       · Review.status "Published"
frontend/src/lib/extranet/types.ts → Property (teesri shakal) · minStay STRING (baaki jagah number)
```

**Faisla:** `frontend/src/types/index.ts` canonical. Baaqi do uske **DTO/view** banenge.

| Canonical | Replaces |
|---|---|
| `Hotel` → `Property` | admin `Property`, extranet `Property` |
| `Booking` | admin `Reservation`, extranet `CalendarBooking` |
| `User` (role-based) | `UserProfile`, admin `Guest`, admin `Manager`, extranet `TeamUser` |
| `Review` (lowercase enum) | admin `Review` |

**Deliverable:** `shared/types` + mapping table (purana naam → naya naam).

---

## 3. Repo structure

Do workspaces, dono apne `package.json` aur `node_modules` ke saath. Root par koi install nahi.

```
E:\Hotel\
├─ frontend/               Next 16 app                           ✅
├─ backend/                NestJS API                            ✅ scaffold ban chuka
│  └─ src/{main,app.module,config/env,db,common,modules}
├─ shared/                 Phase 1                               ⏳
└─ docs/                   backend-plan · FRONTEND-AUDIT · BUSINESS-RULES
```

### `shared/` — chauthi divergence rokne ka insurance

- `types/` — Phase 0 ka canonical model
- `domain.ts` — `frontend/src/lib/domain.ts` se move (rules ke saath update, §5 dekho)
- `contracts/` — har endpoint ka zod request/response schema

Next isse **optimistic preview** dikhata hai, Nest isi se **authoritative** hisaab karta hai.
Ek function, do jagah — mismatch namumkin.

**Wiring:** root par chhota `package.json` —
```json
{ "private": true, "workspaces": ["shared", "frontend", "backend"] }
```
`../shared` ko seedha import karne se `tsc` ka `rootDir` toot-ta hai — isliye workspace package.

---

## 4. Auth (zero se)

`proxy.ts` (Next 16 me `middleware.ts` ka naya naam) `/api/*` ko Nest par rewrite karega.
Browser ke liye same-origin → **CORS bilkul nahi**, cookie domain ka masla nahi.

- Session: httpOnly + Secure + SameSite=Lax cookie, Nest issue karega
- Roles: `customer` · `partner` · `admin`
- Nest: `AuthGuard` + `RolesGuard` — `frontend/src/lib/admin/rbac.ts` ka matrix reuse
- Next: `proxy.ts` sirf redirect (UX), asli authorization Nest me

**`users.tier`** bhi yahin aata hai — `genius` channel promotions isi par depend karte hain (rule #3).

---

## 5. `domain.ts` me kya badlega

Business rules ke faislon se ye functions badalte hain. **Ye Phase 1 ka kaam hai**, `shared/` me move karte waqt.

| Function | Tabdeeli | Rule |
|---|---|---|
| `refundFor()` | hardcoded 48h/50% → property ki `free_until` + `charge` + `charge_value` padhega | #1 |
| `activeDiscountFor()` | `channel === "all"` filter → guest ke channel + tier se match; ranking → **asli saved amount** | #3, #4 |
| `checkStay()` | `availability.minStay` → check-in date ka `rate_calendar.min_stay` | #5 |
| `originalPrice()` | sirf percent → `roomSubtotal + discountAmount` (har type) | #7 |
| `priceBooking()` | **tax layer nikal jayega** — `total = roomSubtotal − discount + addOnsTotal` | #11 |
| `taxLinesFor()` · `taxAmount()` | **delete** | #11 |
| `valueAddPrice()` | chautha unit: `per person per night` → `price × guests × nights` | #10 |
| `unitsLeft()` | JS counting → server par `rate_calendar.booked_units` (§7) | — |
| **naya** `canTransition()` | booking state machine guard | #6 |
| **naya** `commissionFor()` | `15% × total`, booking par snapshot ho jaye | #9 |

---

## 6. Data model

`BUSINESS-RULES.md` ke faisle isme bake ho chuke hain.

```
users                (id, email UQ, password_hash, role, first_name, last_name, phone,
                      country, city, avatar_seed, tier, membership, points, joined_at)
partner_orgs         (id, name, …)
partner_members      (org_id, user_id, role)              ← extranet team

properties           (id, name, city, country, address, type, description,
                      managed_by → partner_orgs NULL,
                      check_in_time, check_out_time,
                      cancel_free_until, cancel_charge, cancel_charge_value,   ★ rule #1
                      policy_payment, policy_pets, policy_smoking, policy_children,
                      status, seed)
rooms                (id, property_id, name, description, guests, bed, size,
                      features JSONB, base_price, units, seed)

rate_calendar        (room_id, date, rate, is_closed, min_stay,                ★ rule #5
                      total_units, booked_units,
                      PK (room_id, date))
                      CHECK (booked_units >= 0 AND booked_units <= total_units) ★ §7

                     ── tax_lines table NAHI banega (rule #11: tax poora khatam) ──
value_adds           (id, property_id, name, category, description, price,
                      unit, active)                                            ★ rule #10
                      unit: per_stay | per_night | per_person | per_person_per_night

promotions           (id, name, discount_type, discount_value, start_date, end_date,
                      room_types, min_stay, channel, status)                   ★ rule #3
promotion_properties (promotion_id, property_id)

bookings             (id STY-XXXXXX PK, customer_id → users NULL, property_id, room_id,
                      property_name, room_name, city, seed,        ← snapshots
                      guest_first_name … guest_country,
                      check_in, check_out, guests, arrival_time, special_requests,
                      pricing JSONB,                               ← frozen snapshot
                                 { nights, ratePerNight, roomSubtotal,
                                   addOnsTotal, discount?, total }   ★ koi tax nahi
                      commission_amount,                           ★ rule #9: 15% × total
                      commission_status,                           ★ pending | earned | void
                                 completed → earned · cancelled/no_show → void
                      payment_method, payment_status,
                      status,                                      ★ rule #6
                      hold_expires_at NULL,                        ★ pending hold
                      source, room_no, notes, created_at)
booking_add_ons      (id, booking_id, value_add_id, name, price, qty)
booking_events       (id, booking_id, from_status, to_status, actor_id, actor_role,
                      reason, created_at)                          ← audit + state machine log
cancellations        (booking_id PK, date, reason, by, refund, refund_status)

reviews              (id, property_id, booking_id NULL, author_id NULL, author, author_seed,
                      country, room_name, rating, categories JSONB, title, body, date,
                      status, response_text, response_date)
notifications        (id, user_id, audience, type, title, message, href, read, created_at)
favorites            (user_id, property_id, PK both)
tickets              (id TKT-xxxx from SEQUENCE, subject, category, priority, status,  ★ rule #8
                      created_by, author, email, property_id NULL, booking_id NULL,
                      created_at, updated_at, seed)
ticket_messages      (id, ticket_id, from, author, text, created_at)
```

### Do design faisle jo baad me badalna mehnga hai

**`rate_calendar` — ek row per room per date.** Ye `closedDates`, `rateOverrides` aur `minStay`
teenon ko ek indexed table me collapse kar deta hai, per-date min-stay (rule #5) mumkin banata hai,
aur `booked_units` rakh kar overbooking ko DB-level par rokta hai. Extranet ka rate-calendar aur
restrictions UI iske upar seedha baith jate hain.

**`bookings.pricing` = JSONB snapshot.** Booking ke waqt ki price **jam** jani chahiye — hotel kal
rate badal de to purani booking ka total nahi hilna chahiye. Isi liye `property_name` /
`room_name` / `city` bhi snapshot hain.

---

## 7. Overbooking — asli engineering problem

`unitsLeft()` JS me overlapping bookings ginta hai. Server par seedha translate karne se **race
condition** banti hai:

> Do guest ek hi waqt checkout dabate hain. Dono ki query kehti hai "1 unit bacha hai".
> Dono INSERT ho jate hain. Property overbooked.

**Hal — DB khud rokega:**

```sql
ALTER TABLE rate_calendar
  ADD CONSTRAINT no_overbooking
  CHECK (booked_units >= 0 AND booked_units <= total_units);
```

Booking transaction:

1. `BEGIN`
2. stay ki har date ke `rate_calendar` rows `SELECT … FOR UPDATE` (lock)
3. verify: `is_closed = false` · check-in date ka `min_stay <= nights` · `guests <= room.guests`
4. `booked_units + 1` — CHECK fail hua to **DB** reject karega
5. `priceBooking()` **server par** chalao — client ka total kabhi accept mat karo
6. booking + add-ons + `booking_events` + notifications insert
7. `COMMIT`

Application me bug ho bhi jaye, database physically overbook nahi hone dega.

### Inventory kaun rokta hai (rule #6)

`pending` · `confirmed` · `checked_in` rokte hain · `no_show` us raat tak · `cancelled` release.

**Hold expiry:** `pending` bookings `hold_expires_at` rakhti hain (~15 min). Ek cron expire hui
holds ko `cancelled` kar ke `booked_units` wapas karta hai — warna adhoore checkouts inventory
rok kar baithe rahenge.

---

## 8. Booking state machine (rule #6)

`pending` · `confirmed` · `checked_in` · `completed` · `no_show` · `cancelled`
(`checked_out` **khatam** — `completed` me merge)

```
pending    → confirmed | cancelled
confirmed  → checked_in | no_show | cancelled
checked_in → completed
completed · cancelled · no_show → terminal
```

Har transition `booking_events` me log hogi (from, to, actor, reason). Koi doosri transition
service layer par **reject**. Admin force kar sakta hai — audit ke saath.

---

## 9. API contract — Phase 1 scope

`shared/contracts` me zod se define, dono taraf import.

```
POST   /auth/signup · /auth/login · /auth/logout        GET /auth/me

GET    /hotels?city=&checkIn=&checkOut=&guests=&price=&amenities=&sort=&page=
GET    /hotels/:id
GET    /hotels/:id/availability?checkIn=&checkOut=&guests=
POST   /bookings/quote          → BookingPricing (server-authoritative)
POST   /bookings                → Booking   [Idempotency-Key header]
GET    /bookings?scope=me       ·  GET /bookings/:id
POST   /bookings/:id/cancel     → refund property ki policy se (rule #1)

GET    /me/profile · PATCH /me/profile
GET    /me/favorites · POST/DELETE /me/favorites/:hotelId
GET    /notifications · POST /notifications/read
POST   /reviews
```

**Teen rules:**
- `/bookings/quote` aur `POST /bookings` **ek hi calculation** use karte hain. Client sirf
  `roomId + dates + guests + addOns` bhejta hai — kabhi total nahi.
- **`Idempotency-Key`** checkout par double-submit ko duplicate booking banne se rokta hai.
- **Channel client se trust nahi** — mobile/genius server par derive honge (user-agent + session tier).

---

## 10. Phases

| # | Kaam | Output |
|---|---|---|
| **✅** | `backend/` scaffold — Nest boots, `/api/health` live | build · typecheck · lint clean |
| **✅** | Frontend audit + 8 business rules locked | `FRONTEND-AUDIT.md` · `BUSINESS-RULES.md` |
| **0** | Schema unification — 3 type systems → 1 | canonical types + mapping table |
| **1** | `shared/` workspace; `domain.ts` move **+ §5 ki tabdeeliyan** | web abhi bhi zustand par chalta rahe |
| **2** | Drizzle schema + migrations + **seed `frontend/src/data/*` se** | asli Postgres, asli data |
| **3** | Auth + guards + `users.tier` | login/signup asli, `/auth/me` |
| **4** | Read endpoints: hotels, detail, availability, quote | web ke read paths switch |
| **5** | `POST /bookings` transactional + state machine + dashboard | **booking flow end-to-end asli** |
| **6** | Payments (Stripe) · email · photo uploads (abhi picsum seeds) | |
| **7** | Extranet API — **incl. 37 static screens ke asli aggregates** | analytics, finance, boost |
| **8** | Admin API — seam pehle se maujood (`transport.ts`) | |
| **9** | **Join wizard ka output** → property `status: pending_review` → admin queue | 29 steps ka anjaam |
| **10** | Cron: hold expiry, auto-complete, no-show sweep, payouts, commission | |

**Phase 7 ka size mat bhoolein:** extranet ke 60 me se **37 screens** ke numbers abhi kahin se
nahi aate. Revenue, occupancy, commission, ranking, demand — sab fixed fixtures hain. Inke liye
asli aggregate queries likhni hongi, ye phase sabse bara hai.

---

## 11. Zustand ka kya hoga

`frontend/src/store/index.ts` **delete nahi** hoga — scope simat jayega:

- **Rakho:** UI state — filters, search draft, join-wizard draft, theme
- **Hatao:** `bookings`, `hotels`, `reviews`, `profile`, `notifications` → server state
- **Replace:** TanStack Query (pehle se installed)

Rasta maujood hai: admin ka `endpoints.ts` + `hooks.ts` + `transport.ts` pattern har surface par
dohrao — components ko haath lagaye baghair `request()` ke andar mock ki jagah asli `fetch`.

**Loading states:** abhi 144 routes par sirf 1 `loading.tsx`, 1 `error.tsx`, 2 `not-found.tsx` hain,
kyunki store synchronous hai. Backend aane par **har surface par** ye chahiye honge.

---

## 12. Pehla concrete step

**Phase 0 ka mapping table.** Jab tak `Hotel` vs `Property` vs `Property` tay nahi hota, Drizzle
schema likhna qabl-az-waqt hai — chahe business rules locked hi kyun na hon.
