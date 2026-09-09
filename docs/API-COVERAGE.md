# API coverage — har screen ke muqable

Sawal: **kya frontend ki sari screens ke liye API ban chuki hai?**

```
142 frontend screens   (2 hata di gayin)
185 backend endpoints
141 screens ka business logic maujood hai
  1 screen baqi — account/connectivity, aur wajah likhi hai
```

Ginti khud kuch sabit nahi karti — ek endpoint kai screens chalata hai, aur 11 screens
(marketing aur legal) ko koi API chahiye hi nahi. Neeche surface-dar-surface hisaab hai,
aur us ke baad wo 12 jin ke chhorne ki wajah likhi hai.

---

## Khulasa

| Surface | Screens | Chalti hain | Baqi |
|---|---:|---:|---:|
| **(auth)** | 2 | 2 | — |
| **(site)** | 17 | 17 | — *(11 static hain)* |
| **dashboard** | 10 | 10 | — |
| **extranet** | 60 | 50 | **10** |
| **admin** | 25 | 23 | **2** |
| **join** | 29 | 29 | — |

`__seedcheck` dev ka page hai, ginti me nahi.

---

## Module 14 — saved list (`dashboard/favorites`)

| Endpoint | Kya |
|---|---|
| `GET /favorites` | saved list, keyset paged |
| `PUT /favorites/:propertyId` | save — **idempotent** |
| `DELETE /favorites/:propertyId` | unsave |
| `POST /favorites/lookup` | ek page ke ids me se kaun se saved hain |

