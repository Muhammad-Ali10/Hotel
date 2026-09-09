# Stayora — Poora Flow, Ek Kahani Me

> ⚠️ **Ye document aaj ki maujooda haalat bayan karta hai.** Iske baad `BUSINESS-RULES.md`
> me **rule #11 — tax poora khatam** aur **#10 — `per person per night` unit** tay ho chuke hain.
> Neeche ke tamam price examples me VAT / Service / City tax **hat jayenge**, aur
> "Daily breakfast" ki price barhegi. Faisle ke baad ke numbers `BUSINESS-RULES.md` §11 me hain.

Do kirdaar, jo code me pehle se maujood hain:

- **Sarah Mitchell** — *Aurora Hospitality* chalati hain. Paanch hotels manage karti hain:
  The Ritz-Carlton (New York), Four Seasons, One&Only, Aman Tokyo, The Peninsula.
- **John Doe** — `usr-john-doe`, Gold Member, 12,450 points, New York se.

Har qadam par teen nishan:
✅ **aaj kaam karta hai** · ⚠️ **aadha** · ❌ **bilkul nahi hai**

---

## Pehla Bab — Sarah platform par aati hain

Sarah `/join` par pahunchti hain. **29 steps** ka wizard hai.

Woh batati hain: property type (hotel), naam, location, kitne rooms, kis type ke, kitne beds,
kitne guests, size. Phir amenities, photos, description. Phir paise wali baatein — rate plan,
per-night price, kis currency me. Phir policies: check-in time, pets, smoking, children.
Phir cancellation — *kab tak free cancel* aur *deadline ke baad kitna charge*. Phir payout
details, invoicing, verification documents. Aakhir me contract sign.

Har step ka data browser me mehfooz rehta hai — Sarah beech me chali jayen to wapas aa kar
wahin se shuru kar sakti hain. ✅

Aakhri screen par woh **"Complete registration"** dabati hain.

Aur… bas. ❌

```
toast.success("Registration complete")
router.push("/join/done")
```

Koi property nahi banti. Koi partner account nahi banta. Admin ke paas koi approval request
nahi jati. 29 screens ka data browser ke localStorage me pada reh jata hai, aur agar Sarah
cache clear kar dein to hamesha ke liye khatam.

> **Backend ke baad:** submit ek property banayega `status: pending_review` ke saath, Sarah ka
> partner account banega, aur admin ki queue me request jayegi. (Phase 9)

---

## Doosra Bab — Admin manzoori deta hai

Admin panel `/admin/properties` par pending property khulti hai. Documents dekhe jate hain,
address verify hota hai, phir **Approve**. Property `active` ho jati hai aur public catalog me
aa jati hai.

Admin panel me ye sab **asli kaam karta hai** ✅ — uske paas poora react-query mutation layer hai
(`useTransitionProperty`, `useSetGuestStatus`, `useCancelReservation`…) jo asli likhta hai.

Lekin ek masla: ⚠️ **admin apni alag duniya me rehta hai.** Uska data
`src/data/admin` + apna in-memory db hai. Admin jo property approve karta hai, woh Sarah ke
extranet me nazar nahi aati. Aur Sarah jo hotel manage karti hain, woh admin ki list me nahi hai.
Do alag catalogs hain jo ek doosre ko jaante hi nahi.

> **Backend ke baad:** ek `properties` table, teenon surfaces usi ko padhenge.

---

## Teesra Bab — Sarah inventory aur rate set karti hain

Ab Sarah `/extranet` me hain. Ritz-Carlton topbar me select hai.

**Rooms:** teen room types hain —

| Room | Rate | Guests | Units |
|---|---|---|---|
| Standard Room | $580 | 2 | 40 |
| Deluxe King Room | $725 | 2 | 28 |
| Premium King Room | $870 | 3 | — |

