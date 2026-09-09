# Stayora — Frontend Check (complete)

**Date:** 2026-08-18 · **Scope:** `frontend/` — sab 144 routes, 5 surfaces
**Dimensions:** functional + data flow · business rules · bugs/correctness · UI/design
**Action taken:** koi code change nahi — sirf findings.

> Ye report July ki `AUDIT-REPORT.md` / `FIX-PLAN.md` ko **replace** karti hai. Woh dono
> partly stale hain: unme `src/data/dashboard.ts` ka zikr hai jo ab exist nahi karta, aur
> "three disconnected data universes" wala masla site/dashboard ke liye fix ho chuka hai.
> Lekin `/admin` unke **baad** bana aur apni alag duniya le kar aaya.

---

## 0. Scorecard

| | |
|---|---|
| Routes | **144** · 372 `.tsx` files |
| `npm run typecheck` | ✅ clean |
| `npm run lint` | ✅ clean |
| `npm run build` | ✅ 144/144 pages |
| Broken internal links | **0** (138 distinct links checked) |
| Orphan routes | **1** real (`/__seedcheck`) |
| Images without `alt` | **0** |
| Hardcoded hex colors | **0** |
| Auth gates | **0** — har surface publicly khula hai |

Build-level sehat achhi hai. Masle **behaviour** aur **data connectedness** me hain.

---

## 1. Surfaces — kya kitna asli hai

| Surface | Routes | Data source | Halat |
|---|---|---|---|
| `(site)` | 17 | store (10 files) + `@/data` (3, sirf SSG metadata) | ✅ **connected** |
| `dashboard` | 10 | store (14 files) | ✅ **connected** |
| `extranet` | 60 | store (34) **+ static `@/data/extranet` (47)** | ⚠️ **hybrid** |
| `admin` | 25 | `@/data/admin` + `@/lib/admin` — store se **zero** rabta | ⚠️ **isolated** |
| `join` | 29 | apna localStorage context, koi store nahi | ⚠️ **dead-end** |
| `(auth)` | 2 | kuch nahi | ❌ **theatre** |

### Extranet ka asli hisaab (60 routes)

