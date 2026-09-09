# Module audit — 1 se 8 tak

**Tareekh:** 2026-08-20 · **Halat:** 673 tests pass, lint aur build saaf.

**Update 2026-08-20 (baad me):** pehla aur doosra darja **poora mukammal** —
A, B, C, D, E, F, G, H sab. Neeche har module ka asal audit hai; hal-shuda
items par ✅ lagaya gaya hai.

Ye audit ye nahi poochta ke "jo bana wo theek hai?" — wo tests pehle se poochte
hain. Ye poochta hai: **jo wada kiya gaya, wo bana bhi ya nahi.**

Tareeqa teen taraf se:

1. `docs/ARCHITECTURE.md` §10 module map — har module ne kya dene ka kaha tha
2. `docs/backend-plan.md` §9 — Phase 1 ka endpoint list
3. Har table ke khilaf: koi cheez usme **likhti** bhi hai ya sirf parhti hai

---

## Buniyadi nateeja

Poore backend me **10 tables aisi hain jinme koi bhi cheez likh nahi sakti**:

```
amenities · partnerMembers · partnerOrgs · photos · promotionProperties
promotionRooms · promotions · ratePlans · rooms · valueAdds
```

Ek hi shakal baar baar: **parhne ka hissa bana, likhne ka hissa taal diya gaya
aur phir kabhi schedule nahi hua.**

Ye nazar isliye nahi aaya ke **har test apna data seedha database me daal deta
hai**. Test kabhi wo darwaza nahi khatkhata jo mojood hi nahi.

---

## Module 1 — Auth

**Wada:** users · session cookie · roles · guards · tier · §5 API2/API3

**Mojood (4):** `POST /auth/signup` · `POST /auth/login` · `POST /auth/logout` ·
`GET /auth/me`

Andar ka kaam mazboot hai: argon2id, server-side sessions, idle 7 din +
absolute 30 din, sliding window, default-deny guard, role guard, suspend hote hi
session batil, login enumeration-safe.

**Kam hai:**

| # | Cheez | Kis ne maanga tha |
|---|---|---|
| ~~1.1~~ | ~~`PATCH /me/profile`~~ ✅ | ARCHITECTURE §5 API3 **naam le kar**; backend-plan §9 |
| ~~1.2~~ | ~~`GET /me/profile`~~ ✅ | backend-plan §9 |
| ~~1.3~~ | ~~Password badalna~~ ✅ | API2: "password badalne par purani sab sessions batil" |
| ~~1.4~~ | ~~Password reset~~ ✅ (email transport Module 9) | login page par khud likha: "no reset flow yet" |
| ~~1.5~~ | ~~Email verification~~ ✅ **ban gaya** — Module 9 ke sath |
| ~~1.6~~ | ~~"Sab devices se nikal do"~~ ✅ | API2 lafz ba lafz maangta hai |
| ~~1.7~~ | ~~Devices ki list~~ ✅ | sessions table `user_agent`/`ip`/`last_used_at` isi ke liye rakhti hai |
| 1.8 | Barhta hua lockout | API2: "rate limit, **phir barhta hua lockout**" — sirf flat 5/min hai |

**Marey hue columns:** `email_verified_at` · `password_changed_at` · `tier` ·
`points` · `membership` — paanchon mojood, likhne wala koi nahi.

**✅ 2026-08-20 par hal:** rule #53 — 2 mukammal stays par tier khud ba khud
`genius` ho jata hai. Neeche ka paragraph us se pehle ki halat likhta hai.

**🔴 (hal-shuda) Sab se ahem — `genius` chal hi nahi sakta.** Rule #3 kehta hai
`mobile`/`genius` channels implement honge, aur wo hue bhi: pricing `user.tier`
parhti hai, promotions tier par filter hoti hain. Magar poore backend me koi
cheez `tier` ko `genius` karti nahi. **Har user hamesha `standard` rahega**, to
rule #3 ka aadha hissa bana hua hai aur kabhi chal nahi sakta.

---

## Module 2 — Catalog

**Wada:** properties · rooms · **rate plans** · **amenities (controlled)** ·
photos · value-adds · policies · timezone

**Mojood:** public search + detail · partner list + `PATCH` property (naam,
tafseel, pata, check-in/out time, policies, amenities)

**Kam hai — 5 me se 5 named deliverables ka likhne ka raasta nahi:**

| # | Cheez | Asar |
|---|---|---|
| ~~2.1~~ | ~~`rooms` CRUD~~ | ✅ **ban gaya** — 2026-08-20 |
| ~~2.2~~ | ~~`ratePlans` CRUD~~ | ✅ **ban gaya** — 2026-08-20 |
| 2.3 | `photos` | ARCHITECTURE §5 API7 ka faisla ("sirf presigned upload") likha hai, code nahi |
| ~~2.4~~ | ~~`valueAdds` CRUD~~ | ✅ **ban gaya** — 2026-08-20 |
| 2.5 | `amenities` vocabulary | controlled list ka admin management nahi |
| 2.6 | Partner ka apni ek property ka detail GET | sirf list aur patch hai |

**🔴 2.2 ka asar sab se bara:** rules #1, #42, #47 — cancellation ki shakal,
payment mode, no-show ki shart — teenon rate plan par baithi hain, aur rate plan
sirf seed script se banta hai.

---

## Module 3 — Inventory

**Wada:** do sparse calendars · availability · restrictions · bulk close

**Mojood:** public `GET :slug/availability` · partner `POST close` ·
partner `POST rates`

**Kam hai:**

| # | Cheez | Asar |
|---|---|---|
| ~~3.1~~ | ~~Partner ke apne calendar ka GET~~ | ✅ **ban gaya** — 2026-08-20 |

**✅ 2026-08-20 par hal.** Neeche us se pehle ki halat.

**🔴 (hal-shuda) Ye poora write-only calendar hai.** Partner rate aur closure set kar sakta
hai magar kabhi wapas dekh nahi sakta ke kya set hai. `/extranet/rates` screen
ko theek yehi chahiye.

---

## Module 4 — Pricing

**Wada:** quote engine · quote token · promotions (channels) · value-adds

**Mojood:** `POST /properties/:slug/quote` — engine mukammal, signed token,
server-authoritative, poori tarah test-shuda.

**Kam hai:**

| # | Cheez | Asar |
|---|---|---|
| ~~4.1~~ | ~~`promotions` CRUD~~ | ✅ **ban gaya** — 2026-08-20, lifecycle job ke sath |
| ~~4.2~~ | ~~`valueAdds` CRUD~~ | ✅ **ban gaya** (wahi 2.4) |

**🔴 4.1 module ka aadha hissa mardood kar deta hai.** Rules #3 (channels),
#4 (do promotions me best single jeete), #36 (paused promotion ka token phir bhi
honour ho) — teenon likhe hue, test-shuda, aur **teenon na-qabil-e-rasai**,
kyunki promotion banane ka koi raasta nahi. `/extranet/promotions` aur
`/admin/promotions` dono screens mojood hain.

---

## Module 5 — Booking ✅