**Calendar:** Sarah kisi date ka rate barha sakti hain, koi date band kar sakti hain, min-stay
laga sakti hain. ✅ Ye asli kaam karta hai — store me likhta hai aur public site par turant
dikhta hai.

Ek baat jo abhi ajeeb hai ⚠️: jab Sarah kisi date ka rate badalti hain, woh **base (sabse sasta)
room** ke against hota hai. Baaki rooms `room.price / hotel.price` ratio se scale hote hain —
taake suite hamesha standard room se mehngi rahe. Ye chalaak hai, magar Sarah kisi ek room ka
rate alag se set nahi kar sakti.

**Taxes:** Ritz par teen lagti hain — VAT 10%, Service charge 5%, City tax $3.50 per guest per
night. Resort properties par $25/night resort fee bhi. ✅

**Value-adds:** Airport transfer $65 (per stay), Early check-in $35 (per stay), Daily breakfast
$32 (**per person**), Spa package $120 (per person). ✅

> ⚠️ **"Daily breakfast" ka unit ghalat hai.** Unit system me sirf teen options hain:
> per stay · per night · per person. **"per person per night" hai hi nahi.** To 3-raat ke stay
> par 2 guests ka "daily" breakfast $64 banta hai — yani $10.67 per person per night. Ye rule
> #2 se alag ek chhota masla hai jo abhi tak note nahi hua tha.

**Promotions:** Sarah ke paas Ritz par chaar promotions hain — Last Minute Deal 35% (`paused`),
Loyalty Reward 10% (`draft`), Mobile-only Rate 25% (`active`), Genius Level 2 15% (`active`).
Banana ✅ kaam karta hai. Lekin aakhri do — jo **live dikhti hain** — kabhi kisi guest tak nahi
pahunchtin ❌, kyunki `activeDiscountFor` sirf `channel === "all"` filter karta hai.
Chhata Bab me iska poora hisaab hai.

**Aur phir 37 screens jahan kuch asli nahi hai** ❌
Analytics, Finance, Boost — Sarah revenue dekh sakti hain, occupancy, commission, payouts,
ranking, demand. Sab numbers hain. Lekin unka kisi asli booking se **koi taluq nahi**. Sarah
aaj ek booking cancel kar dein, finance ka total nahi hilega. Ye 60 me se 37 screens hain.

---

## Chautha Bab — John hotel dhoondta hai

John `stayora.com` par aata hai. Search: **New York · 12–15 August · 2 guests**.

`/hotels` khulta hai. Filters: price range, star rating, amenities, property type.

Har card par jo dikhta hai woh **derive** hota hai, stored nahi ✅ —
rating reviews se, price sabse saste room se, discount active promotions se.

Aur ek cheez jo theek se kaam karti hai ✅: agar hotel un dates par **sold out** hai to card par
wahin dikh jata hai. Pehle aisa nahi tha — listing sirf calendar dekhti thi, to poora bika hua
hotel bhi bookable dikhta tha jab tak guest reserve card tak na pahunch jaye.

---

## Paanchwan Bab — John kamra chunta hai

`/hotels/the-ritz-carlton`. Gallery, description, amenities, rooms, reviews, policies.

John **Deluxe King Room** chunta hai — $725/night, 2 guests.

Ab teen sawal poochhe jate hain (`checkAvailability`) ✅:

1. **Stay valid hai?** nights > 0 · min-stay poora · koi date band to nahi
2. **Kamra itne logon ka hai?** `guests <= room.guests` → 2 ≤ 2 ✓
3. **Unit bacha hai?** poore stay me sabse tang raat jeetti hai

Teesra sawal ahem hai. Agar 12 aur 14 August ko 28 me se 27 units bike hue hain, magar 13 ko
28 ke 28 bik chuke hain — to **poora stay block** hai. Ek bhi raat bhari ho to reservation nahi
ban sakti.

Aur cancelled bookings apna kamra **wapas chhod dete hain** ✅.

---

