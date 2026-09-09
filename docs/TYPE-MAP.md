# Module 0 — Type Map (Phase 0 ka deliverable)

**Date:** 2026-08-18
**Maqsad:** teen type systems → ek canonical model, taake Drizzle schema likhna mechanical reh jaye.

| File | Objects | Unions |
|---|---|---|
| `frontend/src/types/index.ts` | 26 | 19 |
| `frontend/src/lib/admin/types.ts` | 28 | 26 |
| `frontend/src/lib/extranet/types.ts` | 47 | 2 |

14 naam ek se zyada file me hain.

---

## 0. Sabse ahem baat — ye teen mukhtalif model nahi hain

Har audit me ye "three competing type systems" ki tarah likha gaya. Field-by-field diff nikalne
par asli tasveer alag nikli:

> **`src/types` asli entity model hai. `admin` aur `extranet` ke types uske
> read-DTOs / projections hain — jinme kuch computed metrics aur chand asli naye fields hain.**

Saboot — `Property` ke teen "versions":

| Field | `core.Hotel` | `admin.Property` | `extranet.Property` |
|---|---|---|---|
| `rooms` | **`Room[]`** (poori list) | `number` (**ginti**) | `number` (**ginti**) |
| `policies` · `taxLines` · `valueAdds` · `photos` · `availability` | ✅ | — | — |
| `adr` · `occupancy` · `revenueToday` | — | ✅ **computed** | ✅ **computed** |
| `rating` | derive hoti hai | — | ✅ stored |

`admin.Property` ke paas entity ka koi hissa nahi — na rooms, na policies, na rates. Uske paas
sirf **list screen par jo dikhana hai** woh hai. Yehi `Reservation`, `Guest` aur `Review` ka bhi
haal hai.

**Iska matlab:** Phase 0 "teen me se ek chuno" nahi hai. Ye hai —

```
Entity (DB me)          =  core types, kuch missing fields ke saath (§4)
Admin/extranet ki shakl =  API ke DTOs, entity + aggregate se derive
```

Yani zyada tar "conflict" asal me **conflict hai hi nahi**. Asli kaam do jagah hai: **enums** (§3)
aur **woh fields jo sirf admin/extranet jaante hain** (§4).

---

## 1. Canonical entities

| Canonical | Kis se bana | Kya ban jayega |
|---|---|---|
| **`Property`** *(naam badla: `Hotel` → `Property`)* | `core.Hotel` | `admin.Property` → `PropertyListItem` DTO · `extranet.Property` → `PartnerPropertyListItem` DTO |
| **`Room`** | `core.Room` | — |
| **`Booking`** | `core.Booking` | `admin.Reservation` → `ReservationListItem` DTO |
| **`User`** | `core.UserProfile` | `admin.Guest` → `GuestListItem` DTO |
| **`PartnerOrg`** | `admin.Client` | — (naya entity, sirf admin jaanta tha) |
| **`PartnerMember`** | `admin.Manager` + `extranet.TeamUser` | dono ek hi cheez hain (§5) |
| **`Review`** | `core.Review` | `admin.Review` → `ReviewModerationItem` DTO |
| **`Promotion`** | `core.Promotion` | `admin.Promotion` → `PromotionListItem` DTO |
| **`SupportTicket`** | `core.SupportTicket` | — |

> **`Hotel` → `Property` kyun?** Product me Resorts bhi hain (`PropertyType = "Hotel" | "Resort"`),
> to `Hotel` naam khud hi ghalat hai — ek `Hotel` jiska `type: "Resort"` ho, ye padhne me ajeeb hai.
> Admin aur extranet dono pehle se `Property` kehte hain. Sirf `core` alag tha.

---

## 2. Field mapping — naam jo badle

### Property