**Wada:** transactional create · modify (inventory swap) · cancel · state
machine · idempotency

**Mojood:** create · list · detail · modify · cancel · status · partner list

Partner aur admin `GET /bookings/:id` se apni booking parh sakte hain —
`assertCanSee` unhe scope deta hai, isliye alag endpoint ki zaroorat nahi.

**Kam:** apne daaire me kuch nahi. Admin ka booking view Module 11 ka hissa hai.

---

## Module 6 — Reviews ✅

**Mojood:** public list · guest write/mine/reviewable/withdraw · partner
list+respond+flag · admin queue+moderate

**Kam:** apne daaire me kuch nahi.

---

## Module 7 — Payments

**Mojood:** `POST /payments/start` · `GET /payments/booking/:id` ·
signed webhook · hold sweeper + cron + advisory lock

**Kam hai:**

| # | Cheez | Asar |
|---|---|---|
| 7.1 | Admin ka manual refund | guest dispute kare to cancel flow ke bahar refund ka koi raasta nahi |
| 7.2 | Partner ka payments view | `/extranet/finance` screen ko chahiye |

Dono qabil-e-behes Module 11 ke hisse hain, magar 7.1 ki ghair-mojoodgi asli
operational khala hai.

---

## Module 8 — Finance ✅

**Mojood:** partner payouts + statement + account · admin list + statement +
retry + verify + manual run · fortnightly cron

**Kam:** apne daaire me kuch nahi. `partnerOrgs` aur `partnerMembers` ka na
likha jana Module 12 (onboarding) aur Module 10 (team) ka hissa hai — magar
uska matlab ye hai ke **aaj koi partner seedhe DB insert ke baghair wujood me
nahi aa sakta**.

---

## Ek cheez jo module map se hi gir gayi

`docs/backend-plan.md` §9 ke Phase 1 list me ye tha:

```
GET /me/favorites · POST/DELETE /me/favorites/:hotelId
```

**Na koi table hai, na endpoint** — aur `docs/ARCHITECTURE.md` §10 ke module map
me favorites kisi module me likha hi nahi gaya. Do planning documents ke darmiyan
gir gaya. Frontend par `/dashboard/favorites` ki poori screen mojood hai.

---

## Tarteeb — kya pehle

**Pehla darja — jo bana hua feature chalne nahi deta**

| | Kaam | Kyun |
|---|---|---|
| ~~A~~ | ~~Rate plan + room CRUD (2.1, 2.2)~~ | ✅ **mukammal** — 28 tests, RBAC split, calendar propagation |
| ~~B~~ | ~~Promotions CRUD (4.1)~~ | ✅ **mukammal** — 30 tests, genius chain end-to-end chalta hai |
| ~~C~~ | ~~Partner calendar GET (3.1)~~ | ✅ **mukammal** — 10 tests, guest ke sath parity sabit |
| ~~D~~ | ~~`tier` set karne ka raasta (1.x)~~ | ✅ **mukammal** — rule #53, 2 stays par khud ba khud |

**Doosra darja — spec ne maanga, bana nahi**

| | Kaam |
|---|---|
| ~~E~~ | ~~`GET`/`PATCH /me/profile`~~ ✅ **mukammal** |
| ~~F~~ | ~~Password change + reset~~ ✅ **mukammal** — rule #54 |
| ~~G~~ | ~~Devices list + revoke~~ ✅ **mukammal** |
| ~~H~~ | ~~Value-adds CRUD~~ ✅ **mukammal** |

**Teesra darja — baad ke modules ke sath ja sakta hai**

| | Kaam | Kahan |
|---|---|---|
| ~~I~~ | ~~Email verification~~ ✅ **mukammal** |
| J | Barhta hua lockout (1.8) | Module 1 ka security refinement |
| K | Photos upload (2.3) | apna chhota module |
| L | Favorites | kisi module ka hissa banana parega |
| M | Admin refund (7.1) | Module 11 |

---

# Doosra audit — Module 0 se 9 (2026-08-21)

Pehla audit poochta tha "jo wada kiya, wo bana?". Ye poochta hai **"jo bana, wo
theek chalta hai?"** — aur is baar teen asli bug nikle, plus teen aur test
infrastructure me.

## Bug 1 — ek email do baar ja sakti thi 🔴

`claimDue` `SELECT ... FOR UPDATE SKIP LOCKED` chala raha tha, transaction ke
**bahar**. Postgres me bare statement apni implicit transaction me chalta hai jo
statement khatam hote hi commit ho kar **saare lock chhod deti hai**. Do worker
ek hi row uthate, aur guest ko wahi email do baar jati.

Test pehle **fail** hua, phir fix ke baad pass. Ab claim ek **UPDATE** hai —
uski apni transaction lock rakhti hai jab tak andar wala SELECT doosre worker ke
liye rows skip kar raha hota hai. Aur `next_attempt_at` ko ek **lease** ke tor
par aage badha diya jata hai: koi `sending` status nahi, koi reaper nahi — jo
worker mar jaye uski row apne aap dobara due ho jati hai.

## Bug 2 — cancellation email ulta sach bolti thi 🔴

Har guest ko `refundFor().refund` bheja jata tha. `guarantee` rate par guest ne
**kuch diya hi nahi hota** — usse charge kiya jata hai. To jis guest ke card par
$1,087 laga, use email milti thi: *"Refund: $1,087"*.

Ab message `settlementFor()` ka faisla batata hai — refund, charge, ya kuch
nahi. Teenon soorat ka test hai.

## Bug 3 — worker rows uthata hi nahi tha

`db.execute` driver ki rows deta hai — **snake_case keys**. `SELECT *` ko
`OutboxRow` type dena compile to ho jata hai, magar `row.toEmail`,
`row.attempts` sab `undefined` hoti hain. Query builder ab mapping karta hai.

## Test infrastructure ke teen bug

Ye isliye ahem hain ke **kabhi kabhi green** hone wala suite red se bura hai —
wo logon ko sikha deta hai ke dobara chala lo.

| | Masla | Hal |
|---|---|---|
| 4 | supertest har request par ephemeral port par listen karta tha; 5-way concurrency par `ECONNRESET` | ek baar `app.listen(0)` |
| 5 | `@Cron` jobs poore suite ke doran fire hote the — hold sweeper test ke neeche se booking cancel kar deta tha | `NODE_ENV=test` par scheduler band |
| 6 | outbox rows tests ke beech reh jati thin; har spec `amelia@example.com` par book karta hai, to purani email "aakhri email" ban jati | har `cleanup()` outbox saaf karta hai |

## Ek aur bug, flaky suite ka peechha karte hue mila 🔴

`notification_outbox.next_attempt_at` **database ki `now()`** se bharta tha,
aur worker use **Node ki clock** se compare karta tha. Do alag clocks — aur
asli deployment me app aur DB alag machine par hote hain. Chand milliseconds ka
skew aur har naya message "abhi due nahi" parha jata: har email ek minute late,
aur test me randomly gayab. Ab dono taraf ek hi clock hai.