## Chhata Bab — Price kaise banti hai

John add-ons chunta hai: **Airport transfer** aur **Daily breakfast**.

Ab `priceBooking()` chalta hai — poore product me **yehi ek implementation** hai. Detail page,
checkout, confirmation, dashboard, extranet invoice — sab isi ko bulate hain, isliye koi do
screen kabhi alag number nahi dikha sakte. ✅

```
Room          $725 × 3 raat                    = $2,175
Discount      koi nahi (neeche dekhein)        =      $0
Add-ons       transfer $65 + breakfast $32×2   = +$129
                                                ────────
Subtotal                                        = $2,304

VAT 10%       2304 × 0.10                      = $230
Service 5%    2304 × 0.05                      = $115
City tax      $3.50 × 3 raat × 2 guests        = $21
                                                ────────
TOTAL                                           = $2,670
```

### Discount kyun sifar hai — aur ye kitna bura hai

Ritz-Carlton par **chaar promotions lagi hui hain**, aur John ko **ek bhi nahi milti**:

| Promotion | Status | Channel | Kyun nahi mili |
|---|---|---|---|
| Last Minute Deal 35% | `paused` | all | Sarah ne rok rakhi hai — theek |
| Loyalty Reward 10% | `draft` | all | abhi publish nahi hui — theek |
| **Mobile-only Rate 25%** | **active** | `mobile` | ❌ `activeDiscountFor` sirf `channel === "all"` leta hai |
| **Genius Level 2 15%** | **active** | `genius` | ❌ wahi wajah |

Do promotions **active** hain, Sarah ke extranet me "live" dikhti hain, aur **kabhi kisi guest
tak nahi pahunchtin**. John Gold Member hai — Genius 15% uska haq banta tha, $326 ka farq.
Yehi rule #3 hai.