Primary key hi `(user_id, property_id)` hai, to "do dafa save" **mumkin hi nahi** — ye
baat service ke yaad rakhne par nahi, table ki shakl par khari hai (rule #96).

Save ke baad property suspend ho jaye to wo list me **rehti hai**, `available: false` ke
sath. Chupke se nikal dena list ko bila wajah chhota karta hai; bookable dikhana mehmaan
ko murda page par bhejta hai.

---

## Partner inbox (`extranet/inbox`, `inbox/communications`)

`GET /partner/messages` — ek conversation per row, nayi guftagu upar, aur wo ginti jo
property ne abhi kholi nahi.

Jawab dene ka raasta **wahi purana** hai (`/bookings/:id/messages`), jahan dono taraf
pehle se milti hain. Partner ko alag reply route dena usi table par doosra raasta banata,
aur do raaste is baat par ikhtelaf kar lete ke likhne ka haq kis ka hai.

Query ek hai — `DISTINCT ON` + unread count. Zaahir wala tareeqa (bookings ginno, phir
har booking ka aakhri message, phir har booking ki unread) N+1 hai jo theek us waqt slow
hota hai jab inbox kaam ka banta hai.

---

## Finance ke 6 screens — rule #97

`GET /partner/finance/{overview,revenue,commissions,transactions}` aur
`GET /admin/finance/{...}` — **ek hi implementation, scope hata kar** (wahi usool jo rule
#84 ne analytics ke liye tay kiya).

Sab se ahem cheez **teen lafz** hain:

```
gross       jo mehmaan ne diya
commission  jo platform ne kamaya
net         jo hotel ke paas raha
```

Prototype pehle aur teesre **dono** ko "revenue" kehta tha. Nateeja: ek screen doosri se
12% bara number dikhati hai, aur reconcile karne wale ke paas ye janne ka tareeqa nahi ke
jhoot kaunsi bol rahi hai. Test seedha isi par hai ke `gross - commission === net` — har
total par aur har bucket par.

**Basis booking ki tareekh hai, stay ki nahi** — analytics se ulta, jaan boojh kar.
Commission ek **booking** ki baat hai, aur wahi booking payout line aur invoice line
dono par naam se aati hai.

**Void commission kahin nahi ginti** (#76) — ledger ki line par `0`, asal raqam nishaan
ke sath nahi: partner wo deta hi nahi.

**Pending payout aur unpaid invoice kabhi jama nahi hote.** Ek platform partner ko deta
hai, doosra partner platform ko.

**Staff ko ye screen milti hi nahi** (#66) — analytics me kuch screens paise chhupa kar
bhi kaam ki rehti hain, finance **hai hi paisa**.

---

## `admin/properties`, `properties/[id]`, `clients/[id]`

| Endpoint | Kya |
|---|---|
| `GET /admin/listings` | har listing — malik, rooms aur photos ki ginti ke sath |
| `GET /admin/listings/:id` | poori tafseel, **har status ki photo** |
| `POST /admin/listings/:id/suspension` | market se hatana ya wapas laana |
| `GET /admin/partner-orgs/:orgId` | ek client: org + properties + log, **ek response me** |

Review queue ab isi list ka **filter** hai (`needsReview=true`) — ek hi cheez ki do
fehristein wo tareeqa hai jis me ek me koi status reh jata hai.

Suspend par **wajah lazmi**, audit me jati hai (#78). Delete kabhi nahi. Jo listing
suspend thi hi nahi, use "reinstate" karne se **inkaar** — us ka matlab hota andaza
lagana ke wapas kis haal me daalna hai, aur andaza wo listing shaya kar sakta tha jise
kisi ne manzoor nahi kiya.

**Ab approve bhi audit me jata hai**, sirf reject nahi.

---

## Module 15 — agreements (`extranet/account/contracts`) · rule #98

| Endpoint | Kya |
|---|---|
| `GET /partner/contracts` | jo sign ho chuke, **aur jo baqi hain** |
| `POST /partner/contracts/templates/:id/accept` | qubool karna — sirf org admin (#14) |
| `GET/POST /admin/contracts/templates` | platform version shaya karta hai |
| `POST /admin/contracts/:id/terminate` | khatam karna — wajah lazmi |

Do tables, aur farq hi asal baat hai: agar ek hota to har partner ke paas wahi MSA ka
text copy hota, aur **"kaun abhi tak version 1 par hai?"** ka jawab kabhi na milta — jo
legal ka pehla sawal hota hai.

**Dastkhat edit ho hi nahi sakti — database rokta hai.** Trigger har us UPDATE ko
`RAISE EXCEPTION` karta hai jo org, version, text, kaun, ya kab — in me se kisi ko chhue.
DB par azmaya:

```
lifecycle update  : ALLOWED (correct)
body rewrite      : REFUSED (correct)
signer rewrite    : REFUSED (correct)
backdate          : REFUSED (correct)
```

Test bhi seedha isi par hai: template ka text **DB me** badal ke dekha — jo sign hua tha
wo nahi hila.

---

## Listing score — do screens, ek hisaab (rule #99)

`GET /partner/listings/:id/score` aur `GET /admin/content` — **ek hi computation**.

Yahan frontend ke purane model me ek asli bug tha: jis listing par abhi koi review nahi,
use "Review Score = **0**" milta tha. Yaani har nayi property ko pehle din kaha jata tha
ke tumhara page kamzor hai — theek us cheez par jis par wo pehle din kuch kar hi nahi
sakti. Ab `applicable: false`, aur weights **dobara normalise** hote hain — warna
mukammal page bhi 80 par ruk jata aur "excellent" tak kabhi na pahunchta.

Platform ki list **sab se kamzor pehle**. Har tip me **ginti** hoti hai ("Add 5 more
photos"), sirf ye nahi ke kuch kam hai.

---

## `rates/copy-rates` — rule #100

`POST /partner/inventory/rates/copy`

Do range ki lambai **barabar hone ki zaroorat nahi**. Chhota source lambe target par
**dohrata** hai — kyunki is screen ka poora maqsad hi ek aam hafta poore season par lagana
hai.

**Do tarah ka "kuch nahi", dono ka amal alag:**

| Source ka din | Amal |
|---|---|
| **row hai hi nahi** | target ka din **waise ka waisa** rehta hai (#23 ka fallback bacha) |
| **row hai magar NULL** | target par likha jata hai, yaani saaf ho jata hai |

Source **aur** target dono rate plan alag alag check hote hain — sirf ek check karna wo
sooraakh hai jis se partner doosre ka rate plan **us se copy kar ke** parh leta.

---

## `rates/pricing-per-guest` — rule #101

`GET/PUT /partner/rate-plans/:id/occupancy-prices`

Is se pehle akela musafir aur chaar ka khandaan **ek hi daam** dete the.

Matrix har party size ka **poora price** rakhta hai (partner isi tarah sochta hai), magar
lagta **base occupancy se farq** ke tor par:

| | 2 mehmaan | 1 mehmaan |
|---|---|---|
| Matrix | $725 | $600 |
| June me calendar ne $900 kar diya | $900 | **$775** ✅ |
| Absolute seedha use hota to | $900 | $600 ❌ |

Yaani partner June ka rate barhata aur akela musafir **ab bhi May ka daam** de raha hota.

**Matrix me base occupancy ka daam na ho to poori matrix bekaar hai** — farq ke liye do
number chahiye — isi liye API us par inkaar karti hai.

**Jo level set hi nahi**, us par discount ghara nahi jata: us ka paisa dena jo us ne dene
ka kaha hi nahi.

---

## `boost/genius` aur `boost/long-stays` — engine pehle se maujood tha

Dono ko koi nayi machinery chahiye hi nahi thi:

- **Genius** = `channel: "genius"` — pehle se hai, aur session se aata hai (jhoot nahi
  bola ja sakta)
- **Long Stays** = `minStay` wala promotion — pehle se hai

Sirf do **marketing labels** kam the (`long_stay`, `genius`), jo `kind` me daal diye.
`kind` sirf categorisation hai (#16) — pricing use parhta hi nahi.

---

## Module 12 — registration wizard (29 screens) · rule #103

| Endpoint | Kya |
|---|---|
| `GET /join/registration` | jahan chhora tha wahan se — pehli dafa draft khud ban jata hai |
| `PATCH /join/registration` | ek screen ke jawab, `step` ke sath |
| `POST /join/registration/submit` | platform ko dena — **har kami ek sath** |
| `POST /join/registration/documents/upload-url` · `/documents` | verification files, presigned |
| `GET /admin/registrations` · `/:id` | platform ka queue |
| `POST /admin/registrations/:id/decision` | manzoor ya rad — **rad par wajah lazmi** |
| `POST /admin/registrations/documents/:id/review` | document ka faisla |

Steps 1–4 (account, password, verify) ke liye **kuch naya nahi bana** — wo signup aur
email verification hain, jo pehle se hain. Registration row step 5 se shuru hoti hai.

### Draft document kyun hai, asli rows kyun nahi

Asli rows likhte jana socha aur rad kiya:

1. **Wizard ki tarteeb tables ki shartоn se mel nahi khati.** Step 5 sirf qism chunta hai;
   naam step 6 par, rooms 14–19 par. Beech me likhne ka matlab har column nullable karna.
2. **Zyadatar registrations adhoori chhori jati hain** — asli rows `partner_orgs` aur
   `properties` ko khokhon se bhar dete jinhein har admin screen phir hamesha filter karti.

Blob paanchwan type system na ban jaye: **har write zod se guzarta hai**, aur vocabulary
doosre contracts se import hoti hai.

**Merge database me hota hai** (`data || patch`), JavaScript me nahi — warna do screens ek
sath save hon to baad wala pehle wale ke jawab chupke se mita deta.

**`currentStep` sirf aage barhta hai** (`GREATEST`) — peeche ja kar purani screen dekhna ye
nahi mita sakta ke wo kahan tak pahunche the.

### Approve = ek transaction, ya poora ya kuch nahi

Ek `POST` se banta hai: **org + membership + user ka role + property + amenities + rooms +
rate plans + payout account + contract acceptance.** Test seedha isi par hai ke rad karne
par **kuch bhi nahi banta** aur user `customer` hi rehta hai.

**Listing dobara review queue me nahi jati.** Platform abhi poora padh chuka. Ek hi cheez
do dafa review karna sirf ye sikhata hai ke parhna chhor do.

**Payout account hamesha `unverified`** — form me IBAN likhna us ka malik hone ka saboot
nahi.

**Purana amenity slug approval nahi torta** — draft maheenon purana ho sakta hai, aur
retire shuda slug warna transaction ke beech me foreign key torta, **org ban jane ke baad.**

### Teen divergence jo yahan pakdi gayin

**1. Property type — chauthi vocabulary divergence.**

```
wizard    : hotel resort guesthouse hostel apartment villa bnb motel
database  : hotel resort
```

Yaani jo partner "Villa" chunta, use **ikattees screens ke aakhir me** CHECK constraint
violation milta. Database ab aathon leta hai, aur `PROPERTY_TYPE_VALUES` par `satisfies`
lagi hai — nayi qism daal kar yahan na daalo to **compile hi nahi hota**.

**2. Cancellation — chaar naam jo kisi column me nahi.** Wizard `flexible/moderate/strict/
non-refundable` deta hai; rate plan structured policy rakhta hai (#1). Ab preset **policy
me badalta** hai (#102), aur mapping **ek-tarfa** hai: haath se bani policy ko "Moderate"
ka label lagana jhoot hota.

**3. `maxChildren` ka sifar.** Wizard sirf "kitne guests" poochta hai. Sifar ka matlab
hota "is kamre me bachay nahi aa sakte" — wo pabandi jo partner ne kabhi chuni hi nahi,
aur jis ka pata tab chalta jab koi khandaan book na kar pata.

---

## Do screens jinhein naye endpoint ki zaroorat thi hi nahi

**`extranet/analytics` (overview)** — `performance` (ADR/RevPAR/occupancy) + `sales`
(trend) se banti hai. Teesra endpoint metrics ki teesri tareef likhna hai.

**`extranet/promotions/simulate`** — hisaab client ka hai; server se sirf asli commission
rate chahiye tha, jo ab `GET /partner/finance/overview` par hai.

> **Ek jagah jahan main apna hi faisla ulat raha tha, aur test ne roka.**
> Maine `commissionRateBps` `GET /partner/org` par khol diya tha. Ek mojooda test toot
> gaya jis ka comment yehi keh raha tha ke **wo settings screen hai**, aur wahan aisa
> number jo edit na ho sake sirf "ye edit kyun nahi hota" ko dawat deta hai.
>
> Test sahi tha. Rate ab **finance overview** par hai — jo hai hi paisa ki screen, jis par
> role ka pehra pehle se hai (#66). Sath me `effectiveRateBps` bhi, kyunki akela wo bhi
> kaafi nahi: jis partner ki abhi koi booking nahi, use akela `effectiveRateBps` batata ke
> wo sab kuch rakhta hai.

---

## Do screens jin ke baare me meri apni sifarish ghalat thi

Maine kaha tha `compliance` ke liye document store banao aur `contacts` ke liye naya
table. **Frontend parh ke dono ghalat nikleen:**

**`account/compliance`** partner ke documents ke baare me hai hi nahi — wo **platform ka
apna** compliance posture hai: GDPR, PCI DSS, CCPA, WCAG 2.1, AML/KYC. Ye `/privacy`
jaisa **static page** hai. Koi backend nahi banta.

**`account/contacts`** team hi hai — phone aur job title ke sath. Naya table nahi chahiye
tha: `users.phone` pehle se tha, sirf `partner_members.job_title` kam tha. `GET
/partner/team` ab dono deta hai.

`job_title` **`role` se alag** hai jaan boojh kar: `role` teen me se ek hai aur ye tay
karta hai ke kaun kya chhoo sakta hai; `jobTitle` free text hai. "Revenue Manager" koi
permission nahi, aur night desk ko "the manager" keh kar koi nahi bulana chahta.

---

## Wo 12 screens — kya hua

| Screen | Faisla |
|---|---|
| `extranet/analytics/ranking` | **Ban gayi** — Module 16 |
| `extranet/analytics/demand` · `admin/analytics/demand` | **Ban gayin** — Module 16 |
| `extranet/boost` · `boost/preferred` | Ranking ban gayi; **paid visibility abhi nahi bikti** — pehle tarteeb, phir us ko bechna |
| `extranet/boost/room-differentiation` | **Hata di** — display ka masla tha, backend product nahi |
| `extranet/rates/country-rates` | **Hata di** — "kaunsa mulk" IP se aata hai, jo rule #68 ne mana kiya |
| `extranet/rates/mobile-rates` | **Chalti hai** — mechanism pehle se tha (neeche) |
| `extranet/property/messaging` | **Ban gayi** — rule #105 |
| `extranet/property/vat-tax` | **Screen badal di** — ab sach kehti hai, form nahi rahi |
| `admin/settings` | **Ban gayi, chhoti kar ke** — rule #106 |
| `admin/billing` | **Screen badal di** — subscriptions se commission par |
| `extranet/account/connectivity` | **Abhi nahi** — neeche |

### `mobile-rates` par mera pichla jawab ghalat tha

Maine likha tha ke ye "khuli chhoot" hai kyunki client keh sakta hai "main mobile hoon".
**Mechanism pehle se maujood tha:** `isMobile` **server par** user-agent aur
`sec-ch-ua-mobile` client hint se banta hai, request body se nahi. Aur **rule #35 UA
spoofing ko saaf saaf qubool karti hai** — "koi jhoota enforcement wada nahi".

Yaani ye bilkul `boost/genius` jaisa hai: ek promotion `channel: "mobile"` par.

### `account/connectivity` — akela baqi, aur jaan boojh kar

Channel manager integration: Booking.com aur Expedia se rates aur inventory ka do-tarfa
sync. Ye ek screen ka kaam nahi — **apna poora module** hai:

- har OTA ka apna protocol aur apni certification
- **do taraf se** inventory ka takraav — jo overbooking ka sab se bara sabab hai
- mapping: un ka room type kaun sa hai, hamara kaun sa
- reconciliation jab dono taraf ek hi raat alag alag kehti ho

Rule #29 ka `CHECK (booked_units <= sellable_units)` hamari taraf ki zamanat hai. Doosri
taraf koi aur likh raha hai, aur us ka apna nizaam chahiye.

---

## Module 16 — ranking aur demand (rule #104)

| Endpoint | Kya |
|---|---|
| `GET /partner/analytics/ranking/:propertyId` | main kahan hoon, aur **kyun** |
| `GET /partner/analytics/demand` | mere sheher me kitni talash |
| `GET /admin/analytics/demand` | poora naqsha, khaali nateejon samet |

Aur sab se ahem: **`recommended` sort ab asal me ranking par chalti hai**, aur wo default
hai. Pehle wo khamoshi se `price_asc` par gir jata tha — yaani marketplace ki default
tarteeb "sab se sasta" thi jabke label kuch aur keh raha tha.

**Paanch factor**: listing quality (25) · guest rating (25) · click-through (20) · price vs
market (15) · rooms left to sell (15). Har ek wo hai jo platform pehle se naapta hai;
**kuch bhi khareeda nahi ja sakta.**

**Kam saboot par bharosa nahi.** 3 impressions me se 1 click = 33%, jo 400 par 20% wale
ko kuchal deta — shor par. Dono rate market ke average ki taraf khinche jate hain, us
hisaab se ke saboot kitna kam hai. Test seedha isi par hai.

**Score raat 2 baje banta hai**, har request par nahi: score par sort karne ka matlab hai
paging se pehle har match ko rank karna.

---

## Rule #105 — har message ka apna switch

`GET/PATCH /notifications/preferences`. Sparse table: jis row ka wujood nahi, us ka matlab
"jo class kehti hai wahi".

**`essential` ka switch hai hi nahi** (#56), aur API us par **inkaar** karti hai —
nazarandaz nahi. Chupke se qubool kar lena wo tareeqa hai jis se koi ye samajh kar chala
jata hai ke us ne kuch band kar diya.

Test seedha isi par hai ke switch ke baad email **waqai** nahi jati.

---

## Rule #106 — settings me sirf wo jo kuch karta ho

Screen pandrah cheezein deti thi; **do** kuch karti thin. `supportEmail` aur
`defaultCommissionRateBps` bache. Currency **read-only**.

Hata diye: platform name, language, timezone (deploy config), trial days aur free-plan
limit (aisi product ki tafseel jo maujood nahi), aur integrations — jin me **Supabase**
bhi tha, jo stack me hai hi nahi.

---

## `admin/billing` — subscriptions se commission par

Screen "Monthly Recurring Revenue" aur per-client subscriptions dikhati thi. **Kuch bhi
asli nahi tha**: koi amount charge nahi hota tha, koi interval schedule nahi hota tha, aur
MRR un numbers ka jama tha jo kisi invoice ne kabhi paida nahi kiye.

`PlanTier` (Starter/Professional/Enterprise) ki jagah ab **`SettlementMode`**
(`Deduct`/`Invoice`) hai — wahi model jo aap ne batayaa tha. Compiler ne saat jagah pakdi
jahan `plan` parha ja raha tha.

---

## Ek aur cheez jo raaste me mili

**15 admin pages ka title do dafa lag raha tha.** Root layout ka template `%s · Stayora`
hai aur har admin page apne title me `· Stayora Admin` bhi likhta tha — nateeja
"Commission & Billing · Stayora Admin · Stayora". Yehi bug pehle 26 pages par theek hua
tha; admin surface reh gaya tha.

---

## Jo cheez theek hai## Jo cheez theek hai — aur jaanch kar dekhi

**Har controller ka guard sahi hai.** Sirf paanch route public hain, aur har ek ki wajah
likhi hai:

```
GET  /properties, /properties/:slug, /properties/:slug/reviews   catalogue
GET  /amenities                                                  search filter isi se
POST /search-events/:id/click                                    click tracking
POST /support/tickets                                            "main sign in nahi kar pa raha"
POST /payments/webhook                                           signature se mehfooz
```

lint saaf · build saaf · dono workspace.
