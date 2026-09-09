# Stayora Backend — Architecture & Engineering Standards

**Date:** 2026-08-18
**Companion docs:** `BUSINESS-RULES.md` (kya banana hai) · `backend-plan.md` (kis tarteeb se)
Ye document **kaise** banana hai, aur har module isi ke against pass hoga.

---

## 0. Do usool jo har faisle par lagte hain

**Scalable** — pehle din se aisa dhaancha ke 10 hotels se 10,000 tak jaate waqt rewrite na karna pare.

**Changeable** — kal requirement badle to ek jagah badle, das jagah nahi. Iska amali matlab:
har rule **ek hi jagah** likha ho (`shared/domain.ts`), aur schema me aisi cheezein na hon jinhe
badalna migration ka azaab ban jaye.

Ye do usool aapas me takra sakte hain. Takrao ki soorat me **changeable jeetega** — kyunki abhi
tak kisi ne is product ko scale par nahi chalaya, magar rules pehle hi 11 baar tay ho chuke hain.

---

## 1. Technical decisions (craft — business faisle nahi)

### 1.1 Paisa integer cents me

Abhi poore frontend me paisa plain `number` (dollars) hai, `Math.round` har jagah, aur
`formatCurrency` me `maximumFractionDigits: 0`. Yani sab whole dollars.

**Ye backend me nahi chalega:**

```
Commission 15% × $2,432  =  $364.80
Round → $365             →  har booking par $0.20 gum
100,000 bookings         →  $20,000 ka farq
```

Aur Stripe cents me kaam karta hai — reconciliation kabhi balance nahi hogi.

> **Faisla:** har money column `integer` (cents). `2432.00` → `243200`.
> Format sirf API ke edge par. Domain functions cents me hisaab karte hain.
> Rounding hamesha **aakhir me, ek baar** — har step par nahi.

### 1.2 Enums = `varchar` + `CHECK`, native PG enum nahi

`ALTER TYPE … ADD VALUE` transaction ke andar nahi chalta, aur value **remove karna namumkin** hai.

