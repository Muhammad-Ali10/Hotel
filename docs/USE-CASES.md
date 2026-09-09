# Stayora — Use Cases, Tafseel Ke Saath

> ⚠️ **Ye document aaj ki maujooda haalat bayan karta hai.** Iske baad `BUSINESS-RULES.md`
> me **rule #11 — tax poora khatam** aur **#10 — `per person per night` unit** tay ho chuke hain.
> Neeche ke tamam price examples me VAT / Service / City tax **hat jayenge**, aur
> "Daily breakfast" ki price barhegi. Faisle ke baad ke numbers `BUSINESS-RULES.md` §11 me hain.

`PRODUCT-FLOW.md` ek seedhi kahani thi. Ye document us kahani ke **saare raaste** kholta hai —
har woh soorat jo asal me pesh aati hai, asli numbers ke saath.

**Reference data (sab code se):**

| | |
|---|---|
| Hotel | The Ritz-Carlton, New York — base $580 |
| Rooms | Standard $580 (2 guests, 40 units) · Deluxe King $725 (2, 28) · Premium King $870 (3) |
| Taxes | VAT 10% · Service 5% · City tax $3.50/guest/night · (Resorts: +$25/night) |
| Add-ons | Airport transfer $65 *per stay* · Early check-in $35 *per stay* · Daily breakfast $32 *per person* · Spa $120 *per person* |
| Commission | 15% |
| Ritz band dates | aaj se 14, 15, 16 din baad |

Nishan: ✅ aaj kaam karta hai · ⚠️ aadha · ❌ bilkul nahi

---

# A. Booking kaise banti hai — chaar raaste

## A1 — Public site, card se (aam raasta) ✅

John site par booking karta hai, card se pay karta hai.

```
status         = "confirmed"
payment        = { method: "card", status: "paid" }
source         = "Direct"
customerId     = "usr-john-doe"
```

Booking uske dashboard me aa jati hai, Sarah ke extranet me bhi. Dono ko notification.

## A2 — Public site, "property par pay karunga" ⚠️

Wahi flow, magar John *Pay at property* chunta hai.

```
status         = "confirmed"      ← booking pakki
payment        = { method: "property", status: "pending" }
```

**Masla:** booking `confirmed` hai aur kamra rok liya gaya hai, magar paisa aaya hi nahi. Agar
John kabhi aaya hi nahi to Sarah ne 3 raat ka kamra muft me rok kar rakha.