| | Routes |
|---|---|
| **Live** (store se padhta/likhta) | **15** — property/*, rates/calendar, rates/availability, rates/open-close, rates/value-adds, reservations, reservations/cancellations, reviews, properties, inbox/support |
| **Mixed** (dono) | 5 — `/extranet`, account, inbox, promotions, property |
| **Static** (sirf hardcoded numbers) | **37** — poora analytics (11), poora boost (5), poora finance (5), account ka bara hissa, rates ka aadha |
| Khali | 3 |

> **37 extranet screens aise numbers dikhate hain jinka kisi asli booking se koi taluq nahi.**
> Revenue, occupancy, commission, payouts, ranking, demand — sab fixed fixtures hain. Partner
> ek booking cancel kare to finance screen ka total nahi hilta.

---

## 2. Data flow — ab **4** duniyaein hain, 3 nahi

```
1. Unified store          src/store  ← site + dashboard + extranet ka 1/3 hissa
   (zustand + localStorage "stayora-store-v1", seed src/data se)

2. Static extranet        src/data/extranet/*        ← extranet ke 37 screens
   (analytics, finance, boost — store se bilkul juda)

3. Static admin           src/data/admin/* + src/lib/admin/api/store.ts
   (apna in-memory db + react-query mutations — poori tarah alag universe)

4. Join wizard draft      apna localStorage key, apne types (src/app/join/_lib/types.ts)
   (kisi ke saath connected nahi; submit par kahin nahi jata)
```

### Admin ke baare me ek zaroori correction

Admin ko "toast stubs" samajhna **ghalat** hai. Uske paas sabse **pukhta** architecture hai:

```
src/lib/admin/api/
  transport.ts   ← request() — comment me hi likha hai "the swap seam"
  endpoints.ts   ← 1082 lines, typed API surface
  hooks.ts       ← react-query: useCancelReservation, useSetReviewStatus,
                   useTransitionProperty, useRetryPayout, useInviteManager…
  store.ts       ← in-memory mutable db, mutations yahan asli likhte hain
```

Yani admin ke actions **kaam karte hain** — bas ek mock db par. Backend aane par ye surface
sabse aasan swap hoga. Masla sirf ye hai ke uska db baaqi product se juda nahi.

### 4 duniyaon ka nateeja

| | site/dashboard | extranet | admin |
|---|---|---|---|
| Ek booking cancel hui | dikhti hai | dikhti hai (15 live screens par) | **nahi dikhti** |
| Partner ne rate badla | dikhta hai | dikhta hai | **nahi dikhta** |
| Admin ne property suspend ki | **nahi dikhta** | **nahi dikhta** | dikhti hai |
| Join se nayi property aayi | **kahin nahi** | **kahin nahi** | **kahin nahi** |

---

## 3. Business rules inventory

Ye woh sab rules hain jo **pehle se code me likhe hue** hain. Discussion ke liye asli material.
Sab kuch `src/lib/domain.ts` (517 lines) me hai — koi doosra implementation nahi.

### 3.1 Pricing — order of operations

```
roomSubtotal  = har raat ka rate jama (rateForDate se, per-date override honoring)
ratePerNight  = roomSubtotal / nights          (display ke liye average)
discount      = discountAmount(...)             ← roomSubtotal par lagta hai
extras        = addOns ka jama
subtotal      = roomSubtotal − discount + extras
taxes         = taxLinesFor(subtotal, nights, guests)
total         = subtotal + taxTotal
```

**Discount types**
| type | hisaab |
|---|---|
| `percent` | `roomSubtotal × value / 100` |
| `amount` | `min(value, roomSubtotal)` — subtotal se zyada nahi ho sakta |
| `freeNight` | `floor(nights / value) × ratePerNight` — har N-vi raat free |

**Tax kinds**
| kind | hisaab |
|---|---|
| `percent` | `subtotal × value / 100` |
| `perNight` | `value × nights` |
| `perPersonPerNight` | `value × nights × guests` |

Har tax line par `includedInDisplayPrice` flag hai — `true` = rate me shamil, `false` = checkout par alag.
Default hotels: 10% VAT + $25/night city tax. Resort hotels ka set alag hai.

**Value-add units:** `per stay` · `per night` (×nights) · `per person` (×guests)

**Rate override:** partner jab kisi date ka rate badalta hai, woh **base (sabse sasta) room** ke
against hota hai. Baaki rooms ka rate `room.price / hotel.price` ratio se scale hota hai — taake
suite hamesha standard room se mehngi rahe.

### 3.2 Availability

```
checkStay()      → nights > 0 · nights >= minStay · koi date closedDates me na ho
unitsBookedOn()  → ek raat par kitne units ghire hue  [checkIn, checkOut) — departure raat free
unitsLeft()      → poore stay me sabse tang raat jeetti hai
checkAvailability() → checkStay + guests <= room.guests + unitsLeft > 0
```

Cancelled bookings apna inventory **chhod dete hain** (`holdsInventory`).
Booking modify karte waqt `ignoreBookingId` se apni hi reservation exclude hoti hai.

### 3.3 Cancellation / refund

```
daysToArrival >= 2  → full refund
daysToArrival >= 0  → 50% refund
warna              → 0
```

### 3.4 Promotions

`activeDiscountFor` sirf woh promotion uthata hai jo: `status === "active"` **aur**
`channel === "all"` **aur** aaj ki date window me ho. Ek se zyada ho to "best offer" jeetti hai,
ranking `percent → value×10`, `amount → value`.

### 3.5 Booking reference

`STY-` + 6 chars, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 chars — `I O 0 1` jaan bujh kar nikale gaye).
Bookings me collision check hai (20 attempts), **tickets me nahi**.

### 3.6 Booking statuses

`confirmed · pending · checked_in · checked_out · completed · cancelled`
Sources: `Direct · Booking.com · Expedia · Travel Agency`

---

## 4. Business rules ke 8 khule sawal

**Ye woh cheezein hain jin par discussion me faisla chahiye.** Har ek abhi code me ek tarah se
likhi hai, lekin woh tareeqa jaan-bujh kar chuna gaya ya ittefaqan bana — ye clear nahi.

**1. Cancellation policy do jagah hai, aur woh alag ho sakti hain.**
`refundFor()` hardcoded hai: 48 ghante / 50%. Lekin har hotel ka `policies.cancellation` ek
**editable text** hai jo guest ko checkout par dikhaya jata hai, aur extranet se badla ja sakta hai
(`updatePolicies`). Abhi dono match karte hain — sirf isliye ke sab hotels ek hi `defaultPolicies`
copy karte hain. Partner ne text badla to guest ko kuch aur dikhega, refund kuch aur milega.
→ *Policy structured honi chahiye (days + percent), prose nahi?*

**2. `percent` tax add-ons par bhi lagta hai, aur discount ke baad lagta hai.**
`subtotal = roomSubtotal − discount + addOns`, phir uspar 10% VAT. Yani spa treatment par bhi
room tax lag raha hai, aur discount tax bacha raha hai. Dono asli business decisions hain.
→ *Sahi hai? Ya tax sirf room par, discount se pehle?*

**3. `mobile` aur `genius` channel ki promotions kahin apply hi nahi hotin.**
`Promotion.channel` type me maujood hai, extranet me set bhi hoti hai, lekin
`activeDiscountFor` sirf `channel === "all"` filter karta hai. Yani mobile-only deal banao to
woh kabhi kisi ko nahi milegi.
→ *Channel targeting chahiye, ya field hi hata dein?*

**4. "Best offer" ka ranking khaam hai.**
`percent → value×10`, `amount → value`. Yani 5% discount (score 50) aur $50 off (score 50)
barabar hain — chahe stay $200 ka ho ya $5000 ka. Asli behtar offer stay ki value par depend karti hai.
→ *Actual saved amount se compare karein?*

**5. `minStay` property-level hai — per-date ya per-room nahi.**
Asal duniya me min-stay weekend/season par badalta hai aur room type se bhi. Abhi ek hi number
poore hotel ke liye hai.
→ *Per-date min-stay chahiye? (backend ka `rate_calendar` isko support kar sakta hai)*

**6. Booking status ka koi state machine nahi.**
`setBookingStatus(id, status)` me **zero guards** hain — cancelled booking wapas confirmed ho
sakti hai, `checked_out` `checked_in` se pehle set ho sakta hai. `cancelBooking` bhi pehle se
cancelled booking ko dobara cancel kar ke refund recompute kar deta hai.
→ *Allowed transitions ki list chahiye.*

**7. Strikethrough sirf percent discounts par dikhta hai.**
`originalPrice()` `amount` aur `freeNight` ke liye `undefined` deta hai — to $50-off wale hotel
par purani price cut ke nahi dikhti.
→ *Jaan bujh kar, ya missing?*

**8. Ticket references collide karenge.**
`makeTicketRef()` sirf `TKT-1000`…`TKT-9999` deta hai aur uniqueness check nahi karta,
jabke bookings ke liye `uniqueBookingRef()` 20 attempts karta hai.
→ *Backend me sequence/UUID.*

---

## 5. Functional gaps — jo bilkul kuch nahi karta

### 5.1 Auth — poora theatre

```ts
// (auth)/login/page.tsx
function onSubmit() {                       // ← form values leta tak nahi
  toast.success("Signed in", …)
  router.push("/dashboard")
}
```

Signup bhi bilkul yehi. Aur **poore product me ek bhi auth gate nahi** — `/dashboard`,
`/extranet`, `/admin` sab bina kisi check ke khule hain. Zustand store me koi session/user
concept hi nahi; "current user" ek fixed `profile` object hai.

### 5.2 Join wizard — 29 steps, jinka anjaam kuch nahi

Wizard **theek kaam karta hai**: apna localStorage draft rakhta hai, steps ke darmiyan state
bachti hai. Lekin aakhri step:

```ts
// join/complete/page.tsx
toast.success("Registration complete")
router.push(href("done"))
```

Bas. Na koi hotel banta hai, na koi partner account, na admin ke pending-approval queue me
kuch jata hai. 29 screens ka data localStorage me pada reh jata hai.

### 5.3 Toast-only actions

66 files `toast()` use karte hain; unme se **31 me koi store write ya API mutation nahi**:

| Surface | Aise files |
|---|---|
| join | 15 (wizard steps apne context me likhte hain — asli theatre sirf final submit hai) |
| extranet | 10 |
| `(site)` | 2 |
| `(auth)` | 2 |
| dashboard | 1 |

### 5.4 SSG metadata static data se aati hai

`(site)/hotels/[id]/page.tsx` ka `generateMetadata` `@/data` se padhta hai (store se nahi).
Partner hotel ka naam badle to page ka `<title>` aur meta description purana hi rahega.
(Rendering khud sahi hai — `<HotelDetail>` store se padhta hai.)

---

## 6. Bugs & correctness

| # | Finding | Severity |
|---|---|---|
| 1 | `/__seedcheck` route build me ship ho raha hai — file me khud likha hai *"TEMPORARY build-time probe — deleted after verification"* | 🟡 |
| 2 | 144 routes par sirf **1** `loading.tsx`, **1** `error.tsx`, **2** `not-found.tsx` | 🟡 |
| 3 | `setBookingStatus` par koi transition guard nahi (§4.6) | 🔴 |
| 4 | `makeTicketRef()` collide karega (§4.8) | 🟡 |
| 5 | 6 `console.*` calls source me bache hue | 🟢 |
| 6 | 4 `TODO`/`FIXME` markers | 🟢 |
| 7 | 156 `<Input>` vs 145 `htmlFor` — ~11 inputs bina associated label | 🟡 |

**Jo saaf nikla:** 0 broken links · 0 missing `alt` · 0 hardcoded hex · typecheck/lint/build sab clean.

---

## 7. UI / design consistency

Achhi halat me. Design system consistently use hua hai.

- **Hardcoded hex: 0.** Sab colors theme tokens ya Tailwind palette se.
- **Amber:** 39 usages — AGENTS.md ke mutabiq stars/status ke liye allowed.
- **Palette classes:** ~80 usages `emerald`/`green` ki (success states), thodi si `sky`/`rose`.
  AGENTS.md kehta hai "amber ke ilawa koi hardcoded color nahi" — ye us rule se thoda bahar hai.
  → *Success/warning/danger ke liye bhi tokens define kar dein?*
- **States:** `EmptyState` 9 files me, `Skeleton` 21 me, `isLoading` 31 me — lekin ye zyadatar
  admin surface me hai (jahan react-query hai). Store-based surfaces me loading state ki
  zaroorat hi nahi thi kyunki data synchronous hai — **backend aane par ye har jagah chahiye hoga.**

---

## 8. Iska matlab backend ke liye (khulasa)

Sirf ishara — poora plan discussion ke baad.

1. **`domain.ts` sabse bara asset hai.** 517 lines, framework-free, har rule wahan hai. Server par
   as-is chalega.
2. **Admin ka `transport.ts` seam ready hai.** Ek function badalne se 25 screens real ho jayenge.
3. **Sabse bara kaam extranet ka static hissa hai** — 37 screens ke numbers abhi kahin se nahi aate.
   Inke liye asli aggregate queries likhni hongi.
4. **Auth zero se banega**, aur ye sirf login page ka kaam nahi — store me `currentUser` ka
   concept hi nahi hai.
5. **Join wizard ka output kahin jana chahiye** — abhi 29 steps ka data localStorage me marta hai.
6. **§4 ke 8 sawal** DB schema likhne se pehle tay hone chahiyen — khaaskar #1 (cancellation
   structured vs prose), #2 (tax base), aur #5 (per-date min-stay), kyunki teenon table design
   badalte hain.