Hum abhi hi `checked_out` hata rahe hain aur `no_show` add kar rahe hain (rule #6) — yani enums
badlenge, ye tay hai. Native enum ke saath har tabdeeli ek dardnaak migration hogi.

```sql
status varchar(16) NOT NULL
  CHECK (status IN ('pending','confirmed','checked_in','completed','no_show','cancelled'))
```

Value add karna = ek `ALTER … DROP CONSTRAINT` + `ADD CONSTRAINT`. Aasan, transactional, reversible.

### 1.3 IDs

| Kya | Kaise | Kyun |
|---|---|---|
| Internal PK | **UUIDv7** | time-sortable → index locality achhi, `bigserial` ki tarah enumerable nahi |
| Guest-facing booking ref | `STY-XXXXXX`, alag **unique** column | insaan padh sake; PK se juda taake scheme badal sake |
| Ticket ref | DB **sequence** se `TKT-…` | rule #8 — collision namumkin |

**PK kabhi guest-facing na ho.** Aaj `bookings.id` hi `STY-K7M2QX` hai — yani reference scheme
badalna primary key badalna ban jata hai. Backend me ye do alag cheezein hain.

### 1.4 Waqt aur tareekh

| Cheez | Type | Kyun |
|---|---|---|
| `check_in`, `check_out` | `date` | ye timezone-free hain — "12 August ki raat" har jagah wahi raat hai |
| Har event (`created_at`, `cancelled_at`) | `timestamptz` | absolute lamha |
| `properties.timezone` | `varchar` (IANA, jaise `Asia/Tokyo`) | **naya column** |

`properties.timezone` isliye zaroori hai ke `/cancellation-policy` page **wada karta hai**:

> *"A 48-hour deadline for a 15:00 check-in in Tokyo expires at 15:00 Tokyo time two days before."*

Abhi poore product me timezone kahin nahi hai — Tokyo aur New York dono ke liye "48 ghante" ek hi
tarah gine jate hain. Cancellation deadline **property ke local waqt** me hisaab hogi.

### 1.5 API versioning

`/api/v1/…` **pehle din se**. Baad me `v1` add karna har client todta hai; abhi karna muft hai.

### 1.6 Migrations

Forward-only. Ek migration apply ho gayi to **kabhi edit nahi hogi** — ghalti ho to nayi migration.
`db:push` sirf local scratch DB par, kabhi shared par nahi.

---

## 2. Layering

```
Controller   → HTTP samajhta hai. Patla. Validate (zod) → service call → response shape.
Service      → Use case. Transaction boundary yahan hai. Authorization yahan hai.
Repository   → Sirf DB. Koi business rule nahi.
Domain       → shared/domain.ts — pure functions, koi DB, koi framework, koi I/O.
```

**Domain layer ka pure rehna sabse ahem hai.** `priceBooking`, `checkAvailability`, `refundFor`,
`canTransition` — sab pure. Isi wajah se woh frontend aur backend dono me chal sakte hain, aur
unka test likhne ke liye database ki zaroorat nahi.

**Cross-module import mana hai.** `BookingModule` `PricingModule` ke public interface se baat
karega, uske repository se nahi.

---

## 3. Do sparse calendars — inventory aur rates alag

Ye volume tables hain. Agar har room × har date ki row banayein:

| Paimana | Rows |
|---|---|
| Aaj (10 properties × 3 rooms × 730 din) | 21,900 |
| 1,000 properties × 5 rooms | **3.65M** |
| 10,000 properties × 8 rooms | **58M** |

**Faisla 1: sparse rakho.** Row sirf tab bane jab us date par kuch **asal me** ho — ya partner ne
override kiya ho, ya koi booking ho. Baaqi sab defaults se `COALESCE` ho jata hai.

**Faisla 2: do tables, ek nahi.** Rate plans (rule #27) ke saath ye lazmi ho gaya:

```sql
room_inventory  (room_id, date, is_closed,
                 total_units, sellable_units, booked_units,
                 PRIMARY KEY (room_id, date))

rate_plan_rates (rate_plan_id, date, rate,
                 min_stay, min_stay_through, max_stay,
                 closed_to_arrival, closed_to_departure, min_advance_hours,
                 PRIMARY KEY (rate_plan_id, date))
```

**Stock ROOM ka hai, price PLAN ki.** "Flexible" aur "Non-refundable" wahi 28 Deluxe Kings bechte
hain — agar dono ke apne counter hote to property 56 bech deti. Aur wahi raat $725 flexible hai
aur $620 non-refundable — ek hi table me dono nahi sama sakte.

Availability read (`shared/domain/availability.ts` ka `resolveNight` isi ka aks hai):

```sql
COALESCE(rpr.rate,     rp.base_price)      AS rate
COALESCE(rpr.min_stay, rp.default_min_stay) AS min_stay
COALESCE(ri.booked_units, 0)                AS booked
COALESCE(ri.sellable_units, r.units)        AS sellable
```

Row `UPSERT` se banti hai — us waqt `total_units` aur `sellable_units` `rooms` se copy hote hain,
taake row-level CHECK mumkin ho:

```sql
CHECK (booked_units >= 0 AND booked_units <= sellable_units)
```

> **`sellable_units` alag kyun hai** (rule #25): aaj woh hamesha `total_units` ke barabar hai, yani
> overbooking namumkin. Jis din allowance chahiye hogi, **sirf DATA badlega** — ek live, bari table
> par `CHECK` ki migration nahi karni padegi.
>
> `total_units` denormalized hai kyunki `CHECK` do tables par nahi lag sakta. Partner room ke units
> badle to sirf **aane wali** dates ki rows update hongi — guzri hui bookings ka record nahi badlega.

**Partitioning abhi nahi.** `date` PK me hai, to `PARTITION BY RANGE (date)` baad me add karna
mumkin rahega — ~100M rows se pehle uski zaroorat nahi.

---

## 4. Booking transaction — deadlock se bachao

```
BEGIN
  SELECT … FROM room_inventory
   WHERE room_id = $1 AND date = ANY($2)
   ORDER BY date ASC              ← ★ tarteeb lazmi
   FOR UPDATE

  verify: is_closed=false · min_stay/max_stay/CTA/CTD · guests <= room capacity
  UPSERT booked_units + 1        → CHECK fail = DB reject
  priceBooking() server par       → client ka total kabhi nahi
  INSERT booking + add_ons + booking_events + notifications
COMMIT
```

**`ORDER BY date ASC` optional nahi hai.** Do bookings jinki dates overlap karti hain, agar
mukhtalif tarteeb me lock lein to **deadlock** ho jayega. Ek hi tarteeb = kabhi nahi.

**Lock sirf `room_inventory` par hai**, `rate_plan_rates` par nahi — stock woh cheez hai jiske liye
mukabla hota hai. Do plans ki booking ek hi room rows par lock lengi, jo bilkul theek hai.

---

## 4b. Scalability — is product ke asli hot paths

Har cheez optimize karne ki zaroorat nahi. Is product me **teen** raaste hi garam hain:

### 1. Search / listing — sabse zyada traffic, sabse kam badalta hai

```
GET /api/v1/hotels?city=&checkIn=&checkOut=&guests=&…
```

Do hisse hain, aur unhe **alag** karna hi asal optimization hai:

| Hissa | Badalta hai? | Tareeqa |
|---|---|---|
| Property catalog (naam, city, amenities, photos, description) | shaz o naadir | **cacheable** — Redis, TTL 5 min, partner edit par invalidate |
| Availability + price un dates ke liye | har booking par | **kabhi cache nahi** — hamesha live |

Yani: catalog cache se aaye, phir sirf candidate ids par availability query chale. Isse ek
search me 10,000 properties ke bajaye ~50 par mehnga hisaab hota hai.

**Index plan:**
```sql
properties     (city, status)                    -- listing filter
properties     USING GIN (amenities)             -- amenity filter
rate_calendar  PK (room_id, date)                -- range scan, pehle se
rooms          (property_id)
bookings       (customer_id, created_at DESC)    -- "my bookings"
bookings       (property_id, check_in)           -- partner reservations
```

### 2. Booking write — sabse kam traffic, sabse zyada nazuk

Yahan throughput matter nahi karta, **correctness** karti hai (§4). Ek property ki ek room-type ki
overlapping dates par lock contention hogi — magar woh **maqsood** hai. Optimization sirf itni ke
transaction **chhota** rahe: koi email, koi payment call, koi HTTP transaction ke andar nahi.
Side-effects `booking_events` ke zariye baad me.

### 3. Partner analytics — bhaari aggregates, taza hone ki zaroorat nahi

Module 10 me 37 static screens asli banenge — revenue, occupancy, ADR, pace, ranking. Ye
`bookings` par bhaari `GROUP BY` hain.

**Faisla:** live query nahi. Ek nightly job **rollup tables** bharega
(`daily_property_stats`: property_id, date, bookings, room_revenue, commission, occupancy).
Screens rollup se padhein. "Aaj ka data" ke liye current din live jud jaye.

> Isse ek analytics screen 3M bookings scan karne ke bajaye ~730 rows padhta hai.

### Aam usool

- **Pagination cursor-based**, `OFFSET` nahi — `OFFSET 10000` har baar 10,000 rows phenkta hai.
  `limit` par hard cap 100.
- **N+1 mana hai.** 20 hotels ki list par 20 alag rating queries nahi — ek `GROUP BY` ya
  `LATERAL` join. Har list endpoint ka query count test me gina jayega.
- **Stateless API** — session DB me hai, memory me nahi. To instance barhana sirf ek config change hai.
- **Har bhaari cheez background me:** email, PDF invoice, rollups, hold expiry, no-show sweep.
  Request path me kabhi nahi.

---

## 5. Security — OWASP API Security Top 10 (2023) ke against

Security is project me **checklist nahi, gate hai**. Koi module tab tak band nahi hoga jab tak ye
dus mapping poori na hon. Har module ke PR me is table ka apna hissa bhara jayega.

### API1 — Broken Object Level Authorization (BOLA / IDOR) 🔴 *sabse bara khatra*

`GET /api/v1/bookings/STY-K7M2QX` par sirf "login hai" kaafi **nahi**. Har object read/write par:

```
customer  → booking.customer_id === session.user_id
partner   → booking.property_id kisi aisi property ka ho jise session ka org manage karta ho
admin     → allowed, magar audit log ke saath
```

**Amal ka tareeqa:** ownership check **repository query me** ho, service me `if` ke tor par nahi.
`findBookingForUser(id, actor)` — jo mile hi na to `404`, `403` nahi (warna id ka wujood leak hota hai).

> Ye is API ka sabse zyada mumkin hole hai, kyunki booking ref `STY-` + 6 chars hai — guessable
> nahi lekin share ho jata hai (email, screenshot). Ownership hi asli darwaza hai.

### API2 — Broken Authentication

| Control | Faisla |
|---|---|
| Password hash | **argon2id** (bcrypt nahi) — `memoryCost` ≥ 19 MiB, OWASP ki mojooda sifarish |
| Session | httpOnly · Secure · SameSite=Lax cookie, opaque random id (JWT nahi — revoke ho sake) |
| Session store | DB table — logout aur "sab devices se nikal do" asal me kaam kare |
| Rotation | login par nayi session id · role/password badalne par purani sab batil |
| Timeout | idle 7 din · absolute 30 din |
| Enumeration | signup aur login dono par **ek hi** jawab: *"Invalid email or password"* |
| Timing | user na mile to bhi ek dummy argon2 verify chale — warna response ka waqt bata deta hai |
| Brute force | email+IP par rate limit, phir barhta hua lockout |

### API3 — Broken Object Property Level Authorization (mass assignment)

`PATCH /me/profile` se `role`, `tier`, `points`, `id`, `email_verified` **kabhi** na likhe jayen.

**Amal:** har endpoint ka apna zod schema jisme sirf allowed fields hon (`.strict()` — extra key
aaye to reject). Entity ko kabhi seedha `req.body` se spread na karein.

Ulta bhi: **response me kya nahi jana chahiye** — `password_hash`, doosre guest ka email, partner
ka payout account. Har response ka apna DTO, entity seedha kabhi return na ho.

### API4 — Unrestricted Resource Consumption

| Vector | Control |
|---|---|
| Login brute force | 5/min per IP+email |
| Quote spam (mehnga hisaab) | 30/min per session |
| Booking | 10/min per session + `Idempotency-Key` |
| Search pagination | `limit` par **hard cap 100**, default 20 |
| Payload size | body limit 256 KB |
| Query depth | koi unbounded `IN (...)` nahi — date range par max 365 din |
| DB pool | prod 20, timeouts set (pehle se) |

### API5 — Broken Function Level Authorization

Role check har route par **declarative** ho (`@Roles('partner')`), controller ke andar `if` se nahi
— warna ek route bhoolna aasan hai. Default **deny**: jis route par decorator na ho woh authenticated
+ lowest privilege maana jaye.

Partner team roles (`Admin`/`Manager`/`Staff`) **ab nafiz hain** — saat modules me, aur har jagah
do alag check: `role` batata hai KYA kar sakta hai, `propertyIds` batata hai KIN properties par.
Staff calendar parh sakta hai magar rate nahi badal sakta; manager rate badal sakta hai magar
cancellation ki shart nahi (wo waada hai, qeemat nahi); payout account sirf org admin.

*(Ye paragraph pehle kehta tha "abhi bilkul bemani hain — Staff bhi payouts badal sakta hai".
Wo Module 1 ke waqt sach tha aur ab nahi.)*

### API6 — Unrestricted Access to Sensitive Business Flows 🔴 *is product ka khaas khatra*

Booking flow khud abuse ho sakta hai:

| Abuse | Control |
|---|---|
| **Inventory hoarding** — script `pending` bookings banata rahe, pay kabhi na kare, poora hotel block | `hold_expires_at` ~15 min + cron release · per-session concurrent pending limit |
| **Quote scraping** — competitor poori rate calendar nikal le | quote rate limit · availability response me sirf poochi hui dates |
| **Promotion abuse** — client apna promotion id bheje | promotion sirf server ke **signed token** ke andar safar karta hai — client use chhoo hi nahi sakta. Isliye 15-min window me paused ho jane par bhi token ki price honour hoti hai (rule #36) |
| **Review bombing** | review sirf `completed` booking ke saath, ek booking par ek review |

### API7 — Server Side Request Forgery

Abhi koi user-supplied URL fetch nahi hoti. **Aage khatra:** property photo upload agar URL se
hui, to internal network hit ho sakta hai. Faisla: photos **sirf direct upload** (presigned S3),
URL se import nahi.

### API8 — Security Misconfiguration

helmet (maujood) · CORS sirf `WEB_ORIGIN` (maujood) · stack traces production me kabhi nahi
(maujood — `AllExceptionsFilter`) · env zod se validate (maujood) · secrets kabhi repo me nahi
(`.env` gitignored, `.env.example` committed) · `X-Powered-By` off.

### API9 — Improper Inventory Management

`/api/v1` day one se · OpenAPI zod contracts se generate ho · koi undocumented endpoint nahi ·
`/api/health` me version aur build sha.

### API10 — Unsafe Consumption of APIs

Stripe webhooks: **signature verify lazmi** aur idempotent handling (Stripe retry karta hai).
Webhook body raw chahiye — global JSON parser se pehle. Baaqi kisi bhi third-party response ko
zod se parse kiya jaye, blindly trust nahi.

### Baaqi cross-cutting

- **Price tampering:** client sirf `roomId + dates + guests + addOns` bhejta hai. Total kabhi nahi.
- **SQL injection:** Drizzle parameterize karta hai. `sql.raw()` ka istemal review ke baghair mana.
- **PII:** logs me email/phone/card kuch nahi. `request_id` se trace karo, PII se nahi.
- **Audit:** admin ka har force-transition aur impersonation log me — kaun, kab, kyun.

---

## 6. Quote token (rule #13)

`POST /api/v1/bookings/quote` ek **signed token** deta hai jisme price jam hoti hai.

```
payload: { roomId, checkIn, checkOut, guests, addOns[], pricing{}, promotionId?, exp }
signed  : HMAC (SESSION_SECRET se alag key)
validity: 15 minute
```

`POST /bookings` wahi token bhejta hai. Server:
1. signature verify kare
2. `exp` check kare — guzar gaya to `409 quote_expired`, guest dobara quote le
3. token ke andar ke `roomId`/`dates`/`guests` request se match karein
4. **phir bhi** availability aur promotion dobara check ho (§5.7) — token price ki guarantee hai,
   inventory ki nahi

> Isse guest ko checkout par price badalti nazar nahi aati, aur server phir bhi authoritative
> rehta hai — client ne sirf woh cheez wapas bheji jo server ne khud sign ki thi.

---

## 7. Currency (rule #12)

**Sirf USD.** Koi `currency` column nahi, koi exchange rate nahi.

`UserSettings.currency` frontend me maujood hai magar use kahin nahi hota — woh field rahegi
(UI setting ke tor par) magar backend uspar koi amal nahi karega.

> Multi-currency baad me aa sakti hai. Us waqt migration bara hoga, lekin scope bhi wazeh hoga —
> abhi guess karke har table me currency column daalna aur bhi mehnga hai.

---

## 8. Testing

| Layer | Kya test hoga |
|---|---|
| **Domain** | Unit tests, koi DB nahi. Har pricing/refund/availability rule ka apna test — yehi sabse zaroori hai |
| **Service** | Integration, asli Postgres (testcontainers). Khaaskar booking transaction |
| **Concurrency** | **Overbooking ka test lazmi** — 2 parallel bookings, 1 unit, exactly 1 kamyab ho |
| **Contract** | zod schemas dono taraf same — shared package isi liye hai |
| **Security** | har module ke saath, neeche |

Overbooking test ke baghair `CHECK` constraint sirf ek umeed hai, guarantee nahi.

### Security tests — har module me lazmi

Ye "manual review" par nahi chhodenge, inka **test likha jayega**:

| Test | Kya sabit karta hai |
|---|---|
| User A, User B ki booking `GET` kare → **404** | API1 (BOLA) — aur 403 nahi, warna id ka wujood leak hota hai |
| Partner A, Partner B ki property `PATCH` kare → **404** | API1 tenant isolation |
| `PATCH /me/profile` me `{"role":"admin"}` bheja jaye → **400**, aur role na badle | API3 mass assignment |
| Response me `password_hash` kabhi na ho | API3 output |
| Ghalat password aur na-maujood email ka response **byte-identical** ho | API2 enumeration |
| 6th login attempt ek minute me → **429** | API4 |
| Wahi `Idempotency-Key` do baar → ek hi booking, dono baar wahi jawab | API4 / duplicate |
| Client `total` bheje → **ignore ho**, server ka apna hisaab lage | price tampering |
| Expired quote token → **409 `quote_expired`** | §6 |
| Booking ke waqt promotion pause ho jaye → discount **na lage** | API6 |
| 2 parallel bookings, 1 unit → **exactly 1** kamyab | §4 overbooking |
| Ghalat signature wala Stripe webhook → **400** | API10 |

Inme se koi bhi test fail ho to module band nahi hoga.

---

## 9. Observability

- **Structured JSON logs**, har request par `request_id`
- Har booking transaction ka nateeja log ho — khaaskar reject hone ki wajah (`sold_out`,
  `min_stay`, `capacity`, `quote_expired`), taake conversion drop ki asli wajah pata chale
- Health: `/api/health` (liveness) · `/api/health/db` (readiness) — **pehle se maujood**

---

## 9b. Har module kaise chalega (rhythm)

Har module in **saat qadmon** se guzrega. Koi qadam chhoda nahi jayega, aur module tab tak band
nahi hoga jab tak saaton na hon.

| # | Qadam | Natija |
|---|---|---|
| 1 | **Sawal poochho** | Us module ke business sawal — pehle, code likhne se nahi. Jawab `BUSINESS-RULES.md` me rule ban kar darj hon |
| 2 | **Contract** | `shared/contracts` me zod schemas — request, response, error codes. Ye API ka mua'ahida hai |
| 3 | **Domain** | Pure functions `shared/domain` me, agar module koi naya rule laye. Koi DB, koi framework |
| 4 | **Schema** | Drizzle tables + migration. `db:generate` se, haath se nahi |
| 5 | **Implementation** | Controller (patla) → Service (transaction + authorization) → Repository (sirf DB) |
| 6 | **Tests** | Domain unit + service integration + **§8 ke security tests** us module ke hisse ke |
| 7 | **Security gate** | §5 ka OWASP table bhara jaye — har row par ya to control, ya "is module par lagoo nahi" ki wajah |

**Band hone ki shart:** `typecheck` · `lint` · `build` · `test` chaaron green, aur §5 ka table
poora. Iske baghair agla module shuru nahi hoga.

### Ek qarz jo abhi record kar raha hoon

`frontend/src/lib/domain.ts` (517 lines) abhi bhi maujood hai aur dollars me kaam karta hai,
jabke `shared/domain` cents me hoga. Do implementations — bilkul woh cheez jisse bachna hai.

**Abhi isay delete nahi kiya ja sakta:** frontend ka poora prototype zustand store par chalta hai
aur uska 144-page build clean hai. Usay aaj cents + naye types par le jana bara refactor hai
jiska koi faida nahi jab tak API maujood hi nahi.

**Nikalne ka rasta:** har module jab apni screens ko API par le jayega, us hisse ka istemal
khatam hota jayega. **`frontend/src/lib/domain.ts` tab delete hoga jab aakhri screen store se
hategi** — Module 10 ke aas paas. Tab tak ye jaan-bujh kar rakha gaya scaffolding hai, bhoola
hua duplicate nahi.

---

## 10. Module map

Har module apne security gate (§5) aur apne tests ke saath band hoga. Agla tab shuru hoga.

| # | Module | Deliverable |
|---|---|---|
| **0** | Foundation | `shared/` package · contracts · config · db · error shape · logging · rate limit · `/api/v1` |
| 1 | Auth | users · session cookie · roles · guards · tier · §5.3 §5.8 §5.9 |
| 2 | Catalog | properties · rooms · **rate plans** · **amenities (controlled)** · photos · value-adds · policies · timezone |
| 3 | Inventory | **two** sparse calendars (`room_inventory` + `rate_plan_rates`) · availability · restrictions · bulk close |
| 4 | Pricing | quote engine · quote token · promotions (channels) · value-adds |
| 5 | Booking | transactional create · modify (inventory swap) · cancel · state machine · idempotency · §5.1 §5.5 §5.6 |
| 6 | Reviews | write (eligibility #39) · **derive rating in SQL, never stored** · partner reply · flag → admin moderation (#40) · author withdraw, no rewrite (#41) · keyset paging |
| 7 | Payments | **provider port** (entity PK → Safepay/PayFast, fake adapter in tests) · `prepay`/`guarantee` (#42) · signed idempotent webhooks (#45) · hold sweeper + advisory lock (#44) · refunds & penalties from `refundFor` (#46) |
| 8 | Finance | fortnightly run 1 & 16 (#48) · 7-day hold (#49) · $100 carry (#50) · **signed net** — negative = invoice (#52) · payout port + advisory lock · admin-verified accounts |
| 9 | Notifications | **outbox** — enqueue in the event's transaction, send from a worker (#57) · SendGrid port, templates in the repo (#55) · three consent classes (#56) · signup now enumeration-safe (#58) |
| 10 | Partner | org profile (#59) · email invites, hashed + 7 din + ek baar (#60) · aakhri admin guard (#61) · role + propertyIds scoping |
| 10 | Analytics | stay-date ledger `booking_nights` (#62) · 8 partner endpoints · ADR/occupancy/RevPAR · gumnaam comparables (#65) · revenue sirf manager+ (#66) · search events se ab (#67, #68) · **Demand + Ranking screens baqi** |
| 11 | Admin | moderation · audit · settings |
| 12 | Onboarding | join wizard → `pending_review` → approval |
| 13 | Support | tickets |