Do baatein jo yahan **jaan-bujh kar** aisi hain (rule #2 me confirm hui):

- **Tax add-ons par bhi lagta hai** — yani airport transfer par bhi VAT.
- **Tax discount ke baad lagta hai** — yani discount tax bhi bacha raha hai.

Aur teesri jo `perNight`/`perPersonPerNight` taxes par lagoo nahi hoti: city tax add-ons se
mutasir nahi hota, kyunki woh subtotal-based nahi hai.

---

## Saatwan Bab — John booking karta hai

Checkout teen steps ka ek hi page hai: **Your Details → Payment → Review**.

John confirm dabata hai. `createBooking` chalta hai ✅ — aur ye important hai ke **yahan sab
rules dobara check hote hain**, sirf form par nahi. Code me comment bhi likha hai:

> *"The checkout screen is one caller among several and its query string is user-editable —
> the rules have to hold at the write, which is where the API will enforce them too."*

Booking ko reference milta hai: **`STY-K7M2QX`** — 6 characters, alphabet me `I O 0 1` jaan
bujh kar nikale gaye hain taake koi `STY-1O0I` ko galat na parhe.

Aur booking par **snapshot** liye jate hain: hotel ka naam, room ka naam, sheher, aur poori
price breakdown. Kyunki agar Sarah kal rate ya tax badal dein, to John ki purani booking ka
total **nahi hilna chahiye**. ✅

### Yahan asli khatra kya hai

Aaj sab kuch John ke browser me hota hai, to koi race nahi. Lekin server par:

> Do guest ek hi second me confirm dabate hain. Dono ki query kehti hai "1 unit bacha hai".
> Dono ki booking ban jati hai. Hotel overbooked.

Isi liye backend me `booked_units <= total_units` ka **DB constraint** hoga aur booking
transaction har raat ki row `SELECT … FOR UPDATE` se lock karegi. Application me bug ho bhi
jaye, **database physically overbook nahi hone dega**.

---

## Aathwan Bab — Sabko khabar hoti hai

Booking bante hi do notifications banti hain ✅:

- **John ko:** *"Your stay is confirmed — The Ritz-Carlton · Deluxe King Room · 12 August.
  Reference STY-K7M2QX."*
- **Sarah ko:** *"New reservation — John Doe booked the Deluxe King Room at The Ritz-Carlton."*
  (sirf tab jab woh property unki manage ki hui ho)

John apne `/dashboard/bookings` me dekh leta hai. Sarah `/extranet/reservations` me. **Ek hi
record, dono taraf** ✅ — ye woh cheez hai jo July ki audit ke baad theek hui thi.

⚠️ Lekin admin ko kuch nahi pata. Uska db alag hai.

---

## Nauwan Bab — John irada badalta hai

John cancel karta hai. `refundFor()` chalta hai.

**Aaj:** hardcoded rule — 2 din ya zyada bache hain to poora refund, warna 50%, aur check-in
guzar gaya to kuch nahi.

**Masla:** John ko checkout par jo policy **dikhayi** gayi thi woh ek alag cheez thi — hotel ka
`policies.cancellation`, jo ek **free text** hai aur Sarah extranet se badal sakti hain. Abhi
dono ittefaq se match karte hain, kyunki sab hotels ek hi default text copy karte hain. Sarah
text badal dein — guest ko kuch aur dikhega, refund kuch aur milega. ⚠️

> **Backend ke baad (rule #1):** policy structured hogi — `free_until` + `charge` +
> `charge_value`. Guest ko dikhne wala text **usi se generate** hoga, store nahi hoga. Isliye
> display aur enforcement kabhi alag ho hi nahi sakte.
>
> Aur `percent` ka option isi liye add hua: maujooda 50% policy `first-night` se express hi nahi
> hoti — 10-raat ke stay par woh 10% reh jati, yani Sarah ka protection khatam.

Cancel hote hi kamra wapas inventory me chala jata hai ✅.

---

## Daswan Bab — Stay hoti hai

12 August. John pahunchta hai. Sarah `/extranet/reservations` me **Check in** dabati hain,
room number assign karti hain. 15 August ko **Check out**.

⚠️ **Yahan koi rule nahi hai.** `setBookingStatus(id, status)` par **zero guards** hain. Cancelled
booking wapas confirmed ho sakti hai. Check-out check-in se pehle set ho sakta hai. Koi bhi status
kisi bhi status me ja sakta hai.

Aur agar John aaya hi nahi? Sarah ke paas sirf **Cancel** hai — jo `refundFor` chala kar use
refund de dega. No-show par refund. ❌

> **Backend ke baad (rule #6):** asli state machine —
> ```
> pending    → confirmed | cancelled
> confirmed  → checked_in | no_show | cancelled
> checked_in → completed
> ```
> `no_show` naya status hai. `checked_out` khatam — `completed` me merge ho gaya, kyunki dono ka
> matlab bilkul ek hi tha aur `completed` ko koi code set hi nahi karta tha.
>
> Har transition `booking_events` me log hogi: kis ne, kab, kyun.

---

## Gyarhwan Bab — John review likhta hai

Stay khatam. John ke dashboard me review ka prompt aata hai.

Woh 5 categories rate karta hai — cleanliness, comfort, location, facilities, staff — aur likhta
hai. ✅

Review par **Verified badge** aata hai kyunki uske saath `bookingId` juda hai — yani ye banda
waqai wahan ruka tha.

Hotel ki overall rating **kabhi store nahi hoti** ✅ — hamesha published reviews se derive hoti
hai. Isliye koi surface kabhi purani rating nahi dikha sakta.

Sarah extranet me review dekhti hain aur jawab deti hain. Jawab John ko notification me jata hai
— aur agar Sarah khud hi review ki author hotin to unhein apna hi notification nahi jata (code
me ye edge case handle hai ✅).

---

## Barhwan Bab — Paisa move hota hai

Ab commission. Platform **15%** leta hai (`COMMISSION_RATE = 0.15`).

⚠️ **Aur yahan ek sawal hai jo abhi tak kisi document me nahi aaya:**

> **15% kis cheez ka?**
>
> | Base | John ki booking par |
> |---|---|
> | Poora total (tax samet) | 15% × $2,670 = **$401** |
> | Room revenue (tax aur add-ons se pehle) | 15% × $2,175 = **$326** |
> | Subtotal (add-ons samet) | 15% × $2,304 = **$346** |
>
> **$75 ka farq** ek booking par. Code me kahin define nahi — `adminCommissionRows` bas
> `revenueYtd × 0.15` karta hai, aur `revenueYtd` khud ek hardcoded number hai.

Aam tor par OTA commission **room revenue** par hoti hai — tax aur third-party add-ons par nahi,
kyunki tax to government ka hai, platform ka nahi. Lekin ye faisla lena hoga.

Baaqi finance — payout runs, invoices, commission statements — sab abhi ❌ static fixtures hain.

---

## Terhwan Bab — Admin sab dekhta hai

Admin panel me: clients (partner orgs), properties, guests, reservations, reviews moderation,
finance, payouts, promotions, content, audit log, inbox.

Ye sab **asli mutations** ke saath kaam karta hai ✅ — approve, suspend, cancel, retry payout,
invite manager. Architecture ke lehaz se ye **sabse tayyar** surface hai.

Bas apne alag database par. ⚠️

---

## Aur ek cheez jo poori kahani me kahin nahi thi

**Kisi ne kabhi login nahi kiya.**

John ka login sirf ye hai:

```ts
function onSubmit() {              // ← form ki values leta tak nahi
  toast.success("Signed in")
  router.push("/dashboard")
}
```

Password check nahi hota. Email check nahi hota. Aur **poore product me ek bhi auth gate nahi** —
`/dashboard`, `/extranet`, `/admin` sab bina kisi check ke khule hain. Koi bhi `/admin` type kar
ke poora platform chala sakta hai. ❌

Store me `currentUser` ka concept hi nahi — "signed in user" ek fixed object hai jo file me
likha hua hai.

---

## Kahani ka khulasa

| Bab | Halat |
|---|---|
| 1. Sarah join karti hain | ⚠️ 29 steps chalte hain, submit kahin nahi jata |
| 2. Admin approve karta hai | ⚠️ kaam karta hai, magar alag duniya me |
| 3. Sarah inventory set karti hain | ⚠️ core kaam karta hai · 37 screens khokhle |
| 4. John dhoondta hai | ✅ |
| 5. John kamra chunta hai | ✅ |
| 6. Price banti hai | ✅ ek hi implementation, har jagah |
| 7. John booking karta hai | ✅ (server par race condition guard chahiye hoga) |
| 8. Sabko khabar hoti hai | ✅ guest + partner · ❌ admin |
| 9. John cancel karta hai | ⚠️ dikhayi gayi policy ≠ lagoo hui policy |
| 10. Stay hoti hai | ⚠️ koi state machine nahi · ❌ no-show |
| 11. Review | ✅ |
| 12. Paisa | ❌ commission base define hi nahi |
| 13. Admin | ⚠️ pukhta, magar juda |
| **Login** | ❌ bilkul nahi |

---

## Do naye sawal jo ye kahani likhte waqt nikle

`BUSINESS-RULES.md` ke 8 faisle ho chuke. Ye do unme nahi the:

**9. Commission kis base par?** (Bab 12) — room revenue · subtotal · ya poora total?
Ek booking par $75 ka farq. Payout, invoice aur finance ke saare screens isi par bante hain.

**10. `ValueAdd` me "per person per night" unit chahiye?** (Bab 3) — "Daily breakfast" abhi
`per person` hai, yani 3-raat ke stay ka nashta ek hi baar charge hota hai ($64 total, 6 breakfasts
ke liye).