> **Backend me:** yahi `pending` status ka asli maqsad hai (rule #6). Aur guarantee ke liye card
> hold chahiye — ya `hold_expires_at` jo bina guarantee wali booking ko expire kar de.

## A3 — Walk-in / phone booking (extranet) ✅

Koi banda seedha Ritz ke counter par aata hai. Sarah `/extranet` me **New reservation** kholti hain.

```
customerId     = undefined        ← is guest ka platform par koi account nahi
payment        = { method: "property", status: "pending" }
status         = "pending" → foran "confirmed"
```

Ye theek se socha gaya hai ✅. Code me comment hai:

> *"No `customerId`: a phone or walk-in booking has a guest but no platform account —
> defaulting it would drop a stranger's reservation into the customer's dashboard."*

Yani booking ka malik **kabhi email se guess nahi hota** — kyunki guest checkout par email badal
sakta hai. Ye asli backend me bhi barqarar rehna chahiye.

## A4 — OTA se booking (Booking.com / Expedia) ❌

Seed data me 11 aisi bookings hain — 5 Booking.com, 3 Expedia, 3 Travel Agency. Sarah ke
extranet me dikhti hain.

**Lekin koi code path aisi booking banata hi nahi.** `BookingSource` type me chaar options hain,
`createBooking` hamesha `"Direct"` deta hai. OTA bookings sirf seed me hain.

> **Backend me:** channel manager integration ya kam-az-kam ek import endpoint. Aur OTA booking
> par commission ka hisaab alag hoga (OTA khud commission leta hai).

---

# B. Availability — jab booking ban hi nahi sakti

## B1 — Beech wali raat bhari hui ✅

John 12–15 August maangta hai, Deluxe King (28 units).

| Raat | Bike hue | Bache |
|---|---|---|
| 12 Aug | 27 | 1 |
| 13 Aug | **28** | **0** |
| 14 Aug | 26 | 2 |

`unitsLeft` sabse tang raat leta hai → **0**. Poora stay reject.

> *"The Deluxe King Room is fully booked for these dates."*

Ye theek hai — ek raat toot jaye to poori reservation nahi ban sakti.

## B2 — Party kamre se bari ✅

John 3 guests ke liye Deluxe King (2 guests) maangta hai.

> *"The Deluxe King Room sleeps 2 guests. Choose a larger room or reduce the party size."*

Pehle `Room.guests` sirf sajawat tha — 6 log ek double book kar sakte the.

## B3 — Min-stay poora nahi ⚠️

Kuch hotels par `minStay: 2` ya `3` hai. Ek raat ka stay reject:

> *"This property has a 3-night minimum stay."*

**Masla:** ye **poore hotel** ke liye ek number hai. Asal duniya me weekend par 2 raat, Christmas
par 5, aur normal dinon me 1 hoti hai — aur suite ka rule standard room se alag hota hai.

> **Backend me (rule #5):** `rate_calendar.min_stay` — har room ki har date ka apna.
> Check-in wali date ka min-stay dekha jayega.

## B4 — Hotel un dates par band ✅

Ritz aaj se 14, 15, 16 din baad band hai (renovation, private event, jo bhi).

> *"Some of your dates are sold out at this property."*

Ye listing par bhi dikhta hai — card wahin sold-out mark ho jata hai, guest ko detail page tak
jane ki zaroorat nahi.

## B5 — Aakhri kamra, do guest, ek hi second ❌ **(sabse khatarnak)**

Deluxe King ka **1** unit bacha hai. John aur koi doosra guest ek hi waqt confirm dabate hain.

**Aaj:** koi masla nahi — sab kuch har banday ke apne browser me hota hai, do log ek doosre ka
data dekhte hi nahi.

**Server par:** dono ki query kehti hai "1 bacha hai". Dono INSERT. **Hotel overbooked.**

> **Backend me:**
> ```sql
> CHECK (booked_units >= 0 AND booked_units <= total_units)
> ```
> plus transaction ke andar har raat ki row `SELECT … FOR UPDATE`. Application me bug ho bhi
> jaye, database physically overbook nahi hone dega.

---

# C. Price ke mukhtalif suraten

## C1 — Hotel vs Resort ✅

Wahi 3 raat, 2 guests, room $725 — magar property Resort hai:

| | Hotel | Resort |
|---|---|---|
| Room 3 × $725 | $2,175 | $2,175 |
| VAT 10% | $218 | $218 |
| Service 5% | $109 | $109 |
| City tax $3.50×3×2 | $21 | $21 |
| **Resort fee $25×3** | — | **$75** |
| **Total** | **$2,523** | **$2,598** |

Resort fee `perNight` hai — guests ki tadaad se koi farq nahi padta.

## C2 — Peak dates par rate override ✅ (magar aadha)

Sarah New Year week ka rate $580 → $900 kar deti hain (base room par).

Deluxe King ka naya rate: `900 × (725/580)` = `900 × 1.25` = **$1,125**

Ratio barqarar rehta hai, to suite hamesha standard se mehngi rehti hai. Chalaak hai ✅.

**Magar** ⚠️ Sarah **sirf Deluxe King** ka rate nahi barha sakti. Override hamesha base room par
lagta hai aur baaqi sab uske saath khinche chale aate hain. Asal revenue management me har room
type ka apna rate hota hai.

> **Backend me:** `rate_calendar` per **room** hai, per property nahi — to ye khud-ba-khud hal
> ho jata hai.

## C3 — Teen discount types, wahi stay 🔬

3 raat × $725 = **$2,175** room subtotal. Teen alag promotions:

| Promotion | Hisaab | Discount |
|---|---|---|
| Early Bird **20%** | `2175 × 0.20` | **$435** |
| Summer Getaway **$50 off** | `min(50, 2175)` | **$50** |
| Stay Longer **3rd night free** | `floor(3/3) × $725` | **$725** |

Teesra sabse bara hai. Aur 6 raat ke stay par woh `floor(6/3) × 725` = **$1,450** ho jata.

## C4 — Do promotions aamne saamne ⚠️→✅

Farz karein Ritz par **dono** lagti hain: Early Bird 20% aur Summer Getaway $50.

**Aaj ka ranking:** `percent → value × 10` = 200, `amount → value` = 50. Early Bird jeetti hai.
Is case me sahi jawab, magar **ittefaqan**.

Ab ek 1-raat ka $200 ka stay lein, Early Bird **5%** ho:

| | Score (aaj) | Asli bachat |
|---|---|---|
| 5% off | `5 × 10` = **50** | `200 × 0.05` = **$10** |
| $50 off | **50** | **$50** |

Barabar score — magar guest ko **$40 ka nuqsan** ho sakta hai.

> **Backend me (rule #4):** har applicable promotion ka **asli** `discountAmount` nikaalo, sabse
> zyada bachane wali chuno. Score heuristic khatam.

## C5 — Add-on units ⚠️

Wahi 3 raat, 2 guests:

| Add-on | Unit | Hisaab | Total |
|---|---|---|---|
| Airport transfer | per stay | $65 | **$65** |
| Early check-in | per stay | $35 | **$35** |
| **Daily breakfast** | **per person** | `$32 × 2` | **$64** |
| Spa package | per person | `$120 × 2` | **$240** |

**Breakfast ghalat hai.** "Daily" ka matlab har roz — magar unit `per person` hai, to 3 raat ka
nashta **ek hi baar** charge hota hai. 6 breakfasts ke $64, yani $10.67 per person per night.

Unit system me chauthi option — **per person per night** — hai hi nahi.
Spa `per person` theek hai (ek baar ka treatment).

> **Ye naya sawal #10 hai** — `BUSINESS-RULES.md` ke 8 me nahi tha.

---

# D. Tabdeeli aur cancellation

## D1 — Dates badalna, sasta ho gaya ⚠️

John 12–15 Aug se 20–23 Aug shift karta hai. Naye dates par rate kam hai.

`modifyBooking` achhi tarah likha hua hai ✅:
- cancelled booking modify nahi ho sakti
- wahi `checkAvailability` gate chalta hai, `ignoreBookingId` ke saath — apni hi booking khud ko
  block nahi karti
- **add-ons dobara price hote hain** naye nights/guests par (warna 2-guest ka breakfast 4 guests
  ke baad bhi purani price par reh jata)
- poori booking `priceBooking` se dobara banti hai

Screen par naya total **aur farq dono dikhte hain** ✅ — `diff = newPricing.total − booking.pricing.total`.
Code me comment bhi hai: *"the difference shown here is the difference the guest will actually be charged."*

**Masla:** naya total $2,200 hai, John ne $2,670 diye the. Screen kehti hai **−$470**.
Aur phir kuch nahi hota. Koi refund nahi, koi credit note nahi. Sirf `pricing` overwrite ho jati hai.

## D2 — Dates badalna, mehnga ho gaya ⚠️ **(zyada khatarnak)**

Ulta case: naya total $3,100 hai. John ne $2,670 diye.

Screen **+$430 dikhati hai** — aur guest se woh $430 kabhi liye nahi jate. Booking update ho jati
hai, bas. Yani dates badal kar peak season me chale jana **bilkul muft** hai.

> Masla display ka nahi hai — hisaab theek hai aur guest ko dikh bhi raha hai. Masla ye hai ke
> UI **wada** karti hai ("you will be charged") aur koi payment step maujood hi nahi.

> **Backend me:** modification par price delta nikalna hoga — zyada ho to charge, kam ho to refund
> ya credit. Aur ye faisla bhi karna hoga ke modification **purane rate** par honi chahiye ya
> **naye** par. Abhi `priceBooking` hamesha **current** rates use karta hai — chahe Sarah ne kal
> hi rate barhaya ho.

## D3 — Modify karke sold-out dates par ✅

John aisi dates maangta hai jo bhari hui hain → wahi `checkAvailability` reject kar deta hai.
Ye pehle nahi tha — guest apni booking sold-out raaton par khiska sakta tha.

## D4 — Deadline se pehle cancel ✅

John 20 din pehle cancel karta hai.

```
daysToArrival = 20  →  >= 2  →  full refund $2,670
```

Kamra foran inventory me wapas ✅.

## D5 — Deadline ke baad cancel ⚠️

John check-in se 1 din pehle cancel karta hai.

**Aaj:** `daysToArrival = 1` → `>= 0` → **50% refund = $1,335**

**Magar** John ko checkout par jo text dikhaya gaya tha woh hotel ka `policies.cancellation` hai —
ek **free text** jo Sarah badal sakti hain. Abhi dono ittefaqan match karte hain kyunki sab hotels
ek hi default copy karte hain.

Sarah kal likh dein *"No refunds within 7 days"* — text badal jayega, refund phir bhi 50% milega.

> **Backend me (rule #1):** `free_until` + `charge` + `charge_value`. Guest ko dikhne wala text
> **usi se generate** hoga. Display aur enforcement alag ho hi nahi sakte.
>
> Ritz ki migration: `free_until: "48h"`, `charge: "percent"`, `charge_value: 50` — aaj ka
> behaviour hu-ba-hu.

## D6 — Check-in guzarne ke baad cancel ✅

```
daysToArrival = −2  →  refund $0
```

Sahi. Magar dekho D7.

## D7 — Guest aaya hi nahi (no-show) ❌

John kabhi pahuncha hi nahi. Sarah ke paas **sirf Cancel** ka button hai.

Cancel dabate hi `refundFor` chalta hai. Agar aaj check-in ka din hai (`daysToArrival = 0`) to
`>= 0` → **50% refund**.

**Sarah no-show guest ko $1,335 wapas de deti hain.**

> **Backend me (rule #6):** `no_show` alag status. Refund nahi. Pehli raat charge. Inventory us
> raat guzarne ke baad release. Aur reporting me no-show rate alag dikhega.

---

# E. Stay ke doran

## E1 — Aam stay ⚠️

Sarah **Check in** dabati hain → room number assign. 15 Aug ko **Check out**.

**Masla:** koi rule nahi. `setBookingStatus` par zero guards:

| Jo aaj mumkin hai | Hona chahiye |
|---|---|
| cancelled → confirmed | ❌ reject |
| confirmed → checked_out (check-in ke baghair) | ❌ reject |
| completed → checked_in | ❌ reject |
| checked_in → checked_in (dobara) | ❌ no-op ya reject |

## E2 — `checked_out` aur `completed` ka farq ❌

Dono statuses maujood hain. Review dono par khulta hai. Aur **`completed` ko koi code set hi
nahi karta** — woh sirf seed data me hai.

Yani do statuses, ek hi matlab.

> **Backend me (rule #6):** merge — sirf `completed`. `checked_out` khatam.

## E3 — `pending` bhi seed-only hai ❌

`createBooking` hamesha `confirmed` deta hai. `pending` sirf seed me hai — koi code path use
banata nahi.

> **Backend me:** `pending` = payment capture nahi hui (3DS pending / declined retry) ya OTA sync
> pending. Aur chunke `pending` inventory rokta hai, uske saath **hold expiry (~15 min)** zaroori
> hai — warna adhoora checkout kamra rok kar baith jayega.

---

# F. Reviews

## F1 — Verified review ✅

John stay ke baad review likhta hai — 5 categories, title, body.

`bookingId` juda hota hai → **Verified badge**. Yani ye banda waqai wahan ruka tha.

Hotel ki rating **kabhi store nahi hoti** — hamesha published reviews se derive hoti hai. Isliye
koi surface purani rating nahi dikha sakta ✅.

## F2 — Bina booking wala review ✅

`Review.bookingId` optional hai, `authorId` bhi. Imported/OTA reviews aise hi aate hain — Verified
badge ke baghair.

## F3 — Moderation ⚠️

`ReviewStatus` = `published` · `pending` · `flagged` · `rejected`. Sirf `published` public site
par dikhta hai, aur sirf `published` rating me ginte hain ✅.

**Masla:** admin panel me casing alag hai — `"Published"` / `"Flagged"` / `"Pending Review"` /
`"Hidden"`. Char values, alag naam, alag casing. Yani admin jo moderate karta hai woh public site
ke review se ek alag record hai.

> **Backend me:** ek enum. Phase 0 ka kaam.

## F4 — Sarah jawab deti hain ✅

Review par reply. John ko notification jata hai. Aur agar Sarah khud hi review ki author hotin to
unhein apna hi notification nahi jata — ye edge case code me handle hai ✅.

---

# G. Paisa

## G1 — Ek booking par commission ❌

John ki booking: room $2,175 · subtotal $2,304 · total $2,670. Commission **15%**.

| Base | Commission |
|---|---|
| Poora total (tax samet) | **$401** |
| Subtotal (add-ons samet, tax se pehle) | **$346** |
| Room revenue | **$326** |

**$75 ka farq, ek booking par.** Code me kahin define nahi — `adminCommissionRows` bas
`revenueYtd × 0.15` karta hai, aur `revenueYtd` khud hardcoded number hai.

Aam tor par OTA commission **room revenue** par hoti hai — tax platform ka nahi, government ka
hai. Lekin ye faisla lena hoga.

> **Ye sawal #9 hai** — `BUSINESS-RULES.md` ke 8 me nahi tha.

## G2 — Cancelled booking par commission? ❌

John cancel karta hai, Sarah ko $1,335 (50%) rakhne ko milte hain.

**Platform us $1,335 par commission leta hai ya nahi?** Kahin define nahi.
Booking.com aisi soorat me commission nahi leta; kuch platforms lete hain.

## G3 — Payout cycle ❌

`/extranet/finance/payouts` par payouts dikhte hain — sab static fixtures. Kab, kis cycle par,
kaunsi bookings shamil, hold period kya — kuch define nahi.

---

# H. Log aur access

## H1 — Partner ka team member ⚠️

Extranet me `TeamUser` hai: role `Admin` / `Manager` / `Staff`, status `Active` / `Invited`.
Sarah user add/remove kar sakti hain ✅.

**Masla:** role kuch karta nahi. Staff bhi wahi sab dekh aur badal sakta hai jo Sarah — rates,
finance, payouts, sab. Koi permission check nahi.

## H2 — Admin property suspend karta hai jab bookings zinda hain ❌

Admin Ritz ko suspend karta hai. Us par 12 confirmed bookings hain.

Kya hota hai? Kuch define nahi. Property list se hat jati hai, magar bookings ka kya?
Guests ko batao? Refund? Doosre hotel me move?

## H3 — Bina account ke booking (guest checkout) ⚠️

Type support karta hai — `customerId?` optional hai, aur walk-in bookings isi tarah banti hain ✅.

**Magar public site par guest checkout hai hi nahi.** Checkout hamesha `profile.id` set karta hai,
aur koi login screen bhi nahi hai. Yani har site booking farz karti hai ke John signed in hai.

## H4 — Koi bhi `/admin` khol sakta hai ❌

Poore product me ek bhi auth gate nahi. `/admin` URL type karo, poora platform tumhara.

---

# I. Support

## I1 — Ticket flow ✅ (ek bug ke saath)

John ticket kholta hai — subject, category, priority. Ref banta hai `TKT-4821`.
Sarah ya support reply karte hain, thread chalta hai, status `open → in_progress → resolved` ✅.

**Bug:** `makeTicketRef()` sirf `TKT-1000`…`TKT-9999` deta hai — 9,000 possibilities — aur
**uniqueness check bilkul nahi**. Bookings ke liye `uniqueBookingRef()` 20 attempts karta hai,
tickets ke liye kuch nahi.

100 tickets ke baad collision ka imkaan ~43% hai (birthday problem).

> **Backend me (rule #8):** DB sequence.

---

# J. Product ke apne likhe hue waade

`/cancellation-policy` ek asli public page hai — guest use padh kar booking karta hai. Usme jo
likha hai woh **product ka wada** hai. Ye effectively ek requirements document hai jo kisi ne
likha to hai, magar code me utara nahi.

| Page par likha hai | Code me | |
|---|---|---|
| *"Free cancellation… usually between 24 and 72 hours before check-in"* | rule #1 ke `free_until` options se **match karta hai** | ✅ |
| *"Partially refundable rates return… typically everything except the first night"* | rule #1 ka `charge: "first-night"` — **match** | ✅ |
| *"no-show… may charge the full stay or the first night, depending on the rate"* | rule #6 ka `no_show` + `charge` — **match** | ✅ |
| *"The screen shows the exact refund or price difference before you confirm"* | dikhta hai ✅, magar **paisa move nahi hota** (D1/D2) | ⚠️ |
| *"Deadlines are expressed in the property's local time zone… A 48-hour deadline for a 15:00 check-in in Tokyo expires at 15:00 Tokyo time"* | **property par timezone hai hi nahi.** Sab dates plain `yyyy-mm-dd` strings hain, `refundFor` seedha din ginta hai | ❌ |
| *"check the countdown on the booking"* | koi countdown nahi | ❌ |
| *"We send a reminder email 24 hours before a free-cancellation window closes"* | koi email system nahi | ❌ |
| *"Refunds are returned to the original payment method… within 48 hours"* | koi payment integration nahi | ❌ |
| *"Reward points spent on a cancelled booking are returned to your account"* | **points ki koi logic hai hi nahi** — `profile.points = 12450` sirf ek number hai jo screen par dikhta hai. Na kamaye jate hain, na kharch hote hain | ❌ |
| *"Leaving early does not automatically refund the unused nights"* | early departure ka koi concept nahi | ❌ |
| *"natural disaster… we set aside the standard rate rules"* | admin override + audit chahiye hoga | ❌ |

**Teen cheezein jo yahan se nikleen aur kisi audit me nahi thin:**

**Timezone.** Poore product me property ka timezone kahin nahi hai. Tokyo ka hotel aur New York
ka hotel dono ke liye "48 ghante pehle" ek hi tarah ginte hain. Guest New York me baitha ho aur
hotel Tokyo me — deadline kis waqt guzri, ye sawal abhi jawab hi nahi rakhta.
→ **`properties.timezone` column** aur refund/deadline ka hisaab property-local time me.

**Reward points.** John Gold Member hai, 12,450 points hain. Woh number kahin se aata nahi aur
kahin jata nahi — na booking par barhta hai, na kharch hota hai. Public page wada karta hai ke
cancel par points wapas milenge.
→ Ya to points ka poora system banana hoga, ya profile se hata dena hoga.

**Early departure.** Guest 3 raat ki booking par 2 raat ruk kar chala jaye — abhi koi rasta nahi.
Page kehta hai property se baat karo aur support ticket kholo, jo kam-az-kam ek **manual flow**
define karta hai.

---

# Khulasa — kya kahan tootta hai

| Area | ✅ | ⚠️ | ❌ |
|---|---|---|---|
| Booking banana | site card · walk-in | pay-at-property | OTA import |
| Availability | sold-out · capacity · closed | property-level min-stay | **overbooking race** |
| Pricing | ek hi implementation · resort fee · rate override | override sirf base room par · add-on units | — |
| Promotions | banana | — | **channels dead** · ranking khaam |
| Modify | availability gate · add-on repricing | — | **price delta koi handle nahi karta** |
| Cancel | full/partial/none | dikhaya gaya text ≠ lagoo rule | **no-show par refund mil jata hai** |
| Stay | check-in/out | — | **koi state machine nahi** |
| Reviews | derive · verified · reply | admin casing alag | — |
| Paisa | — | — | **commission base undefined** · payout cycle |
| Access | team CRUD | roles bemani | **koi auth nahi** |
| Support | thread flow | — | ref collision |

---

# Do sawal jo abhi tay hone hain

**#9 — Commission kis base par?** (G1)
Room revenue $326 · Subtotal $346 · Total $401. Ek booking par $75. Payout, invoice, aur finance
ke saare screens isi par banenge. Aur saath me: **cancelled booking par commission banti hai?** (G2)

**#10 — `ValueAdd` me "per person per night" unit?** (C5)
"Daily breakfast" abhi 3-raat ke stay ka $64 leta hai, 6 breakfasts ke liye.