Iske sath suite ki teen aur wajah theek huin: har spec ki apni adhoori safai
(ab ek `TRUNCATE ... CASCADE`), fake providers ka reset, aur ek test jo do
message ki tarteeb par bharosa kar raha tha jiska product koi wada nahi karta.

**Nateeja: 6 lagataar clean full runs.**

## Jo mila magar theek nahi kiya

| # | Cheez | Asar |
|---|---|---|
| ~~A~~ ✅ | ~~**Rule #57 ka dawa amalan sach nahi**~~ — `within` hook se ab sach hai; test dono rows ka transaction timestamp compare karta hai. ~~ — `notify(input, tx)` mojood hai magar **koi caller `tx` pass nahi karta**. Har notify transaction commit hone ke BAAD hota hai | Event commit ho aur process usi lamhe mar jaye to notification hamesha ke liye gum. Window milliseconds ka hai aur nuqsan ek email hai, paisa nahi — magar dawa poora nahi hota |
| ~~B~~ ✅ | ~~**9 templates likhe hue, kabhi fire nahi hote**~~ — 5 jud gaye (partner new booking/cancelled, payout sent/failed, booking modified). Baqi: `stay_reminder`+`review_request` (cron chahiye), `offer` (admin trigger), `refund_issued` (cancel wali email pehle hi refund batati hai — ye Module 11 ke admin refund ke liye hai). ~~ — sab se ahem `partner_new_booking`: **hotel ko kabhi pata nahi chalta ke kamra bik gaya**. Sath me `partner_booking_cancelled`, `partner_payout_sent/failed`, `booking_modified`, `refund_issued`, `stay_reminder`, `review_request`, `offer` | Do (reminder, review request) ko apna cron chahiye; baqi sirf jorne ka kaam hai |
| C | Hold lapse hone par booking cancel hoti hai magar guest ko **koi ittila nahi** | Usne booking chhori thi, magar batana behtar hai |
| D | `releasableFor` 5000 par **khamoshi se** kat jata hai | Self-healing hai (agla run baqi uthata hai) magar log kuch nahi kehta |
| E | `activeOrgIds` ka koi limit nahi | Aaj bemani, kal nahi |
| F | Suppressed message log me "failed" ginta hai | Sirf reporting |
| G | 2 tables ab bhi likhi nahi ja saktin: `amenities`, `photos` (~~`partnerMembers`~~, ~~`partnerOrgs`~~ Module 10 me jud gayin) | Module 11 aur 12 ka hissa |
| H | **Demand aur Ranking screens ab bhi nahi hain** — `search_events` + `search_impressions` aaj se bhar rahi hain (rule #67), screens Module 11 ke sath | Jaan boojh kar: data pehle, screen baad me. Ulta karte to screen pehle din khali hoti |
| I | `search_events.check_in`/`check_out` hamesha NULL — public search **dates leti hi nahi** | Column tayyar hai; jis din search me dates aayengi, event khud le jayega, koi migration nahi |
| K | `booking_nights` **sirf aage ki bookings** ke liye bharti hai — Module 10 se pehle ki booking ki koi row nahi | Aaj bemani (DB me asli data nahi). Agar kabhi ho, to backfill `pricing.nightlyRates` se mumkin hai — `allocateNightly()` wahi hisaab dobara chala dega |
| J | Comparables sirf **sheher** par muqabla karta hai — 5-star aur hostel ek hi market me | Aaj chalta hai; asli comp-set (stars + type + price band) tab chahiye jab ek sheher me kaafi properties ho jayein |

## Jo saaf nikla

- **58 rules** — sab code me pahunchte hain (#2 mansookh)
- **Har endpoint ka guard** ek ek kar ke dekha — koi route ghalti se `@Public()` nahi
- **28 tables me se 28** ka read path, 24 ka write path
- Modules 5, 6, 8 apne daaire me mukammal

---

## Jaan boojh kar na banaya gaya — aur wajah

Ye wo cheezein hain jo **bhooli nahi gayin**. Har ek dekhi gayi, aur na banane ka faisla
hua. Likhi is liye hain ke baad me koi ye na samjhe ke reh gayi thin.

### `extranet/account/connectivity` — channel manager

Booking.com aur Expedia se rates aur inventory ka **do-tarfa** sync. Ek screen ka kaam
nahi:

- har OTA ka apna protocol aur apni certification
- **dono taraf se** inventory par takraav — overbooking ka sab se bara sabab
- room type mapping: un ka kaun sa, hamara kaun sa
- reconciliation jab dono taraf ek hi raat ke liye alag baat kahein

Rule #29 ka `CHECK (booked_units <= sellable_units)` **hamari taraf** ki zamanat hai.
Doosri taraf koi aur likh raha hota hai. Ye apna module hai.

### Paid visibility (`boost`, `boost/preferred`)

Ranking ab maujood hai (#104), magar **bechi nahi ja rahi**. Pehle tarteeb apna kaam
kar ke dikhaye — kaunse factors asal me clicks badalte hain — phir us me jagah bechna.
Ulta karna wo cheez bechna hai jis ke asar ka koi saboot nahi.

### `rates/country-rates` aur `boost/room-differentiation` — hata di gayin

Pehli ka mechanism rule #68 mana karta hai (mulk IP se). Doosri display ka masla thi,
backend product nahi — jo chahiye wo room ki `features` me pehle se hai.

### Teen email jo abhi bhi kabhi nahi jatin

| Template | Kya chahiye |
|---|---|
| `stay_reminder` | cron — stay se pehle |
| `review_request` | cron — stay ke baad |
| `offer` | admin trigger: campaign kaun banata hai, kis ko jati hai |

Teenon ka text likha hua hai aur render hota hai; koi unhein queue me daalta nahi.

### Hold lapse par guest ko kuch nahi jata

Rule #44 ka 15-minute hold guzarne par booking cancel hoti hai — koi ittila nahi.
`holds.service.ts` me `notify` ka koi call nahi.

### Search dates leta hi nahi

Isi liye `/hotels` card par "from $X" hai, poora total nahi.
`search_events.check_in`/`check_out` columns **tayyar hain** aur hamesha NULL rehte hain.
Jis din search dates legi, event khud le jayega — koi migration nahi.


---

## Frontend ab poora API par (2026-08-27)

Chaar surfaces me se teen ab live API parhti hain. `src/store` aur `src/data` ka koi
import extranet ya admin me nahi bacha.

| Surface | Screens | Haalat |
|---|---|---|
| `dashboard/*` | 7 | real API |
| `extranet/*` | 68 | real API |
| `admin/*` | 24 | real API |
| `(site)/*`, `join/*` | baqi | mila jula — 4 public screens me abhi thora dummy |

**139 screens: 80 real API · 53 static · 6 dummy.**

### Admin ke liye backend me kya add karna para

Screens wire karte waqt paanch asli khalaayein nikliin — sab isi wajah se ke jo screen
dikha rahi thi, API wo bata hi nahi sakti thi:

| Kya | Kyun |
|---|---|
| `counts` — support queue | badge aur tabs ko poore queue ka number chahiye, page ka nahi |
| `counts` — moderation queue | wahi wajah |
| `counts` — users (role ke hisaab se) | guests aur staff do alag aabadiyan hain |
| `orgId` + `orgName` + `counts` — admin listing detail | "ye kis ki property hai" ke baghair approve karna andhera faisla hai |
| `orgName` + `orgId` filter — admin payouts aur invoices | jis row par likha hi na ho ke kis ka paisa hai, us par kaam nahi ho sakta |

Partner ke apne endpoints me se kisi ki shakl nahi badli — har ek alag method hai, kyunke
"ek org" aur "har org" do alag sawal hain.

### Admin screens jo hataye ya badle gaye

| Screen | Kya hua |
|---|---|
| `promotions/rankings` | property ko discount ke hisaab se rank karne ka koi endpoint nahi. Kaam ki cheez — "sab se gehre discount chal rahe hain" — promotions list par aa gayi |
| `users` ka "Invite manager" | platform kisi org me invite kar hi nahi sakti; wo org ka apna kaam hai (`POST /partner/team/invites`) |
| `content` ki moderation | "content status" naam ki koi cheez nahi — description listing ka hissa hai. Ab **listing quality score** (rule #99), har category ka apna mashwara |
| `properties` ka detail | floors, yearBuilt, phone, website, occupancy, per-room "booked", **taxes table** — sab farzi. Tax table to rule #11 ke khilaf tha |
| `properties` list ke bulk Approve/Suspend | "request changes" ko note chahiye — chhe properties ke liye ek note kisi ke baare me nahi hota |
| `reviews` ka Hide/Flag | API ke sirf do outcome hain: `published` / `rejected`. `withdrawn` guest ka faisla hai |
| `billing` | subscription/MRR farzi tha. Ab **settlement terms** — deduct ya invoice, jo asli choice hai |
| dashboard ka "Export report" | toast ke baad kuch nahi hota tha |
| bell ka notification feed | admin audience hai hi nahi — ab work queue |
| global search ka client-side index | poore database ko browser me rakhna parta; ab live API search, debounced |

---

## Har screen ab API par (2026-08-27, doosra hissa)

`src/store` aur `src/data` ka koi import kisi screen me nahi bacha.

**138 screens: 85 real API · 53 static · 0 dummy.**

### Aakhri chhe screens

| Screen | Kya hua |
|---|---|
| `__seedcheck` | apne comment ke mutabiq "TEMPORARY build-time probe" — delete |
| `(site)/hotels/[id]` | reviews aur rating ab `GET /properties/:slug/reviews` se. Rating **server** deti hai, page ke reviews ka average nahi — 60 me se 20 ka average us count se ikhtilaf karta jo saath likha hai |
| `(site)/support` | hotel message form booking par, ticket form asli `GUEST_CATEGORIES` par. Priority picker gaya (API mana karti hai — priority platform ka faisla hai) |
| `(site)` home | strips `GET /properties`, destinations naya `GET /destinations`. Testimonials, newsletter, Special Offers hataye |
| `(site)/checkout` | arrival windows property ke `checkInTime` se |
| `join/unit/price` | commission ab registration draft se, jo platform settings parhta hai. "12%" label hardcoded tha, seed ka default 15% hai |

### Do naye public endpoints

| Endpoint | Kyun |
|---|---|
| `GET /destinations` | home page ke city cards ko **asli counts** chahiye — "342 properties in Dubai" jab kul aath hain |
| `commissionRateBps` on `GET /join/registration` | applicant ko wohi rate dikhe jo us ke pehle invoice par lagega |

### Ek card, do nahi

`HotelCard` (store se rating parhta tha) delete; `ResultCard` → `components/marketplace/property-card.tsx`.
Pehle ek hi hotel home page par ek score dikha sakta tha aur search par doosra.

## Join wizard — 31 screens, ab asli (2026-08-28)

Aakhri surface. Pehle ye poora **browser ke andar** tha: `wizard-provider` ek module-level
store tha jo `localStorage["stayora-join-draft"]` par chalta tha. Refresh se bach jata,
aur bas — doosra device nahi, phone nahi, aur **platform bhi nahi**.

Ab har screen `PATCH /join/registration` par Continue ke waqt save hoti hai, aakhri screen
`POST /submit` karti hai, aur approval par org + property + rooms + rate plans + photos ek
transaction me bante hain.

### Do shapes ek hue

Client ka apna `RegistrationData` **delete**. Ab `@stayora/shared` ka `RegistrationDraft`
hi wahid shape hai; local sirf `fill()` hai jo server ke partial draft ko form ke qabil
banata hai. (Warna ye is repo ka **chhata** type system ban jata.)

### Jo sawal poochte the aur jawab phenk dete the

| Screen | Kya poocha jata tha | Kahan jata tha | Ab |
|---|---|---|---|
| 7 | `roomTypes` — naam, bed, guests, count | **kahin nahi** (asli rooms 14–19) | **`description`** — jo submit ke liye lazmi hai aur koi screen poochti hi nahi thi |
| 9 | "Add photo" → ek counter, file picker kabhi khulta nahi tha | kahin nahi | asli upload (presign → PUT → confirm), approval par listing gallery |
| 10 | weekend pricing + markup, seasonal rates | kahin nahi — **day-of-week pricing hai hi nahi** | hataye; `baseRate` ab rooms ko seed karta hai |
| 14 | smoking | draft tak | `rooms.features` |
| 16 | bathroom private/shared + fittings | draft tak | `rooms.features` |
| 22 | invoice address (5 **uncontrolled** inputs) | likha hi nahi ja sakta tha | `partner_orgs.billing_address` |
| 23 | `cancelFreeUntil` + `cancelCharge` | **kahin nahi** — step 11 ka doosra vocabulary | ek hi field, dono screens par |
| 29 | maalikan ke naam + tareekh-e-paidaish, business entity | **kahin nahi**, "legal requirements" ke unwan ke neeche | asli document upload (identity/ownership/business/tax) |
| 31 | contracting party ka poora pata (uncontrolled) | kahin nahi | jo maloom hai wo **dikhaya** jata hai, dobara poocha nahi |

### Jo ghalat likha tha

| Kahan | Kya kehta tha | Sach |
|---|---|---|
| step 11 | "Moderate: free up to **5 days**" | **48 ghante** |
| step 11 | "Strict: **50% refund**" | poora stay charge — 50% is system me hai hi nahi |
| step 12 | "payouts **7 days** after checkout" | **1 aur 16** tareekh, $100 minimum carry (rules #48, #50) |
| step 12 | "commission (typically 15%)" | applicant ke apne draft se, `commissionRateBps` |
| step 18 | "Rs" prefix, "including taxes and fees" | USD; rate par kuch nahi jurta (rule #11) |
| step 19 | "cancellations 60% kam", "occupancy 28% zyada" | file me likhe hue aankray, kahin naapay nahi gaye |
| step 21 | "card, wallet, **bank transfer**" | sirf card — `payments` me brand + last4 aur bas |
| step 21 | "fraud aur **chargeback protection**" | koi aisa wada system me nahi |
| step 2 | "2FA code SMS par" | **2FA hai hi nahi**; `+92` prefix bhi fix tha |
| step 6 | 5 mulk ka dropdown + "map preview" | free text + suggestions; property par **coordinates hain hi nahi** |
| step 31 | "open for bookings" | review kholta hai, listing nahi |
| done | "24–48 hours me live" | koi SLA maujood nahi — ab asli status parhta hai |
| submitted | "submitted for review" (step 12 par!) | 18 screens abhi baqi thay |

### Cents

`money()` ab **cents** leta hai. `baseRate` aur room ka `price` dono dollars me store ho
rahe the ek field me jo contract me cents hai — $550 ka kamra database tak **$5.50** pohanchta.

### Teen bug jo raaste me nikle

**`PresignedUpload` me `method` tha hi nahi.** Extranet ka uploader `signed.method` parhta
tha → `undefined` → `fetch` ne **GET** kiya, jabke storage route `@Put` hai. Yani extranet
se koi tasveer kabhi upload hui hi nahi. Ab verb contract ka hissa hai.

**Commission 0% quote ho raha tha.** `platform_settings` ka singleton row admin screen ke
khulne par banta hai; jis installation par koi nahi khola, wahan row nahi — aur fallback
**zero** tha. Applicant ko likh kar dikhaya jata ke platform kuch nahi leta. Ab fallback
`DEFAULT_COMMISSION_BPS.professional`, aur seed row banata hai.

**IBAN hamesha ke liye draft me pada rehta tha.** `partner_payout_accounts` jaan-boojh kar
sirf `last4` rakhta hai — magar poora IBAN + SWIFT `partner_registrations.data` me har us
admin ko nazar aate jis ke paas queue khuli ho. Ab approval par scrub.

### Naya

- `/verify-email?token=` — **wo route jo maujood hi nahi tha.** Har `verify_email` email
  isi par bhejti thi, aur har link 404 deta tha. Kisi ka email is product se verify ho hi
  nahi sakta tha.
- Email ki tasdeeq ab submit ki shart (rule #117), photo bhi (rule #119).
- Steps 1–4 asli signup + login + profile; password kabhi store nahi hota, account ke
  teen screens **memory** me chalte hain, `localStorage` me nahi.

### Test

`registration.e2e-spec.ts` 23 → **28 tests**; naye paanch: gallery carry-over + position,
IBAN scrub, bathroom/smoking → features, billing address, aur photo/PDF ka type check.
Poora suite **792 pass**.


# Aakhri sweep — kya waqai sab API par hai (2026-08-28)

Har surface ki har screen check ki: **139 pages, 6 surfaces**. Koi page seedha mock import
nahi karta tha — leak **shared components** aur **public marketing pages** se tha.

## Jo mila

### 1. Notification bell — teen headers, demo store

`useNotifications(audience)` `@/store/selectors` se, jabke `/dashboard/notifications`
usi naam ke API hook se. Ek hi shakhs ko bell "3 unread" aur page kuch nahi.

`audience` prop bhi gaya — `/notifications` server par caller ke hisab se scope hota hai.
Aur bell ab **sign-in se pehle render hi nahi hota**: pehle public header par
Register/Login ke barabar tha, har page par ek yaqeeni 401.

### 2. Extranet change-password kuch nahi karta tha

`toast.success("Password updated")`, koi request nahi. `POST /auth/password` shuru se
maujood tha, aur `useChangePassword()` hook bhi. Sabse khatarnak: laptop kho jane par
password rotate karne wale partner ko likh kar bataya jata ke ho gaya.

Sath me: client ka type `{ changed: true }` tha, API `{ endedElsewhere: n }` deta hai —
live probe se pakra. Ab dono screens asli ginti dikhati hain ("signed out of 2 devices"),
blanket dawa nahi.

### 3. Home search ke 16 farzi destinations

`@/data/locations`: Dubai, Tokyo, Bali, Santorini, Bora Bora, Ibiza… Catalogue me **New
York aur Paris**. Guest "Bali" chunta, search zero deta — home page ke pehle control se.
Ab `GET /destinations`, property count ke sath.

### 4. Support search dhoondta kuch nahi tha

`toast.success("Searching help articles for X…")` — aur jawab usi page par 800px neeche
maujood the. Ab `?q=` se asli filter, `#faq` par scroll, aur jawab ka link share ho sakta
hai. FAQ ke chaar jawab bhi ghalat the (Apple/Google Pay, reward points, "message the
hotel from this page", group bookings) — rule #120 wali qism.

### 5. Paanch orphan components + do dead buttons

`InvoiceRowActions` ("Reminder sent", "Downloading invoice…"), `PrintButton`,
`AddRoomTypeDialog`, `AddItemDialog`, `ToggleGroupsManager` — kisi ne render nahi kiya.

Aur extranet reviews par "Export" + "Review Settings", dono `ActionButton` se — wo
component jis ka maqsad hi ye tha ke "no control is a dead end". Wo dead end rokta nahi
tha, **dead end dikhna** rokta tha. Component samet gaya.

### 6. Public pages ke na-saabit dawe

| Kahan | Dawa | Asliyat |
|---|---|---|
| `/about`, `/press` | 2,400+ properties · 68 countries · 1.2M stays · 4.8/5 | **8 · 2 · — · 0 reviews** |
| `/press` | chaar media mentions | **koi publication maujood nahi** |
| `/press` | 180 log, 14 mulk, 2019 London | system me kuch nahi |
| `/careers` | chhe vacancies, "Updated weekly" | koi opening nahi |
| `/about` | "har property visit ki jati hai" | site visit ka koi tasawwur nahi |
| `/about` | "environmental programmes ko search me barhawa" | ranking me paanch factors, koi sustainability nahi |
| `/partners/affiliate` | tiers 4% → 8%, 45-din cookie | **koi referral code, attribution, ya payout nahi** |
| `/partners/travel-agents` | "**Guaranteed** 10% commission" | sirf `bookings.source = travel_agency` |

Naya `GET /platform/stats` — properties, cities, countries, reviews, average rating.
Guest count jaan-boojh kar nahi (rule #122). Load na hone par **dash**, sifar nahi.

Affiliate aur travel-agent pages ab "not open yet" — koi rate nahi, dilchaspi darj karne
ka rasta.

### 7. Mock layer poora hataya

`src/data/` + `src/store/` + `StoreHydration` — **33 files, 230K** — ab koi consumer nahi
tha. `zustand` dependency bhi gayi.

## Ab ki haalat

```
139 pages   ·   142 files API par   ·   0 mock imports
```

Jo pages ab bhi static hain wo waqai static hain: `/privacy`, `/terms`, `/cookies`,
`/cancellation-policy`, `/blog`, `/partners/hotels` — qanooni matn aur wo marketing jo
sirf asli cheezon ka zikr karti hai.

**Verify:** frontend typecheck + lint + build saaf · backend typecheck + lint saaf ·
registration 28 tests · catalog + auth 67 tests · poora suite 792 pass · aur live API par
`/platform/stats` → `{properties:8, countries:2, cities:2, reviews:0, averageRating:null}`,
`/destinations` → New York (6) + Paris (2), notifications signed-out → 401.


# Browser QA — paanch roles, asli Chrome (2026-08-28)

Playwright + asli Chrome, **production build** par (`next start`), dev server par nahi —
dev har route pehli baar compile karta hai, jo "screen load hui?" ko "teen second me
compile hui?" bana deta hai aur adhi-bhari tables ko khaali report karta hai.

Har page par console errors, uncaught exceptions, nakaam requests aur har 4xx/5xx pakre
gaye, us route ke naam ke saath jo us waqt khuli thi.

| Role | Routes | Checks |
|---|---|---|
| Visitor (bina account) | 15 | 6 |
| Customer `guest@stayora.test` | 8 | 5 |
| Partner `owner@aurora.test` | **56** | 6 |
| Admin `admin@stayora.test` | 21 | 7 |
| Naya applicant (join wizard) | poora flow | 14 |

**Nateeja: 38/38 checks pass · findings 192 → 19.** Roles 2, 3, 4 — 85 routes, **sifar
findings**. Baqi 19 wahi ek `/auth/me` 401 hai jo signed-out visitor ka jaan-boojh kar
diya gaya jawab hai (client use catch karta hai).

## Jo QA ne pakra

### 1. Admin panel kisi bhi signed-in account ke liye khula tha (critical)

Role `localStorage` se, default `super_admin`, aur topbar me switcher. Mehmaan aur partner
dono `/admin` khol kar poora shell dekh sakte the. Data nahi nikla (API ne har call par
403 diya) — magar naqsha nikla. Rule #127.

### 2. Guard ke bahar ka chrome API se poochta tha

Topbar aur sidebar guard ke ird-gird render hote hain. Jis mehmaan ko guard refuse karne
wala tha, us ka browser pehle hi teen admin queries maar chuka hota tha. Rule #128.

### 3. `limit=0` — har admin screen par teen 400

Command palette "mat bhejo" ko `{ limit: 0 }` se kehta tha; schema ka min 1 hai. Rule #129.

### 4. Public marketplace par har page 401 phenkta tha

`useFavorites`, `useMyBookings`, `useMyTickets` bina session ke fire hote the — home,
search, har property page, support. Ab `enabled` par. Rule #129.

### 5. Teen client types API se match nahi karte the (critical)

`POST /auth/password` → `{ endedElsewhere }` tha, `{ changed: true }` likha tha.
`GET /admin/reservations` → booking **row** (flat `guestFirstName`), `BookingDto` (nested
`guest`) likha tha — teen screens par `Cannot read properties of undefined`.
`GET /admin/reservations/:id` → `{ booking, events, payments, totals }`, `BookingDto`
likha tha. Sahi type likhte hi compiler ne har ghalat jagah dikha di. Rule #130.

### 6. `api()` khud apna contract tor raha tha

Nest `null` ko khaali body banata hai; client `undefined` lauta raha tha; react-query
`undefined` qubool nahi karti. `payoutAccount` (jo `| null` typed hai) wali screen chal hi
nahi sakti thi — "Query data cannot be undefined". Rule #130.

### 7. Favourite ka dil property page par 400 deta tha

`toHotel()` jaan-boojh kar `id` me **slug** rakhta hai (URL ke liye), aur wahi slug
favourites API ko UUID ki jagah jaata tha. Card grid pehle theek ho chuka tha; detail page
nahi. Ab `data.id`.

### 8. Login har role ko mehmaan ke dashboard par bhejta tha

Partner apni khaali bookings dekhta tha, extranet ka koi ishara nahi. Rule #131.

### 9. `/admin/settings` par React error

"Currency" ka block `FormField` ke bahar `FormLabel`/`FormControl` istemal karta tha —
`useFormField must be used within a <FormField>`, har visit par.

## Regression checks

QA script me ab wo teen bhi hain jo is pass me nikle:
`no admin screen fires limit=0` · `the reservations table does not throw on a guest name` ·
`the settings form does not misuse FormField` — aur do RBAC wale:
`a guest's browser fires no admin requests` · `a partner's browser fires no admin requests`.

## Join wizard — poora flow browser me

Naya applicant: email → naam/phone → password (**asli `POST /auth/signup` → 201**) →
session bana → draft bana (11 gaps) → unverified email gap me hai → commission **1500 bps**
(sifar nahi) → verify screen par asli address, koi "demo" nahi → property step **PATCH 200**
→ jawab server tak pohancha → **reload ke baad bhi mojood** → `localStorage` **khaali** →
signed-out visitor wizard step nahi khol sakta.

Chhe mahine purana `localStorage` wala wizard ab poori tarah server par hai, aur ye browser
me tasdeeq shuda hai.


# Doosra browser QA — jo pehle pass ne miss kiya (2026-08-28)

Pehle pass ne `/admin` ka guard check kiya aur `/extranet` aur `/dashboard` ko **bharosay
par** chhor diya. User ne khud pakra: address bar me `http://localhost:3000/extranet`
likha, bina login ke, aur poora partner shell khul gaya.

Sabaq: **"maine ek surface check ki" ka matlab "teenon theek hain" nahi hota.** Ab guard ka
poora matrix test hota hai — har surface, har role, dono taraf.

## 1. Do surfaces par koi guard tha hi nahi (critical)

`/extranet/*` (56 screens) aur `/dashboard/*` (8) par sirf layout tha, koi auth check nahi.
API ne sab kuch 401 kiya, is liye data mehfooz raha — magar ajnabi ko poora shell nazar
aata tha. Rule #132.

Naya `RequireRole` teenon layouts ke **sab se bahar** hai (chrome se bhi upar, rule #128),
aur do alag jawab deta hai: **session nahi** to `/login?next=…`, **ghalat role** to saaf
inkar us ke apne darwazay ke saath.

**Matrix: 92/92.**

| | `/dashboard` | `/extranet` | `/admin` |
|---|---|---|---|
| signed out | login | login | login |
| customer | **khulta hai** | inkar | inkar |
| partner | **khulta hai** | **khulta hai** | inkar |
| admin | **khulta hai** | inkar | **khulta hai** |

## 2. Checkout par qeemat sau guna zyada thi (critical)

`formatCurrency` poore units leta tha, API cents deti hai. 164 call sites me se 56 ne
`/ 100` nahi kiya — un me **checkout** aur **property cards** dono the.

- card: `$72,500` jabke kamra **$725** ka hai
- checkout: `$32,000` ek raat, jabke **$320**; total `$64,000` jabke **$640**

Formatter ab cents leta hai; 108 jagah ka `/ 100` hataya. Rule #133.

Ab `prices.mjs` har number ko **API se milata hai** — 6/6.

## 3. Extranet dashboard phone par 282px baahar

Grid item `min-width: auto` ki wajah se apne content se patla nahi ho sakta tha. `min-w-0`
se theek. Rule #134.

## 4. Ek jhoota surag, aur wo kyun jhoota tha

Har public page `scrollWidth` me 97px zyada batata tha. **Magar page waqai sideways scroll
hota hi nahi** — sticky header ke andar nested scroll container root ka `scrollWidth`
phula deta hai. Site header par is paimane par kiya gaya "fix" **wapas le liya gaya**: wo
kabhi tuta hi nahi tha.

QA ab `window.scrollTo(600,0)` ke baad `scrollX` naapti hai — wohi jo insan mehsoos karta
hai. Rule #135.

## Suites

| Suite | Kya | Nateeja |
|---|---|---|
| `guards.mjs` | har surface × har role, dono taraf | **92/92** |
| `all-roles.mjs` | 101 routes, 5 roles, console/network | **38/38** |
| `usecases.mjs` | booking, logout, admin decision, mobile | **20/20** |
| `prices.mjs` | UI ka number vs API ka number | **6/6** |

Logout browser se: session 401 ho jati hai **aur** extranet peeche se band. Admin ka
`409` un applications par jo submit hi nahi hui (rule #103). Mobile par saatoon routes
sideways scroll nahi karte.

---

# QA pass — 31 Aug 2026

Poora product, browser se, ek hi taaza seed par. Frontend `next start` (dev nahi —
dev pehli request par compile karta hai, jis se "screen chali?" ka sawal "3 second mein
compile hui?" ban jata hai aur aadhi bhari tables khali dikhti hain).

> Port **3000**, 3100 nahi. Backend ka `WEB_ORIGIN=http://localhost:3000` hai aur app
> API ko **cross-origin** bulati hai (`NEXT_PUBLIC_API_URL`). 3100 par har API call CORS
> par marti hai — QA wahan asal product nahi, CORS naapti.
>
> Waise `main.ts` ka comment kehta hai ke Next ka `proxy.ts` `/api/*` ko yahan rewrite
> karta hai — **aisi koi file nahi hai**. Comment purane iraade ka hai, mojooda haqeeqat
> ka nahi.

## 5. Jo cheez tumhari nahi, us ko maangna

Role sweep ye sabit karti hai ke har surface sahi logon ke liye khulti hai. Ye us ka
doosra aadha hissa hai: **sahi role, ghalat id**. Ye request well-formed hai, signed-in
hai, aur us ke aur data ke darmiyan sirf ye khari hai ke query scoped hai ya nahi —
OWASP API1. Koi role check is ko nahi pakarta.

`boundaries.mjs` ek doosra mehmaan banati hai, us ki apni booking banati hai, phir seed
wale mehmaan se us ko maangti hai.

| Kya poocha | Jawab |
|---|---|
| doosre ki booking parhna | 404 |
| doosre ki booking cancel karna | 404 |
| us ka deep link `/dashboard/bookings/<id>` | 404 page, us ka naam kahin nahi |
| guest → `/partner/*` (4 routes) | 403 |
| guest → `/admin/*` (3 routes) | 403 |
| partner → `/admin/*` (3 routes) | 403 |
| partner → doosre ka rate plan PATCH | 404 |

**Aur ek check jo asal mein maayne rakhta hai:** mana kar dena kaafi nahi agar mana
karne ka tareeqa **alag** ho us booking ke liye jo maujood hai aur us ke liye jo nahi.
Wo farq khud ek oracle hai — us se asal ids enumerate ho jati hain. Dono `404` dete
hain, parhne par bhi aur cancel par bhi.

Limiter bhi asli hai: ek pate se 9 login koshishein → 429, aur saath wala pata bay-asar
(401, 429 nahi). Ye node se chalta hai, page se nahi — browser cross-origin fetch par
`x-forwarded-for` nahi bhejta jab tak server preflight mein us ka naam na le, to
page ke andar se ye test limiter nahi, CORS naapta.

> Pehli baar cancel ne 400 diya aur ye finding lagi. **Test ghalat tha:**
> `cancelBookingSchema` `.strict()` hai aur maine ek fazool key bheji thi, to validation
> authorisation se pehle mar gayi. Probe theek ki, phir 404.

## 6. `properties.base_price` approval par ghalat set ho raha tha

Rule #138. Ye is pass ka **wahid asli product bug** tha — aur QA se nahi, code parhne se
mila: `recomputeBasePrice` kehta hai ke ye column haath se set nahi hota, aur registration
approval bilkul wahi kar raha tha. Fix + regression test.

## Suites

| Suite | Kya | Nateeja |
|---|---|---|
| `guards.mjs` | har surface × har role, dono taraf | **92/92** |
| `boundaries.mjs` | doosre ka data, id se | **21/21** |
| `all-roles.mjs` | 101 routes, 5 roles, console/network | **38/38** |
| `usecases.mjs` | booking, logout, admin decision, mobile | **20/20** |
| `journeys.mjs` | ek waqia teen surfaces se guzarta hua | **13/13** |
| `money.mjs` | har screen ka har number vs API | **16/16** |
| backend | `npm test` | **810/810**, 27 files |

Findings ki ginti sifar nahi hai (guards par 23) — magar wo **teiees copies ek hi cheez
ki** hain: signed-out visitor ka `/auth/me` 401, jo by design hai aur console error ban
kar ginta hai. Koi doosri qism ki finding nahi.

Money suite dono taraf se dekhti hai: sahi number **maujood** ho, aur cents-as-dollars
(`$96000`) aur do baar taqseem (`$9.60`) dono **ghair-maujood**.

## 7. Bug band karne ke baad us ki **shakl** band karna

Rule #138 ka fix ek line tha. Us ke baad teen cheezein, taake yehi ghalti dobara na ho —
kyunke masla ek line ka nahi tha, ek shakl ka tha: **derived column jise koi bhi raasta
haath se likh sakta hai.**

**Ek — jhoota mechanism hataya.** `cheapest(input.units)` abhi bhi wahan tha aur
authoritative lag raha tha; mera fix us ka nateeja foran theek kar deta tha, magar line
zinda thi. Us ka comment bhi ghalat tha (*"the cheapest room, which is what `from $X` on
a card means"* — nahi, wo cheapest PLAN hai). Ek hi caller tha. Poora function hataya.

**Do — type se rok.** `NewProperty` (rule #138a) `basePrice` / `rankingScore` / `rankedAt`
ko insert type se nikal deta hai. Type lagate hi build **doosri** creation path par toot
gayi — jo `basePrice: 0` likh rahi thi, number theek magar haq nahi. Yehi is change ka
apna proof tha.

**Teen — invariant, na ke path.** `basePriceDrift` poori table par chalta hai (rule #138b).
Sabotage kar ke tasdeeq ki: `createRatePlan` se recompute hataya to scan ne teen rows naam
le kar batayin. Registration spec bhi ab wohi shared helper bulati hai, taake do jagah do
alag tareef na paal len.

Suite 804 → **810 / 27 files**.

> Ek cheez jo chhori: in chaar files ko haath se ek batch mein chalaya to `listing` spec
> `amenities_slug_unique` par tooti (64 tests akele chalne par pass, poore suite mein bhi
> pass). Yani suite mein **order dependence** kahin maujood hai. Mere change se nahi —
> is ki tehqeeq nahi ki.

---

# Saat khuli cheezein — 4 Sep 2026

## #2 + #3 — pagination, aur ek hi shakl

Ye ek hi fix tha. `listMine` **100** par cap thi, `listForPartner` **200** par —
bina cursor, bina kisi ishare ke aur bhi hain. 201 reservations wala partner 200
dekhta tha aur usay pata bhi nahi chalta. **Cursor ke bagair cap limit nahi hai —
wo ghalat jawab hai jo sahi lagta hai.**

Keyset ab teesri baar likhne ke bajaye ek jagah rehta hai:
[`common/pagination/keyset.ts`](../backend/src/common/pagination/keyset.ts).
Pehle catalogue search mein tha, phir admin search mein, aur teesri copy tab
banti jab guest/partner lists ko chahiye hoti — **teen copies teen mauqe hain ek
mein tiebreak bhoolne ke.**

Tiebreak yahan sab se zyada maayne rakhta hai: partner list `check_in` par sort
hoti hai, jo **DATE** hai. Ek din par teen arrivals ka matlab teen rows ek hi
sort value par. `check_in > X` akela un mein se do ko chhod jata hai.

> Sabotage se tasdeeq: tiebreak hata kar chalaya to **5 mein se sirf 2** bookings
> wapas aayin. Test us ko pakarta hai.

Dono endpoints ab `{ items, nextCursor }` dete hain, `/admin/reservations` ki
tarah — shape ka farq khatam. Partner list par `status` / `from` / `to` filters
bhi, kyunke extranet abhi har row kheench kar browser mein filter karta hai.

Frontend par consumers arrays hi parhte hain: `allPages()` cursors ko end tak
follow karta hai, ek **saaf hadd** ke saath. Ye interim hai aur code mein likha
hai — stat card ke liye browser mein rows ginna kisi bhi page size par ghalat
shakl hai; un views ko server-side aggregates chahiye.

## #4 — "order dependence" nahi thi

Reproduce nahi hui (135/135, wohi files wohi order). Asal wajah ye thi:
**suite aur chalta hua dev server ek hi database share karte the.** Specs
files ke darmiyan TRUNCATE karti hain — us database par jo `npm run dev` bhi
serve kar raha ho, wo test setup nahi, **do writers ki race** hai.

Yehi poore session mein baar baar kaat rahi thi: har `npm test` seed ura deta
tha. `TEST_DATABASE_URL` ab required hai (rule #140), `db:migrate:test` script
aur `drizzle.test.config.ts` ke saath.

> Saboot: 815/815 chalne ke **baad** dev DB mein 8 properties, 6 users, 5
> bookings salamat. Session mein pehli baar.

Aur usi shakl ka doosra masla saath nikla: `MAIL_DRIVER=sendgrid` .env mein
hote hi suite ne **waqai bhejna** shuru kar diya — 24 tests fail, aur 11 asli
requests SendGrid tak. Ab `NODE_ENV=test` par mail aur storage dono zabardasti
`fake` hain.

## #5 — QA ab repo mein hai

Do baar temp directory ke saath ur chuki thin. Ab [`qa/`](../qa/README.md):
`smoke` · `guards` · `boundaries` · `money`, ek shared harness par, `npm run all`
se sab.

`guards` ne pehle run par 9 jhoote failures diye — wo "Checking your access…"
spinner ko khula darwaza parh raha tha. Ab **faisle** ka intezaar karta hai,
waqt ka nahi. Aur closed ki do shaklein hain, kyunke product do cheezein do tarah
mana karta hai: session nahi → `/login`; role ghalat → wahin rok kar bata deta
hai. Sirf ye do ginti hain — khali shell aur na rukne wala spinner **khula** hai.

## #7 — faisla ho gaya

Rule #139. "From $X" = advertised sab se sasta rate. Occupancy discount aur
calendar override jaan boojh kar bahar, kyunke search abhi na dates leti hai na
guest count. Test se pin — is liye nahi ke doosra padhna ghalat hai, balke is
liye ke wo **maaqool** hai.

## Nateeja

| | |
|---|---|
| backend | **815/815**, 27 files |
| qa | guards, boundaries, money **poore pass** |
| smoke | 14/15 — wahid failure asli hai: mail `failing` (neeche) |

---

# Saat khuli cheezein — mukammal

| # | kya tha | ab |
|---|---|---|
| 3 | hold khatam hone par mehmaan ko koi khabar nahi | `booking_hold_expired` email + in-app |
| 1 | reminder aur review request likhi hui, bhejne wala koi nahi | teen daily jobs (rule #141) |
| 2 | `offer` template, koi trigger nahi | `POST /admin/offers`, consent + idempotency + audit |
| 5 | payout/invoice 5000 par khamosh cap | dono page karte hain, stop `error` par log (rule #143) |
| 6 | `booking_nights` sirf aage ka | nightly repair, jo pehla run backfill hai |
| 7 | admin matrix sirf browser mein | `platform_role` + `AdminAccessGuard` (rule #144) |
| 4 | search dates nahi leti thi | availability filter (rule #145) |

Backend **860/860 · 30 files**. QA: smoke · guards · boundaries · money — sab pass.

## Jo raaste mein nikla

**Teen jobs ek lock par.** `notificationDelivery` har minute chalta hai aur 7005
par baitha tha — us ke saath daily ranking aur overdue invoices. Yani wo daily
jobs kisi bhi din chup chaap skip ho jate. 7004 par do aur the. Rule #142.

**`canReview` ka deadlock.** Review ke liye `completed` chahiye tha, aur koi
cheez booking ko completed karti hi nahi thi. **Koi mehmaan kabhi review likh hi
nahi sakta tha** — ye #1 karte hue nikla, aur #1 se bara nikla.

**`notify` ka jhoota number.** Offer endpoint `queued: 1` kehta jab kuch bheja hi
nahi gaya ho (bandey ne marketing band ki hui ho). `notify` ab batata hai ke us ne
asal mein kya kiya, aur count sirf usi ka hai.

**Frontend ka apna `SessionUser`.** Haath se likha hua doosra copy — API ne
`platformRole` add kiya aur wo TypeScript ko nazar hi nahi aaya. Ab `@stayora/shared`
se aata hai.

**`resetDb` rate limiter saaf nahi karta tha.** Kisi spec ka **doosra** run pehle
se bhare buckets par shuru hota, aur logins beech mein fail hone lagte — jis test
par bhi girta, wajah wahan hoti hi nahi.

## Aur jo database ne khud pakra

`platform_role` par CHECK lagate hi teen jagah 500 aane lage — sab asli
inconsistencies:

- admin ko customer banate waqt grade saaf nahi hota tha
- partner banate waqt bhi wahi
- registration approval user ko partner karti thi, grade chhor kar

Teenon theek. **Ye wahi constraint hai jo apna kaam pehle din kar gaya.**