| `core.Hotel` | Canonical | Note |
|---|---|---|
| `pricePerNight` | `basePrice` | ye sabse saste room ka rate hai, "the" price nahi — naam gumraah karta tha |
| `availability.closedDates` · `.rateOverrides` · `.minStay` | **`rate_calendar` table** | rule #5 — object khatam |
| `taxLines` | — | **delete** (rule #11) |
| `managedBy` | `partnerOrgId` | FK saaf ho |
| `policies.cancellation` | `cancelFreeUntil` + `cancelCharge` + `cancelChargeValue` | rule #1 — prose khatam |
| — | **`timezone`** | naya, IANA (`Asia/Tokyo`) — `ARCHITECTURE.md` §1.4 |
| — | **`status`** | naya, admin se (§4) |

### Booking

| `core.Booking` | `admin.Reservation` | Canonical |
|---|---|---|
| `hotelId` | `propertyId` | **`propertyId`** |
| `hotelName` | — | `propertyName` (snapshot) |
| `guest: BookingGuest` | `guestName` · `guestEmail` · `guestPhone` (flat) | **nested `guest`** — admin ka flat DTO se banega |
| `roomId` + `roomName` | `room: string` | **dono** rakhein |
| `pricing: BookingPricing` | `total: Money` | **poori `pricing`** — `total` DTO me derive |
| `payment: { method, status }` | `paymentMethod: string` | **nested** |
| — | — | **`commissionAmount`** + **`commissionStatus`** (rule #9) |
| — | — | **`holdExpiresAt`** (rule #6 / API6) |

### Review

| `core.Review` | `admin.Review` | Canonical |
|---|---|---|
| `hotelId` | `propertyId` | **`propertyId`** |
| `author` + `authorId` + `authorSeed` | `guestName` (flat) | **teenon** rakhein |
| `response?: ReviewResponse` *(text + date)* | `response: string \| null` | **`ReviewResponse`** — admin date kho deta tha |
| — | `flagReason: string \| null` | ✅ **add karein** — moderation ko wajah chahiye |

### Promotion

| `core.Promotion` | `admin.Promotion` | Canonical |
|---|---|---|
| `hotelIds` | `propertyIds` | **`propertyIds`** |
| `discount: Discount` *(structured)* | `discount: number` | **`Discount`** — admin type kho deta tha |
| `startDate` + `endDate` | `travelWindow: string` *(prose!)* | **do date columns** |
| `channel` | — | **rakhein** (rule #3) |
| — | `kind: PromotionKind` | ❓ faisla chahiye (§6) |

---

## 3. Enums — asli takrao yahan hai

Yahan sirf casing ka masla nahi, **values hi mukhtalif hain**.

| Concept | `core` | `admin` | Canonical |
|---|---|---|---|
| **Booking status** | `confirmed` `pending` `checked_in` `checked_out` `completed` `cancelled` | `Pending` `Confirmed` `Checked In` `Checked Out` `Cancelled` **`No-show`** | `pending` `confirmed` `checked_in` `completed` `no_show` `cancelled` *(rule #6)* |
| **Review status** | `published` `pending` `flagged` `rejected` | `Published` `Flagged` `Pending Review` **`Hidden`** | `published` `pending` `flagged` `rejected` |
| **Ticket status** | `open` `in_progress` `resolved` | `Open` `In Progress` `Resolved` | `open` `in_progress` `resolved` |
| **Ticket priority** | `low` `medium` `high` | `Low` `Medium` `High` | `low` `medium` `high` |
| **Promotion status** | `active` `paused` `draft` | `Active` **`Scheduled`** `Paused` **`Ended`** | `draft` `scheduled` `active` `paused` `ended` |
| **Booking source** | `Direct` `Booking.com` `Expedia` `Travel Agency` | wahi | `direct` `booking_com` `expedia` `travel_agency` |
| **Property status** | *(nahi hai)* | `Draft` `Pending` `Active` `Rejected` `Changes Requested` `Suspended` | `draft` `pending_review` `active` `rejected` `changes_requested` `suspended` |

**Usool: `snake_case` lowercase, hamesha.** Display labels frontend ka kaam hain, DB values ka nahi.

Do cheezein jo qabil-e-zikr hain:

- **Admin ke paas `No-show` pehle se tha.** Rule #6 me humne `no_show` add karne ka faisla kiya —
  woh naya invention nahi, admin panel isay pehle se model kar raha tha. Achhi tasdeeq.
- **`Hidden` ≠ `rejected`.** Admin ka `Hidden` (dikhao mat) aur core ka `rejected` (mustard kar diya)
  alag cheezein hain. Canonical `rejected` leta hai — `published`/`pending`/`flagged`/`rejected` ka
  chakkar poora hai aur "hidden" `rejected` hi ki ek shakal hai.
- **Promotion status me admin ke `Scheduled` aur `Ended` asli hain** — core me `startDate`/`endDate`
  to the, magar status me woh nahi jhalakta tha. Canonical dono le raha hai.

---

## 4. Fields jo sirf admin/extranet jaante hain — canonical me aane chahiyen

| Field | Kahan se | Kyun chahiye |
|---|---|---|
| `Property.status` | `admin.PropertyStatus` | **join wizard ka anjaam** — `draft → pending_review → active`. Iske baghair Module 12 ban hi nahi sakta |
| `Property.verification` | `admin.VerificationStatus` | join wizard documents collect karta hai, kahin jate nahi the |
| `Review.flagReason` | `admin.Review` | moderation ko wajah chahiye |
| `Promotion.status: scheduled\|ended` | `admin.PromotionStatus` | date window se derive, magar explicit better |
| `PartnerOrg` (poora entity) | `admin.Client` | plan tier, subscription, billing — `core` me ye concept hai hi nahi |
| `PartnerMember.propertyIds` | `admin.Manager` | ek staff sirf kuch properties dekhe — RBAC ki buniyad |

---

## 5. `admin.Manager` aur `extranet.TeamUser` ek hi cheez hain

Dono partner ke staff hain. Farq sirf **role ki lughat** me hai:

| | Roles |
|---|---|
| `admin.ManagerRole` | `Owner` · `General Manager` · `Revenue Manager` · `Front Desk Manager` · `Staff` |
| `extranet.TeamUser.role` | `Admin` · `Manager` · `Staff` |

Ye **do alag RBAC systems** hain ek hi concept ke liye. Ek chunna hoga (§6).

Yaad rahe: audit me nikla tha ke **abhi ye roles bilkul bemani hain** — `Staff` bhi payouts badal
sakta hai. To ye sirf naam ka faisla nahi, asli permission matrix bhi isi ke saath banega.

---

## 6. Teen faisle — tay ho gaye

| | Faisla |
|---|---|
| **A. Partner staff roles** | **3-role permission model**: `admin` · `manager` · `staff` |
| **B. `stars`** | ✅ **add** — official classification, review score se alag cheez |
| **C. `Promotion.kind`** | ✅ **rakhein** — reporting ke liye |

### A. Partner permission matrix

`admin.ManagerRole` ke 5 job titles chhod kar `extranet.TeamUser` wala 3-role permission model.
Wajah: role **permission level** hai, job title nahi — naya title (Housekeeping Manager) aane par
enum badalna nahi padta.

Audit me nikla tha ke abhi ye roles **bilkul bemani** hain — `Staff` bhi payouts badal sakta hai.
To matrix ab asli hogi:

| Capability | `admin` | `manager` | `staff` |
|---|:---:|:---:|:---:|
| Reservations dekhna | ✅ | ✅ | ✅ |
| Check-in / check-out · room number | ✅ | ✅ | ✅ |
| Reservation cancel · no-show mark | ✅ | ✅ | ❌ |
| Rates · availability · restrictions | ✅ | ✅ | ❌ |
| Promotions banana / badalna | ✅ | ✅ | ❌ |
| Property content (photos, description, policies) | ✅ | ✅ | ❌ |
| Review ka jawab | ✅ | ✅ | ❌ |
| Finance dekhna (revenue, commission) | ✅ | ❌ | ❌ |
| Payout · bank details | ✅ | ❌ | ❌ |
| Team invite / remove | ✅ | ❌ | ❌ |
| Org settings · contract | ✅ | ❌ | ❌ |

**Property scoping bhi hai.** `PartnerMember.propertyIds` — ek member sirf kuch properties tak
mehdood ho sakta hai (`admin.Manager` me ye pehle se tha). Khali array = org ki saari properties.

> Do layer hain: **role** batata hai *kya kar sakte ho*, **propertyIds** batata hai *kis par*.
> Dono check honge — `ARCHITECTURE.md` §5 API1 (tenant isolation) aur API5 (function-level auth).

### B. `stars`

`Property.stars: number | null` — 1–5, official darja. Guest ke review score se bilkul alag cheez;
`deriveRating()` waisa hi rahega. Public site abhi use na kare to bhi data maujood hoga
(uska filter jaan bujh kar review-score buckets par gaya tha).

### C. `Promotion.kind`

`seasonal_deal` · `limited_time` · `member_exclusive` · `group_booking` · `early_bird` ·
`last_minute` · `flash`

Pricing par **koi asar nahi** — sirf categorization. `discountAmount()` isay nahi dekhta.

---

## 7. Iske baad

Ye teen jawab aate hi:

1. `shared/types` — canonical model likha jayega
2. `shared/domain.ts` — 13 rules ke mutabiq updated (cents me, tax ke baghair)
3. `shared/contracts` — zod schemas
4. Phir Drizzle schema **mechanical** kaam reh jayega
