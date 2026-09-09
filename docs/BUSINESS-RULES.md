# Stayora — Business Rules (locked)

**Date:** 2026-08-18
**Input:** `FRONTEND-AUDIT.md` §4 (8) + `USE-CASES.md` (3) + architecture pass (2) + type map (3) + domain pre-flight (7) + availability design (3) + rate-plan pass (2) + Module 1 (2) + Module 2 (2) + Module 3 (2) + Module 4 (2) + Module 5 (2) + Module 6 (2)
**Kaise:** `ARCHITECTURE.md` — engineering standards aur har module ka security gate
**Status:** **sab 40 tay ho gaye — koi khula sawal nahi.** Ye document backend schema aur API contract ka **source of truth** hai.

---

## Faisle — ek nazar me

| # | Sawal | Faisla |
|---|---|---|
| 1 | Cancellation policy ki shakal | `free_until` + `charge` + `charge_value` (join wizard wala + `percent`) |
| ~~2~~ | ~~Percent tax kis par~~ | **Mansookh — rule #11 ne replace kiya (tax bilkul khatam)** |
| 3 | `mobile` / `genius` channels | **Implement** honge |
| 4 | Do promotions active hon to | **Best single wins**, asli saved amount se |
| 5 | `minStay` ka level | **Per-date, per-room** (`rate_calendar`) |
| 6 | Booking status machine | `checked_out` merge → `completed` · **`no_show` add** |
| 7 | Strikethrough | **Sab** discount types par |
| 8 | Ticket references | Backend **DB sequence** |
| 9 | Commission 15% kis base par | **Total** par · **sirf `completed` bookings** par banti hai |
| 10 | `ValueAdd` units | **`per person per night` add** hoga (chautha unit) |
| 11 | Tax | **Poora khatam** — type, logic, UI sab |
| 12 | Currency | **Sirf USD** — koi multi-currency nahi (v1) |
| 13 | Quote ki price kitni der valid | **Signed token, 15 minute** |
| 14 | Partner staff roles | **3-role permission model** (`admin`/`manager`/`staff`) + property scoping |
| 15 | `Property.stars` | **Add** — official classification, review score se alag |
| 16 | `Promotion.kind` | **Rakhein** — sirf reporting, pricing par asar nahi |
| 17 | Booking modify par price delta | **Charge/refund ho**, aur **current rates** par |
| 18 | Cancel par add-ons | **Poore refund** — penalty sirf room subtotal par |
| 19 | `free_night` kaunsi raat | **Sabse sasti** raat free |
| 20 | Commission rate | **Per partner-org**, plan tier se default, booking par snapshot |
| 21 | `Promotion.roomTypes` | **`roomIds[]` structured** (khali = saare rooms) |
| 22 | `Promotion.minStay` | **Filter kare** — `nights >= promo.minStay` |
| 23 | `BookingAddOn.qty` | **Rakhein** — `amount = resolvedPrice × qty` |
| 24 | Confirm par kamra nikal jaye | **409 `just_sold_out`** + usi property ke doosre rooms + guest ka data mehfooz |
| 25 | Deliberate overbooking | **Abhi nahi**, magar `sellable_units` column se jagah chhori — kal data badlega, migration nahi |
| 26 | Min-stay | **Do rules**: `min_stay` (arrival/MinLOS) **aur** `min_stay_through` (har raat) |
| 27 | Rate plans | **Shape abhi** — cancellation + price `RatePlan` par, har room ka ek default plan. UI baad me |
| 28 | Occupancy | **`adults` + `children` alag** — ek `guests` number khatam |
| 29 | Public site par guest checkout | **Nahi** — account lazmi. `customerId: null` sirf walk-in aur OTA ke liye |
| 30 | Email verification | **Booking se pehle nahi** · apni booking hamesha dikhe · lazmi: **email change · password reset · join wizard** |
| 31 | Amenities | **Controlled list**, platform-managed (slug · label · category · icon) — free text nahi |
| 32 | Property-level close | **Bulk action** — sab rooms ki inventory rows band ho. Koi alag table nahi |
| 33 | Restrictions | **Poora set**: CTA · CTD · `max_stay` · `min_advance_hours` · property par `same_day_cutoff` |
| 34 | Booking horizon | **18 mahine** platform-wide — availability aur calendar API ki date range bhi isi se bound |
| 35 | `mobile` channel spoofing | **Qabool** — UA se derive, koi jhoota enforcement wada nahi. `app` channel nahi banega |
| 36 | Quote token vs paused promotion | **Token ki price honour hogi** — promotion server ke signed token me hai, client uspar asar nahi daal sakta |
| 37 | Property khud cancel kare | **Poora refund**, policy se qat-e-nazar — guest ka qusoor nahi |
| 38 | Guest khud modify kare | **Haan** — dates + occupancy, check-in se pehle. Wahi availability gate, price delta rule #17 se |
| 39 | Review eligibility | Sirf **`completed`** booking · ek booking par ek · **90 din** ki window |
| 40 | Review moderation | **Foran publish** — verified stay hi kaafi signal hai. Partner flag kare → public se hate → admin faisla |
| 41 | Review withdraw | Guest apna review **wapas le sakta hai** (`withdrawn`) — public list aur rating se foran hat jata hai. **Dobara nahi likh sakta**: unique index qaim rehta hai, warna "hata ke achha likho" ek dabao ka zariya ban jata. Admin `withdrawn` ko wapas publish nahi kar sakta |
| 42 | Payment mode | Rate plan tay karta hai: `prepay` (abhi capture) ya `guarantee` (card save, capture nahi). **Card dono me lazmi** — bila card koi booking nahi. `non_refundable` rate par sirf `prepay`, DB CHECK se |
| 43 | Merchant of record | **Platform**, dono modes me. Provider ek port ke peeche — domain sirf `authorize`/`capture`/`refund` jaanta hai, provider ka naam kabhi nahi. Entity Pakistan → v1 adapter Safepay/PayFast; test me fake adapter |
| 44 | Booking ab `pending` banti hai | Inventory usi lamhe hold, `hold_expires_at` = +15 min. `confirmed` **sirf** tab jab provider par capture (prepay) ya card authorize+save (guarantee) kamyab ho. Hold expire → inventory release, booking `cancelled` |
| 45 | Payment call transaction se bahar | Koi provider HTTP call DB transaction ke andar nahi (§4). Sach **webhook** se aata hai: signature verify lazmi + idempotent — provider retry karta hai |
| 46 | Refund khud-ba-khud | `refundFor()` se, partner ki manzoori ka intezar nahi. Processor fee v1 me platform bardasht karta hai |
| 47 | No-show ki qeemat | Rate plan **apni alag no-show shart** rakh sakta hai (`no_show_charge` + value). Na rakhe to arrival ke waqt ki cancellation jaisa. Yeh "48h tak free cancel, magar na aaye to poora" likhne deta hai — jo pehle mumkin hi nahi tha. Shart **guest ko booking se pehle** `cancellationText` me dikhti hai, aur booking par **snapshot** hoti hai |
| 48 | Payout cycle | **Har 15 din** — mahine ki **1 aur 16** tareekh. Platform merchant of record hai, isliye paisa hum bhejte hain |
| 49 | Payout hold | Booking **checkout ke 7 din baad** payable banti hai (aur `commissionStatus = earned` ho). Late shikayat aur chargeback ki pehli lehar isi window me aati hai — paisa jane ke baad wapas maangna amalan nahi hota |
| 50 | Minimum payout | **$100**. Isse kam ho to balance **agle cycle me carry** — kabhi zaya nahi hota, bas transfer tab jab fee ke qabil ho |
| 51 | Modify par commission | **Naye total par dobara snapshot**, magar **rate purana hi** (rule #20). Guest upgrade kare to platform ko bhi hissa milta hai; org ka rate baad me badle to purani booking par asar nahi |
| 52 | Guarantee par paisa ulta behta hai | `prepay` me platform ne wasool kiya → property ko **net bhejta** hai. `guarantee` me guest ne property ko diya → property platform ko **commission deti** hai. Isliye ek cycle ka net **manfi** ho sakta hai — us soorat me wo payout nahi, **invoice** hai |
| 53 | `genius` tier kaise mile | **2 mukammal stays** par khud ba khud (booking par nahi — cancel karne walon ko kuch nahi milta). Ek dafa mil jaye to **hamesha rehta** (v1) — qeemat wapas barhna guest ke liye be-wajah hairani hai. Sirf `standard → genius`, kabhi ulta nahi |
| 54 | Password reset | Token **hashed** store hota hai (sessions ki tarah), **1 ghanta** zinda, **ek hi baar** chalta hai, aur nayi darkhwast purani ko batil kar deti hai. Jawab hamesha ek — pata registered ho ya na ho. **Reset par sab sessions batil**; password *change* par sirf **doosre** — jis ne badla wo signed in rehta hai |
| 55 | Email provider | **Twilio SendGrid**, ek port ke peeche. Templates **repo me**, SendGrid par nahi — booking confirmation me cancellation ka jumla hota hai jo rule #1 ke mutabiq generate hota hai; hosted template me koi use badal deta aur refund engine amal na karta |
| 56 | Kaun si email band ho sakti hai | Teen darje: **`essential`** (booking confirm/cancel, refund, password reset, verification) **kabhi band nahi** — apni raseed band nahi ki ja sakti · **`useful`** (reminder, review request, partner alerts) band ho sakti hain · **`marketing`** band ho sakti hai aur **shuru se OFF** jab tak guest khud na chalu kare |
| 57 | Bhejna kaam nahi rokta | Notification row **usi transaction me** likhi jati hai jis me event hua — `transition()` aur `cancelWithRelease()` ka `within` hook isi ke liye hai. Bhejna alag worker karta hai retries ke sath (rule #45 ka wahi asool). SendGrid down ho to booking phir bhi confirm hoti hai |
| 58 | Signup ab enumeration-safe | Signup hamesha **ek hi jawab**: "apna email dekhein". Sach sirf email ke andar — mojooda account walay ko "aapka account pehle se hai" wali email jati hai. Module 1 ka accepted risk yahan band hota hai |
| 59 | Org kaun banata hai | Abhi **platform admin** (Module 12 ka join wizard aane tak). Org ke apne khane — naam, raabta, mulk — org admin badal sakta hai; **`commission_rate_bps`, `plan_tier`, `status` sirf platform ke** hain, partner unhe chhoo bhi nahi sakta |
| 60 | Team invite | **Email par**, chahe us pate ka account ho ya na ho — ek hi raasta, is liye admin ko kabhi pata nahi chalta ke uske colleague ka account pehle se tha. Invite **hashed token**, **7 din**, **ek baar**. Qubool karne ke liye usi email se **signed in** hona zaroori hai — warna koi bhi kisi aur ka invite le leta |
| 61 | Aakhri admin | Org ka **aakhri active admin** na hataya ja sakta hai, na demote, na suspend. Warna org be-waris ho jata hai: koi payout account nahi badal sakta, koi team nahi jor sakta, aur platform admin ke baghair raasta nahi bachta |
| 62 | Analytics ka date basis | Do alag bunyaadein, kyunki sawal do hain. **Occupancy, ADR, RevPAR — stay date par** (jis raat kamra bika, us raat me ginti hai): teen raat ki booking jo 30 March se 2 April chali, do raatein March ki hain aur ek April ki. **Sales trend, pace, book-window — booking date par** (jis din booking hui). Ek hi bunyaad par sab kuch daalna dono sawalon ke jawab ghalat kar deta hai |
| 63 | Kaun si booking ginti hai | `pending` **kabhi nahi** — wo 15 minute ka hold hai, revenue nahi. `confirmed` + `checked_in` + `completed` = **room-nights aur ADR/occupancy/RevPAR**. `cancelled` aur `no_show` par jo penalty wasool hui wo **revenue hai magar room-night nahi** — is liye kul revenue me shamil, ADR aur occupancy me bilkul nahi (koi kamra bika hi nahi) |
| 64 | ADR me kya hai, kya nahi | Sirf **kamre ka kiraya** — `pricing.nightlyRates`, promotion ki chhoot **raaton par batt kar** kam ki hui. Add-ons (breakfast, airport pickup) ADR se **bahar** — wo kamre ka daam nahi, aur andar daalne se hotel ko apna rate asal se ooncha nazar aata hai. Add-ons kul revenue me alag line hain |
| 65 | Comparables gumnaam hain | Muqabla sirf **market average** ke sath — kabhi kisi property ka naam le kar nahi. Aur **5 se kam properties** ho to number dikhta hi nahi: 2 hotels ke sheher me "market average" se doosre ka asal rate hisaab kar lena bachon ka khel hai. Ye partner ka commercial data hai jo hum ne booking chalane ke liye liya tha, muqabla karane ke liye nahi |
| 66 | Analytics par role | **Revenue, ADR, RevPAR, commission — `admin` aur `manager`**. `staff` ko operational numbers milte hain (bookings, occupancy, cancellations, book-window) kyunki kaam ke liye yehi chahiye. Ek front-desk account chori hone par poora commercial data nahi jata |
| 67 | Search events abhi se | Demand aur Ranking screens baad me banengi, magar **recording aaj se** — analytics peeche se nahi bharti, aur na likhne ka matlab hai ke jis din screen banegi us din bhi khali hogi. Likhna **fire-and-forget** hai: event insert nakaam ho to search phir bhi chalti hai (rule #57 ka wahi asool — dekhna kaam nahi rokta) |
| 68 | Search event me guest nahi | Event me `session_id` (hashed) jata hai, `user_id` sirf jab guest signed in ho. **Koi IP nahi, koi user-agent nahi.** Demand ka sawal "kis sheher ki talab kitni hai" hai — us ka jawab kisi shakhs ko pehchane baghair milta hai, aur jo jama nahi kiya wo leak bhi nahi ho sakta |
| 69 | Property kaun banata hai | **Partner khud**, apne org ke andar, aur wo `draft` me paida hoti hai. `active` sirf **platform admin** kar sakta hai. Ab tak property banane ka koi raasta hi nahi tha — sirf seed ya seedha INSERT |
| 70 | Review me bhejne ki shart | Kam se kam **1 room + 1 active rate plan + 5 photos + description**. Kam ho to submit hi nahi hota, aur jawab me batata hai kya kam hai. Warna admin ka waqt adhoori listings par jata hai aur partner ko pata bhi nahi chalta kya karna hai |
| 71 | Live listing par tabdeeli | **Ahem khane** (naam, pata, sheher, mulk, stars, photos) dobara manzoori mangte hain — magar listing **live rehti hai aur purani manzoor shuda soorat dikhati hai**. Nayi qeemat `pending_changes` me alag padi rehti hai jab tak admin manzoor na kare. Baqi (rates, availability, room ka naam) foran lagte hain |
| 72 | Listing offline nahi hoti | Live listing edit par `status` **`active` hi rehta hai** — `pending_review` kar dena use search se gayab kar deta (search `status = 'active'` filter karti hai), yaani ek typo theek karne ki saza mehmaan bhugatte. Admin ki queue = `pending_review` **ya** `pending_changes IS NOT NULL` |
| 73 | Photo upload | **Seedha storage par presigned URL se** — file kabhi API se nahi guzarti, aur URL se import kabhi nahi (API7/SSRF). **5 se 50 photos**, har ek **5MB** tak, sirf `jpeg`/`png`/`webp`. Nayi photo `pending` hoti hai; public sirf `approved` dekhta hai |
| 74 | Amenity vocabulary platform ki hai | Partner **sirf mojooda fehrist me se chunta hai**, apni amenity ijaad nahi kar sakta (rule #31). Warna "WiFi", "Free WiFi" aur "Wi-Fi" teen alag filter ban jate hain jo har ek aadha catalogue miss karte hain. Vocabulary **platform admin** rakhta hai |
| 75 | Retire karna, delete karna nahi | `rooms`, `rate_plans`, `promotions` `status` se archive hote hain aur `value_adds` `active = false` se. **Delete kabhi nahi** — purani bookings in par lagi hui hain, aur ek hataya hua room type purani reservation ko be-naam kar deta |
| 76 | Admin refund policy se bahar | Admin goodwill refund kar sakta hai jo `refundFor()` se **zyada** ho. Us soorat me platform **apna commission `void` kar deta hai** — faisla platform ka hai to qeemat bhi us ki. Warna ek click se property ka paisa jata hai jis me us ka koi qusoor nahi, aur use pata bhi nahi chalta. Refund **kabhi** us se zyada nahi jo asal me wasool hua |
| 77 | Audit log | Har wo admin amal jo **paisa, rasai ya haalat** badalta hai — refund, force status, role change, suspend, listing ka faisla, commission rate — `audit_log` me likha jata hai: kaun, kab, kis par, kya, aur kyun. **Append-only**: koi UPDATE nahi, koi DELETE nahi. Ek audit log jo badla ja sakay audit log nahi hai |
| 78 | Wajah lazmi hai | Refund, force transition aur suspend **bina wajah likhe** nahi hotay. Jo amal wapas nahi liya ja sakta us ke sath ye sawal hamesha aata hai ke "ye kyun kiya gaya" — aur agar us waqt na likha jaye to jawab kabhi nahi milta |
| 79 | User hataya nahi jata | Admin role badal sakta hai aur account **suspend** kar sakta hai, **delete kabhi nahi**. Purani bookings, reviews aur payouts us user par lage hue hain; use mitana un sab ko be-naam kar deta hai. Suspended user sign in nahi kar sakta, magar us ka record salamat rehta hai |
| 80 | Admin guest ka kya dekh sakta hai | Naam, email, phone, mulk, us ki bookings aur reviews — kyunki shikayat par yehi chahiye hota hai. **Password hash kabhi nahi** (alag table me hai, isi liye), aur card ka koi hissa nahi (wo kabhi hamare paas aaya hi nahi — rule #43). Guest ki profile khulna khud ek audit line hai |
| 81 | Aakhri admin platform par bhi | Platform ka **aakhri active admin** na demote ho sakta hai na suspend — bilkul wesay hi jaise org ka aakhri admin (rule #61). Warna poora platform be-waris ho jata hai aur wapsi ka koi raasta nahi bachta, kyunki upar koi nahi |
| 82 | Platform ki revenue **commission** hai | Guest ka poora paisa (GMV) platform ki aamdani **nahi** hai — us ka bara hissa property ka hai. Admin screens par "Revenue" ka matlab **commission** hoga, aur GMV alag line par "gross booking value" ke naam se. Warna platform apne partner ka paisa apni aamdani ke tor par gin raha hota hai, aur har number — growth, margin, take rate — jhoot ban jata hai |
| 83 | Take rate | `commission ÷ GMV`, us **hi arse** ka. Ye woh ek number hai jo batata hai platform apne kaam ka kitna le raha hai; commission ko akela dekhna sirf ye batata hai ke bookings barhi ya kam hui |
| 84 | Admin analytics ka scope | Wahi engine jo partner chalata hai, bas **scope hata kar** (rule #66 ka role wala hissa admin par laagu nahi — admin ko sab dikhta hai). Doosri implementation likhna do jagah ADR ki tareef rakh dena hai, aur wo do jagah kabhi ek jaisi nahi rehtin |
| 85 | Bina account ke ticket | Khul sakta hai, magar **alag darje ka**: koi booking us par nahi dikhti, koi account data us se juda nahi, jawab usi pate par jata hai jo diya gaya. Wajah: support ki sab se aam darkhwast **"sign in nahi ho raha"** hai, aur login maangne wala help center usi shakhs ko rok deta hai jo sab se zyada mohtaj hai |
| 86 | Anonymous ticket kab judta hai | Jis din us **pate ka malik khud sign in karta hai** — tab malik ne sabit kiya ke pata us ka hai. Ticket khud ba khud us ke account se jud jata hai. Support kabhi haath se nahi jorta: "ye ticket us bande ka hai" kehna theek wahi cheez hai jo social engineering maangti hai |
| 87 | Support ke do sameen, ek table | Guest↔platform aur partner↔platform ek hi `support_threads` me, `audience` column se. Mechanics bilkul ek jaisi hain — thread, messages, status, assignment, resolution — aur doosri copy likhna wahi hai jahan wo sarti hai. Farq **scope** me hai, dhaanche me nahi |
| 88 | Partner ka thread guest ko kabhi nahi | Partner ke thread me commission, payout aur contract ki baat hoti hai. Wo sirf **us org ke members** aur **platform** ko dikhta hai. `audience` sirf ek label nahi — har query ka scope usi se banta hai |
| 89 | Guest↔property alag hai | Wo support **hai hi nahi**: ek booking ke bare me hai, platform us me shareek nahi, property jawab deti hai, aur koi "resolved" nahi hota. Us me category, priority, assignee aur resolution hote hi nahi — milane ka matlab hai har support query ko booking messages nikalna yaad rakhna paray |
| 90 | Bheja hua paighaam badalta nahi | Na edit, na delete — audit log ki tarah (rule #77). Support ki guftagu jhagre me saboot hoti hai, aur jo saboot baad me badla ja sakay wo saboot nahi. Galti ka jawab **agla paighaam** hai, purane ko mitana nahi |
| 91 | Commission wasool karne ke do tareeqe | Commission **wahi** hai, sirf lene ka waqt alag. `deduct` — har booking par pehle hi rok li jati hai, hotel ko net jata hai. `invoice` — hotel ko poora paisa, aur mahine ke baad platform bill bhejta hai. Ye **subscription nahi** — koi maasik fees nahi, sirf wahi commission der se |
| 92 | `invoice` sirf platform deta hai | Naya org hamesha `deduct` par shuru hota hai. `invoice` par jane ka faisla **sirf platform admin** ka hai, aur wo **audit me** jata hai (#77). Wajah saaf hai: prepay me paisa hamare paas aata hai, aur invoice ka matlab hai hum poora paisa bhej kar baad me hissa maangein — hotel na de to hum de chuke aur maang rahe hain. `deduct` me ye khatra hai hi nahi, kyunki hum wo paisa dete hi nahi jo hamara hai |
| 93 | Guarantee par kya hota hai | `deduct` par commission **phir bhi kati** jati hai — us booking ki line **manfi** ho jati hai (rule #52), aur partner ki usi cycle ki **prepay bookings us ko poora kar deti hain**. Sirf wo cycle jo khud ko poora na kar sake, invoice banta hai. `invoice` org par kuch nahi kata — poora paisa jata hai aur mahine ke baad bill hota hai |
| 94 | Invoice ka cycle payout se alag hai | Payout **har 15 din** (1 aur 16, rule #48), invoice **mahine ki 1 tareekh** ko pichle poore mahine ka. Paisa dena aur paisa maangna ek hi din hona zaroori nahi, aur maasik bill wo cheez hai jo hisaab-daan asal me parhta hai |
| 95 | Invoice na di to | Muqarrara din guzarne par org **khud ba khud `deduct` par wapas** — nayi bookings se commission phir katna shuru — aur us ka **payout ruka** rehta hai jab tak bakaya poora na ho. **Listing band nahi hoti:** mehmaan ne kuch nahi kiya, aur us ki booking rokna hotel ko saza dene ke bajaye guest ko saza dena hai |

---

## 1. Cancellation policy

Aaj code me **teen** shaklein hain — ab ek hogi.

| Kahan | Ab kya hota hai | Ab kya hoga |
|---|---|---|
| `join/cancellation` | `cancelFreeUntil` + `cancelCharge` collect hota hai, kabhi use nahi hota | ✅ **yehi canonical shape** |
| `Hotel.policies.cancellation` | free-text prose, guest ko dikhta hai | structured fields se **auto-generate** hoga |
| `refundFor()` | hardcoded 48h / 50% | structured policy **padhega** |

### Shape

```
cancellation_policy per property (aage chal kar per rate-plan):
  free_until    — kab tak free cancel: "6pm-arrival" | "24h" | "48h" | "7d" | "14d" | "non-refundable"
  charge        — deadline ke baad kya charge: "first-night" | "percent" | "full"
  charge_value  — sirf charge = "percent" ke liye: 1–100 (jaise 50)
```

### Rules

- Deadline se **pehle** cancel → 100% refund.
- Deadline ke **baad** cancel:
  - `charge = "first-night"` → refund = `total − ratePerNight`, floor 0
  - `charge = "percent"` → refund = `total × (100 − charge_value) / 100`
  - `charge = "full"` → refund = 0
- `free_until = "non-refundable"` → hamesha refund 0.
- Guest ko dikhne wala text **generate** hoga, store nahi hoga — isi liye display aur enforcement
  kabhi diverge nahi kar sakte (jo abhi ka asal masla tha).

> **`percent` kyun add hua:** join wizard sirf `first-night | full` collect karta hai, lekin maujooda
> platform policy 50% charge karti hai — aur woh in dono se express nahi hoti. `first-night` sirf
> 2-raat ke stay par ~50% banta hai; 10-raat ke stay par woh 10% reh jata hai, yani partner ka
> revenue protection khatam. Isliye teesra option.
>
> **Migration:** sab maujooda hotels → `free_until: "48h"`, `charge: "percent"`, `charge_value: 50`.
> Isse aaj ka behaviour bilkul waisa ka waisa rehta hai. Join wizard ke step me `percent` ka
> option add karna hoga.

---

## 2. Tax — ~~mansookh~~

Ye rule pehle "room + add-ons, discount ke baad" tay hua tha. **Rule #11 ne isay mansookh kar
diya** — product me tax hai hi nahi. Tafseel §11 me.

---

## 3. Promotion channels

`Promotion.channel` ab asal me kaam karega.

| Channel | Kab apply hoga |
|---|---|
| `all` | hamesha |
| `mobile` | request mobile device se ho |
| `genius` | signed-in user ka membership tier qualify kare |

Backend ko har pricing request ke saath do cheezein chahiye hongi:
- **request channel** — user-agent / client hint se derive hoga, client se trust nahi karenge
- **user tier** — session se, guest checkout me `null`

Isse `/extranet/boost/genius` aur `/extranet/rates/mobile-rates` (abhi dono static hain) asli ho sakenge.

---

## 4. Ek se zyada promotion

**Stack nahi hongi. Best single jeetegi.**

```
applicable = promotions jahan status=active
             AND channel guest ke context se match kare
             AND aaj startDate…endDate ke andar ho
             AND hotelIds me ye hotel ho

winner = applicable me se woh jiska discountAmount(promo, roomSubtotal, nights, ratePerNight)
         sabse zyada ho
```

Ye maujooda khaam ranking (`percent → value×10`, `amount → value`) ko **replace** karta hai — jismein
5% discount aur $50-off barabar the, chahe stay $200 ka ho ya $5000 ka.

Barabar ho jayen to zyada `percent` wali jeetegi (lambe stays par behtar).

---

## 5. minStay — per-date, per-room

`Availability.minStay` (property-level single number) khatam. Ab `rate_calendar` me:

```
rate_calendar (room_id, date, rate, is_closed,
               min_stay, min_stay_through,          ← rule #26
               booked_units, total_units, sellable_units)   ← rule #25
```

- Har room ki har date ka apna min-stay.
- **Do alag rules (rule #26):**
  - `min_stay` — **arrival** par lagta hai (MinLOS). Check-in wali date ka rule.
  - `min_stay_through` — stay ki **har raat** par lagta hai.
- Weekend/season rules isi se ban jayenge.

> **`min_stay_through` kyun chahiye tha:** sirf arrival wala rule bypass ho jata hai. Sarah
> weekend (Fri–Sat) par 3-raat ka rule lagayen, magar Thursday par 1 raat ka — guest Thursday se
> enter ho kar Fri tak 2 raat le lega. Arrival Thursday hai, uska rule poora hai, booking ban
> jati hai — aur weekend ka rule bilkul qanooni tareeqe se bypass ho gaya.
- `/extranet/rates/restrictions` (abhi static, `RestrictionRule.value` free-text string hai) isi ke
  upar asli ban jayega.

> **Type mismatch jo theek hoga:** `Availability.minStay` abhi **number** hai, extranet types me
> `minStay` **string** hai. Canonical: integer.

---

## 6. Booking state machine

### Statuses (6)

`pending` · `confirmed` · `checked_in` · `completed` · `no_show` · `cancelled`

**Tabdeeliyan:**
- `checked_out` **hata diya gaya** — `completed` me merge. (Dono ka behaviour bilkul same tha; review
  dono par khulta tha, aur `completed` ko koi code path set hi nahi karta tha.)
- `no_show` **naya** hai.

### Allowed transitions

```
pending    → confirmed        payment capture ho gaya / partner ne accept kiya
pending    → cancelled        guest ya partner

confirmed  → checked_in       partner, checkIn date par ya baad me
confirmed  → no_show          partner, checkIn date guzar jane ke baad
confirmed  → cancelled        guest ya partner

checked_in → completed        partner, checkOut date par ya baad me

completed  → (terminal)
cancelled  → (terminal)
no_show    → (terminal)
```

Koi bhi doosri transition **reject** hogi. Abhi `setBookingStatus` par zero guards hain — cancelled
booking wapas confirmed ho sakti hai, `checked_out` `checked_in` se pehle set ho sakta hai.

### Kaun kya kar sakta hai

| Transition | Guest | Partner | Admin |
|---|---|---|---|
| `→ cancelled` (pre-arrival) | ✅ apni booking | ✅ | ✅ |
| `→ confirmed` | ❌ | ✅ | ✅ |
| `→ checked_in` / `→ completed` | ❌ | ✅ | ✅ |
| `→ no_show` | ❌ | ✅ | ✅ |

Admin har transition force kar sakta hai, lekin **audit log** ke saath.

### `pending` ka matlab

Abhi koi code path `pending` banata hi nahi — `createBooking` hamesha `confirmed` deta hai, aur
`pending` sirf seed data me hai. Backend me iska matlab tay:

> `pending` = booking bani hai lekin **payment capture nahi hui** (card 3DS pending / declined
> retry), ya OTA se aayi hai aur abhi sync confirm nahi hui.

Card payment turant clear ho to seedha `confirmed`.

### Inventory kaun rokta hai

| Status | Inventory rokta hai? |
|---|---|
| `pending` | ✅ haan — warna payment ke doran room bik jayega |
| `confirmed` | ✅ |
| `checked_in` | ✅ |
| `no_show` | ✅ us raat tak, phir release |
| `completed` | — (dates guzar chukin) |
| `cancelled` | ❌ release |

`pending` ke liye ek **hold expiry** chahiye hogi (jaise 15 minute), warna adhoore checkouts
inventory rok kar baithe rahenge.

---

## 7. Strikethrough

`originalPrice()` ab sab discount types par kaam karega.

```
purana:  sirf percent — hotel.pricePerNight / (1 − value/100)   ← reverse-engineered
naya:    roomSubtotal + discountAmount(...)                      ← seedha, har type ke liye
```

`amount` aur `freeNight` discounts par bhi ab cut-ke-dikhne wali purani price aayegi.

---

## 8. Reference ids

| | Ab | Backend me |
|---|---|---|
| Booking | `STY-` + 6 chars, 20-attempt collision check | same scheme, **DB unique constraint** |
| Ticket | `TKT-1000…9999`, **koi check nahi** | **DB sequence** — collision namumkin |

Booking ka alphabet barqarar: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`I O 0 1` jaan bujh kar nikale gaye).

---

## 9. Commission

Platform **15%** leta hai, **poore total** par.

John ki misaal (naye rules ke saath — tax nahi, breakfast per-person-per-night):

```
Room            $725 × 3 raat                        = $2,175
Discount                                             =      $0
Add-ons         transfer $65 + breakfast $32×2×3     =   +$257
                                                       ────────
TOTAL                                                  = $2,432

Commission      15% × $2,432                         =    $365
Partner ko                                           =  $2,067
```

Chunke tax khatam ho gaya (§11), "total" ab room − discount + add-ons hi hai — yani
commission base ke teen options ka sawal khud-ba-khud hal ho gaya.

### Commission sirf mukammal stay par banti hai

**Cancelled aur no-show bookings par commission nahi.**

Usool: commission ek **mukammal hui service** ki qeemat hai. Guest ruka hi nahi to platform ne
kuch deliver nahi kiya. Aur jo paisa property ke paas rehta hai woh munafa nahi, **muawza** hai —
unhone kamra roke rakha aur doosre guest ko mana kiya. Us muawze me se 15% kaatna partner ko do
baar saza dena hai.

```
John cancel karta hai, policy 50% charge:
  Guest ko refund            $1,216
  Sarah ko                   $1,216      ← poora, koi commission nahi
  Platform ko                    $0
```

### `commission_status`

Number booking ke waqt jam jata hai, magar **wasool baad me hota hai**:

| Booking status | `commission_status` | Matlab |
|---|---|---|
| `pending` · `confirmed` · `checked_in` | `pending` | abhi tay nahi |
| `completed` | **`earned`** | payout cycle me jayegi |
| `cancelled` · `no_show` | **`void`** | number rehta hai, charge nahi hota |

`void` par `commission_amount` **delete nahi hota** — reporting ke liye rehta hai. Isse
*"cancellations se kitni commission zaya hui"* ek asli metric ban jata hai, jo extranet ke
static finance screens abhi dikhane ki koshish kar rahe hain.

> **Payment processor ki fee:** John ne card se $2,432 diye, $1,216 wapas gaye — magar Stripe
> original charge par apni fee (~$70) rakh leta hai. **v1 me platform ye bardasht karega.**
> Ek fixed cancellation-handling fee baad me add ho sakti hai, jab asli cancellation data aa jaye —
> abhi woh number guess hi hoga.

---

## 10. Value-add units

Chautha unit add hoga:

```
per stay             → price
per night            → price × nights
per person           → price × guests
per person per night → price × guests × nights      ★ naya
```

**Wajah:** ye concept codebase me pehle se socha gaya tha — `TaxKind` me `perPersonPerNight`
maujood tha (city tax usi par chalta tha). Value-adds ke liye reh gaya, aur "Daily breakfast"
theek isi ka case hai.

**Re-mapping (3 raat, 2 guests):**

| Add-on | Purana unit | Naya unit | Purani price | Nayi price |
|---|---|---|---|---|
| Daily breakfast $32 | per person | **per person per night** | $64 | **$192** |
| Spa package $120 | per person | per person *(waisa hi)* | $240 | $240 |
| Airport transfer $65 | per stay | per stay | $65 | $65 |
| Early check-in $35 | per stay | per stay | $35 | $35 |

Breakfast $64 par 6 nashte de raha tha — $10.67 per person per night. Ab sahi.
Spa `per person` hi rahega, woh ek baar ka treatment hai.

---

## 11. Tax — poora khatam

Product me **kisi qism ka tax nahi**. Type, logic, UI — sab hat jayega.

### Nayi pricing

```
roomSubtotal = har raat ka rate jama (per-date rates)
discount     = discountAmount(...)
addOnsTotal  = add-ons ka jama (naye units ke saath, §10)

TOTAL = roomSubtotal − discount + addOnsTotal
```

Bas. Koi tax layer nahi.

### Kya kya hatega

| Cheez | Kahan |
|---|---|
| `TaxKind`, `TaxLine` types | `types/index.ts` |
| `Hotel.taxLines` | `types/index.ts` |
| `BookingPricing.taxes` · `.taxTotal` · `.subtotal` | `types/index.ts` |
| `taxLinesFor()` · `taxAmount()` | `lib/domain.ts` |
| `defaultTaxLines` · `resortTaxLines` | `data/config.ts` |
| `addTaxLine` · `updateTaxLine` | `store/index.ts` |
| `/extranet/property/vat-tax` screen | poora route |
| `TaxRule` · `taxRuleForCountry` | `lib/admin/types.ts`, `data/admin` |

`BookingPricing` ki nayi shakal:

```ts
{ nights, ratePerNight, roomSubtotal, addOnsTotal, discount?, total }
```

`subtotal` bhi nikal raha hai kyunki ab woh `total` ke barabar hi hai — do naam ek cheez ke.

### Resort fee ka kya hoga

**Ye tax nahi hai, magar `TaxLine` ke tor par implement hua tha** (`kind: "perNight"`, $25).
Tax engine ke saath ye bhi chala jayega, aur resorts $25/night kho denge.

**Faisla: resort fee room rate me fold ho jayegi.** Resort ka base $1,200 → $1,225.
Headline price thoda barhega, magar "koi chhupi hui fees nahi" ka position saaf rehta hai —
jo luxury marketplace ke liye behtar bhi hai.

> *(Doosra rasta jo nahi chuna: `ValueAdd` par ek `mandatory` flag, jo har booking me khud-ba-khud
> add ho jaye. Ye line-item transparency deta hai magar naya feature hai — abhi scope me nahi.)*

City tax ($3.50/guest/night) bilkul khatam — woh asli tax tha.

### Asar

**John — Ritz, Deluxe King $725, 3 raat, 2 guests, 2 add-ons:**

| | Pehle | Ab |
|---|---|---|
| Room 3 × $725 | $2,175 | $2,175 |
| Add-ons (transfer + breakfast) | $129 | **$257** *(breakfast ka naya unit)* |
| VAT 10% + Service 5% + City tax | $366 | **—** |
| **Total** | **$2,670** | **$2,432** |

**Ek Resort — Standard $1,200, 3 raat, 2 guests, koi add-on nahi:**

| | Pehle | Ab |
|---|---|---|
| Room 3 × $1,200 | $3,600 | — |
| Room 3 × $1,225 *(fee fold ho gayi)* | — | $3,675 |
| VAT + Service + City tax | $561 | — |
| Resort fee 3 × $25 | $75 | *(rate me shamil)* |
| **Total** | **$4,236** | **$3,675** |

> **Note:** guest ke liye price girti hai — Ritz par ~9%, resort par ~13%. Ye ek asli **product
> aur revenue decision** hai, sirf technical safai nahi. Commission bhi chhote base par banegi:
> Ritz ki booking par $401 → **$365**.

---

## Schema par asar — khulasa

Ye faisle sidhe in tables ko badalte hain:

| Faisla | Schema par asar |
|---|---|
| #1 cancellation | `properties` par `cancel_free_until` + `cancel_charge` + `cancel_charge_value`; `policies.cancellation` prose **column nahi banega** |
| #9 commission | `bookings.commission_amount` snapshot (15% × total) + `commission_status` enum (`pending`/`earned`/`void`); payout sirf `earned` uthata hai |
| #10 value-add units | `value_adds.unit` enum me chautha value: `per_person_per_night` |
| #11 tax khatam | **`tax_lines` table banega hi nahi.** `bookings.pricing` JSONB me `taxes`/`taxTotal`/`subtotal` nahi. Resort fee `rooms.base_price` me fold |
| #3 channels | `promotions.channel` asli enum; `users.tier`; request channel derive hoga |
| #5 minStay | `rate_calendar.min_stay` per row; `Availability.minStay` **khatam** |
| #6 statuses | `booking_status` enum me `checked_out` **nahi**, `no_show` **haan**; transition guard service layer me; `pending` ke liye hold-expiry column |
| #8 ticket ids | `tickets.id` DB sequence se |

---

## 30. Email verification — kahan lazmi, kahan nahi

**Booking se pehle nahi.** Confirmation email ka link khud verification ban jata hai.

**Apni booking dekhna/cancel/modify karna bhi verification par mauqoof NAHI hai.**

> Ye rule #29 ke saath takrao me tha aur us takrao ko yahan hal kiya gaya. Account isliye
> lazmi kiya gaya tha ke email me typo ho jane par bhi booking guest ke dashboard me nazar
> aati rahe. Unverified guest ko usi booking se rokna us poore faide ko khatam kar deta —
> guest paisa de chuka hai aur apni hi reservation nahi dekh pa raha.

**Lazmi yahan hai, jahan risk asal me hai:**

| Kaam | Verification | Kyun |
|---|---|---|
| Booking karna, dekhna, cancel, modify | ❌ | guest ka apna record hai |
| Account ka email badalna | ✅ | warna account chura kar email badal lena aasan hai |
| Password reset | ✅ | reset link wahi email par jata hai |
| **Join wizard (partner onboarding)** | ✅ | yahan payout account aur contract juda hai |

Enforcement Module 9 (email) ke saath aayega — us se pehle verification email bhejne ka koi
zariya hi nahi, aur bina zariye enforce karna guest ko hamesha ke liye block kar dena hai.
`users.email_verified_at` abhi store hota hai aur `/auth/me` me `emailVerified` ke tor par
report hota hai; koi route uspar rok nahi lagata.

---

## 96. Ek saved list 500 tak, aur dil dobara dabana kuch nahi badalta

Guest sirf **`active`** property save kar sakta hai — draft ya suspended par **404**,
403 nahi (API1): kisi partner ki ghair-shaya listing ka wujood id se sabit nahi hona
chahiye.

Save **idempotent** hai. Do dafa dabao, do device se ek sath dabao — row ek hi rehti
hai, kyunki primary key hi `(user_id, property_id)` hai. Yaani ye baat service ke yaad
rakhne par nahi, **database ki shakl par** khari hai.

Save ke **baad** property suspend ho jaye to wo list me **rehti hai** aur `available:
false` kehti hai. Chupke se nikal dena list ko bila wajah chhota kar deta hai; bookable
dikhana mehmaan ko murda page par bhejta hai.

Hadd **500** (API4) — us se aage wo shortlist nahi rahi. Jo pehle se list par ho, use
dobara save karna hadd par bhi chalta hai: list barh nahi rahi.

---

## 97. Finance booking ki tareekh par chalta hai, aur teen lafz kabhi aapas me nahi badalte

```
gross       jo mehmaan ne diya
commission  jo platform ne kamaya   (#82)
net         jo hotel ke paas raha   (gross - commission)
```

Prototype pehle aur teesre — **dono** ko "revenue" kehta tha. Nateeja ye ke ek screen
doosri se 12% bara number dikhati hai aur reconcile karne wale ke paas ye janne ka
koi tareeqa nahi ke jhoot kaunsi bol rahi hai. Ab teen alag naam hain, aur teenon hamesha
jama hote hain.

**Basis: booking ki tareekh, stay ki nahi.** Analytics ADR/occupancy ke liye ulta karta
hai (#62) — aur jaan boojh kar: wo poochta hai "hotel ne kaisa karobar kiya", ye poochta
hai "kis ka kitna banta hai". Commission ek **booking** ki baat hai, aur wahi booking
payout line aur invoice line dono par naam se aati hai. Raat par baant do to ek aisa
number ban jata hai jis se koi invoice line mel nahi khati.

Tareekh hamesha **property ke timezone** me — Tokyo me raat 11 baje bikne wali stay Tokyo
ke usi din ki kamai hai.

**Void commission kabhi nahi ginti** (#76) — na total me, na ledger ki line par. Line par
`0` likha jata hai, asal raqam ke sath koi nishaan nahi: partner wo deta hi nahi, aur
charge dikhti line wo line hai jis par sawal aata hai.

**Pending payout aur unpaid invoice kabhi jama nahi hote.** Ek wo hai jo platform partner
ko deta hai, doosra wo jo partner platform ko. Ek number bana do to ye chhup jata hai ke
paisa kis taraf ja raha hai.

**Rate wo dikhta hai jo asal me laga**, jo aaj org par likha hai wo nahi — booking par
`commission_rate_bps` mehfooz hai, aur mahine ke beech rate badla ho to us mahine me
waqai do rate lage the.

**Staff ko ye screen milti hi nahi** (#66). Analytics me kuch screens paise chhupa kar bhi
kaam ki rehti hain; finance **hai hi paisa**, to role ko khali screen dikhane ke bajaye
screen se rok diya jata hai.

---

## 98. Dastkhat kabhi badalti nahi — lifecycle badalta hai

Do tables, aur farq hi asal baat hai:

```
contract_templates   platform kya offer karta hai, version ke sath
partner_contracts    ek partner ne kya qubool kiya, aur kab
```

Ek table hota to har partner ke paas wahi MSA ka text copy hota, aur ye sawal kabhi jawab
na milta: **"kaun abhi tak version 1 par hai?"** — jo legal ka pehla sawal hota hai jab
koi shart badalti hai.

**Text acceptance par copy hota hai**, sirf reference nahi. Dastkhat ek lamhe ka record
hai: agar baad me koi template ka row edit kar de, to jo partner ne maana tha wo un ke
neeche se badalna nahi chahiye. Wahi wajah jis se `property_name` booking par likha jata
hai.

**Dastkhat edit ho hi nahi sakti — database rokta hai.** Ek trigger har us UPDATE ko
`RAISE EXCEPTION` karta hai jo org, version, text, kis ne kiya, ya kab kiya — in me se
kisi ko chhue. Sirf lifecycle chalta hai (`status`, `ended_at`, `ended_reason`).
DB par azmaya:

```
lifecycle update  : ALLOWED (correct)
body rewrite      : REFUSED (correct)
signer rewrite    : REFUSED (correct)
backdate          : REFUSED (correct)
```

Trigger, RULE nahi — kyunki yahan shart lagti hai. Audit log `DO INSTEAD NOTHING` use kar
sakta hai kyunki wahan **kuch bhi** editable nahi.

**Naya version purane ko supersede karta hai**, purana template row kabhi delete nahi
hota: dastkhatein us par point karti hain, aur "version 1 me likha kya tha" ka jawab
hamesha maujood rehna chahiye.

**`status` me `pending` nahi hai.** Jo acceptance hui hi nahi wo flag wala row nahi — wo
row ka **na hona** hai.

**Sirf org admin qubool kar sakta hai** (#14). Manager ya front-desk ka company ko
commercial agreement se bandhna theek wo ikhtiyar hai jise `partner_members.role` alag
karta hai.

**Khatam karna platform ka faisla hai**, partner ka nahi — jis agreement se ek taraf
click kar ke nikal sake wo agreement nahi. Wajah lazmi (#78), audit me jati hai.

---

## 99. Listing score ek hi hai — aur jo abhi ho hi nahi sakta, wo ginti me nahi aata

Score **listing** ko 100 me se naapta hai: page kitna acha bana hai. Ye guest rating nahi,
jo 5 me se hoti hai aur bilkul doosri cheez maapti hai.

**Ek hi hisaab**, dono screens ke liye — partner ka `property/score` aur platform ka
`admin/content`. Do implementation ka matlab ek hi listing ke do number, aur partner ko
wo cheez theek karne ko kaha jata jo platform naap hi nahi raha.

**Sab se ahem: jo category abhi laagu hi nahi hoti, wo ginti me nahi aati.**

Prototype ne bina review wali listing ko rating par **0** de rakha tha. Yaani har nayi
property ko pehle din kaha jata tha ke tumhara page kamzor hai — theek us cheez par jis
par wo pehle din kuch kar hi nahi sakti. Ab `applicable: false`, aur weights **dobara
normalise** hote hain — warna mukammal page bhi 80 par ruk jata aur "excellent" tak kabhi
na pahunchta.

Sirf **approved** photo ginti hai aur sirf **published** review (#40). Pending photo wo
hai jo kisi guest ko dikhti hi nahi — to wo page ko behtar nahi banati.

Platform ki list **sab se kamzor pehle** — screen ka maqsad hi wo pages dhoondna hai jin
par kaam chahiye, aur behtareen se shuru karne wali list unhein dafn kar deti hai.

Har tip me **ginti** hoti hai ("Add 5 more photos"), sirf ye nahi ke kuch kam hai — jis
mashware par amal na ho sake us par koi amal nahi karta.

---

## 100. Calendar copy karna: chhota source lamba target par dohrata hai

Do range ki lambai **barabar hone ki zaroorat nahi**. Chhota source lambe target par
**dohrata** hai — kyunki is screen ka poora maqsad hi ek aam hafta poore season par
lagana hai. Barabar lambai zaroori kar dete to aam kaam sab se mushkil kaam ban jata.

**Rate ke sath restrictions bhi jate hain** — minStay, CTA, CTD, sab. Sirf daam copy
karna wo copy hai jo khamoshi se do-raat ki shart gira deta hai.

**Do tarah ka "kuch nahi", aur dono ka amal alag:**

| Source ka din | Amal |
|---|---|
| **row hai hi nahi** | target ka din **waise ka waisa** rehta hai |
| **row hai magar column NULL hai** | target par likha jata hai, yaani saaf ho jata hai |

Pehla is liye ke khali calendar ka matlab "rate plan par wapas jao" hai (#23) — NULL ka
row likh dena us fallback ki jagah ek saaf-saaf "kuch nahi" rakh deta. Doosra is liye ke
copy ka matlab yehi hai: baad me target wahi parhta hai jo source parhta hai.

**Source aur target dono rate plan alag alag check hote hain.** Sirf ek check karna wo
sooraakh hai jis se partner doosre ka rate plan **us se copy kar ke** parh leta.

Poora kaam **ek SQL statement** me. Saal bhar ke rows JavaScript me utar kar ek ek kar ke
wapas likhna 365 round trip hai — aur beech me nakaam ho jaye to calendar aadha copy
shuda reh jata hai.

---

## 101. Daam party ke size ke sath chalta hai — magar **farq** ke tor par, absolute nahi

Is se pehle akela musafir aur chaar ka khandaan **ek hi daam** dete the: nightly rate
occupancy ko dekhta hi nahi tha.

Matrix har party size ka **poora nightly price** rakhta hai, kyunki partner isi tarah
sochta hai aur screen yehi dikhati hai. Magar **lagta wo base occupancy se farq ke tor
par hai.**

Wajah:

| | 2 mehmaan | 1 mehmaan |
|---|---|---|
| Matrix | $725 | $600 |
| June me calendar ne rate $900 kar diya | $900 | **$775** ✅ |
| Agar absolute seedha use hota | $900 | $600 ❌ |

Yaani absolute seedha use karte to partner June ka rate barhata aur **akela musafir ab
bhi May ka daam** de raha hota.

**Base occupancy `maxAdults` nahi hai** — wo chhat hai jo kamre me sama sakti hai. Ye wo
ginti hai jo daam farz karta hai, aur wahi wo cheez hai jis se matrix apne farq naapta
hai.

**Matrix me base occupancy ka daam na ho to poori matrix bekaar hai** — farq ke liye do
number chahiye. Isi liye API us par **inkaar** karti hai: warna partner samajhta ke us ne
daam set kar diye jo khamoshi se kuch kar hi nahi rahe.

**Jo level set hi nahi**, us par discount **ghara nahi jata**. Jis partner ko single rate
chahiye wo set karta hai; jis ne nahi kiya wo base rate le raha hai, aur us ki taraf se
chhoot de dena us ka paisa dena hai jo us ne dene ka kaha hi nahi.

**Sab se bari party** jo matrix me hai, us se ooper wale usi par charge hote hain.
Extrapolate karna wo number quote karna hai jo kisi ne likha hi nahi; inkaar kar dena us
kamre ko book hone se rok deta hai jis me guest ka rehna jaiz hai.

**Adults par**, children par nahi — bachon ka apna allowance kamre par hai aur unhein
per-head charge nahi kiya jata.

**Grid poora replace hota hai (PUT), cell-by-cell nahi** — number sirf ek doosre ke
muqable maane rakhte hain, aur aadhi lagi hui matrix jahan teen mehmaan do se saste hon
wo daam hai jo kisi ne shaya karne ka irada hi nahi kiya tha.

---

## 102. Wizard ke chaar naam policy nahi hain — wo policy me **badalte** hain

Wizard poochta hai: Flexible · Moderate · Strict · Non-refundable.

Rate plan in me se **koi bhi** store nahi karta. Wo structured policy rakhta hai (#1),
taake mehmaan wala jumla **generate** ho aur us se alag na ho jaye jo asal me laagu hota
hai.

| Preset | freeUntil | charge |
|---|---|---|
| Flexible | `24h` | `first_night` |
| Moderate | `48h` | `first_night` |
| Strict | `7d` | `full` |
| Non-refundable | `non_refundable` | `full` |

Bina is mapping ke wizard un chaar lafzon me se ek us column me likhta jis ne unhein kabhi
qubool nahi kiya — bilkul wahi shakl jo aath property types ki thi.

**Mapping ek-tarfa hai, jaan boojh kar.** Preset se policy banti hai; policy se preset
wapas nahi banta — kyunki extranet me partner jo policies bana sakta hai un me se
zyadatar in chaar me se koi nahi hoti, aur haath se bani policy ko "Moderate" ka label
lagana jhoot hai.

**`noShowCharge` set nahi hota.** Khamoshi ka matlab hai "jo cancellation at arrival par
lagta" (#47) — jo aam soorat hai. Wizard partner ki taraf se aisi shart chunta jo us ne
dekhi hi nahi.

---

## 103. Registration ek **document** hai, aur approval wo transaction jo use karobar banata hai

**Asli rows likhte jana socha gaya aur rad kiya**, do wajah se:

1. **Wizard ki tarteeb tables ki shartоn se mel nahi khati.** Step 5 sirf qism chunta hai;
   naam step 6 par aata hai, rooms 14–19 par. Beech me likhne ka matlab hai har column
   nullable karna — theek wo cheez jo ye schema har jagah mana karti hai.
2. **Zyadatar registrations adhoori chhori jati hain.** Asli rows `partner_orgs` aur
   `properties` ko un khokhon se bhar dete jinhein har admin screen phir hamesha ke liye
   filter karti.

To draft ek document hai. Wo paanchwan type system na ban jaye — is ke liye **har write
zod se guzarta hai**, aur vocabulary doosre contracts se **import** hoti hai, yahan dobara
likhi nahi jati.

**`data || patch` — merge database me hota hai**, JavaScript me read-modify-write nahi.
Warna do screens ek sath save hon to har ek apni purani copy se poora document likh deta
aur baad wala pehle wale ke jawab chupke se mita deta.

**`currentStep` sirf aage barhta hai** (`GREATEST`). Peeche ja kar koi purani screen
dekhna ye nahi mita sakta ke wo asal me kahan tak pahunche the.

**Submit ke baad draft **band** ho jata hai.** Jo review ke dauran badla ja sake, us ka
matlab hai ke jo manzoor ho raha hai wo wo nahi jo parha gaya tha.

**Har kami ek sath batai jati hai.** Ikattees screens ke baad ek ek kar ke kami batana wo
form hai jo jhoot bol raha hai ke kitna baqi hai. Aur **kaunsa room** adhoora hai wo naam
se — "aap ke kisi room ka daam nahi" chhe screens ka shikar hai.

**Approve karna listing ko dobara review queue me nahi bhejta.** Platform abhi abhi poora
padh chuka — property, rooms, daam, documents. Ek hi cheez do dafa review karna sirf ye
sikhata hai ke parhna chhor do.

**Payout account hamesha `unverified`.** Form me IBAN likh dena us ka malik hone ka saboot
nahi, aur unverified account par payout theek wo tareeqa hai jis se paisa ghalat bank
jata hai.

**`maxChildren` sifar **nahi** hota.** Wizard ek sawal poochta hai — "kitne guests" — aur
sifar ka matlab hota "is kamre me bachay nahi aa sakte", wo pabandi jo partner ne kabhi
chuni hi nahi aur jis ka pata us waqt chalta jab koi khandaan book na kar pata.

**Purana amenity slug approval nahi torta.** Draft maheenon purana ho sakta hai; platform
ka retire kiya hua slug warna transaction ke beech me foreign key tor deta — **org ban
jane ke baad.**

**Sab kuch ek transaction me: ya poora, ya kuch nahi.** Aadha — org bina property ke,
property bina rooms ke — nakaam approval se bura hai: partner sign in karta hai, toota
hua account dekhta hai, aur kisi ko nahi pata ke halat kya honi chahiye thi.

---

## 104. Ranking wo cheez hai jis par search **asal me** chalti hai

Jo ranking search istemaal na kare, wo **kisi cheez ki report nahi**. Isi liye ye
`recommended` sort ko chalati hai — jo ab **default** bhi hai.

Is se pehle `recommended` khamoshi se `price_asc` par gir jata tha: yaani marketplace ki
default tarteeb "sab se sasta" thi jabke label kuch aur keh raha tha.

### Paanch factor, aur har ek wo hai jo platform pehle se naapta hai

| Factor | Weight | Kahan se |
|---|---:|---|
| Listing quality | 25 | rule #99 ka score |
| Guest rating | 25 | published reviews (#40) |
| Click-through | 20 | `search_impressions` (#67) |
| Price vs market | 15 | sheher ka **median** |
| Rooms left to sell | 15 | 60 din ka calendar |

**Kuch bhi khareeda nahi ja sakta.** Paid placement alag product aur alag faisla hai;
milane se ye score **na-qabil-e-tashreeh** ho jata.

### Sab se ahem cheez: kam saboot par bharosa nahi

3 impressions me se 1 click = **33%**, jo 10,000 par 8% wale purane listing ko kuchal
deta — **shor par**. Isi tarah 1 paanch-sitara review 500 reviews ke 4.6 ko.

Dono rate **market ke average ki taraf khinche** jate hain, us hisaab se ke saboot kitna
kam hai. Chhota sample takreeban kuch nahi kehta, bara sample takreeban sab kuch.

Isi ka natija: **poora 10000 kabhi nahi milta.** Prior kabhi poori tarah ghulta nahi — das
hazaar paanch-sitara reviews ke sath bhi das farzi average reviews saath rehti hain. 10000
ka matlab hota "ab koi naya saboot is ko badal nahi sakta", jo sample se lagaye anda ze ke
liye ek dawa hai jo kiya nahi ja sakta.

**Jis ka koi data nahi wo bura nahi, na-maloom hai.** Bina review wali listing 3.5/5 par
baithti hai, bina impression wali market rate par.

### Price ka weight jaan boojh kar sirf 15 hai

Jo marketplace sab se zyada **daam** par rank kare, wo har partner ko yehi sikhata hai ke
dikhne ka tareeqa neeche jana hai — aur poora catalogue neeche ki daud me lag jata hai.

Aur market ka **median**, average nahi: ek paanch-hazaar-dollar suite warna poore sheher
ka benchmark hila deta aur har aam hotel ko "sasta" likh deta.

### Score raat ko banta hai, har request par nahi

Score par sort karne ka matlab hai **paging se pehle har match ko rank karna**. Har
keystroke par poore sheher ke paanch factor dobara ginna search nahi, report hai.

Column me 0–10000 integer, raat 2 baje cron. **Jo listing kabhi rank hui hi nahi wo aakhir
me aati hai** — mehfooz simt: nazar aati hai, bas un se ooper nahi jinke baare me platform
kuch janta hai.

**Position materialised column se, factors live hisaab se.** Dono ek din ka farq rakh
sakte hain, aur ye imaandari hai: tarteeb waqai kal raat ki hai, aur wajuhat waqai aaj ki.

### Partner ko poora hisaab dikhta hai

Har factor, us ka weight, aur us ne kitna diya — kyunki **jo ranking partner check na kar
sake us par wo behes karta hai**, aur "apni visibility behtar karo" bina numbers ke wo
jumla hai jis par amal ho hi nahi sakta.

Sath me **ek factor** jo sab se zyada sudharne layak hai — **weighted**. Jis factor ki
qeemat 15 hai us par bhejna jab 25 wale par 20 point ja rahe hon, ghalat screen par bhejna
hai.

---

## 105. Har message ka apna switch — magar sirf un ka jo band ho sakte hain

Pehle sirf **teen mote switch** the (`emailUseful`, `emailMarketing`, `smsUseful`), poore
shakhs ke liye. `property/messaging` screen har template ka alag switch maangti hai — aur
wo maangna theek hai: "nayi booking par batao magar review par nahi" bilkul jaiz cheez hai.

**Table sparse hai.** Jis row ka wujood nahi, us ka matlab "jo class kehti hai wahi" — jo
sab ko milta hai jab tak wo kuch badalte nahi. Har template ko har channel ke saath har
account ke liye likhna hazaaron rows me wahi baat kehna hai jo defaults pehle se keh rahe
hain.

**Bareek switch mote wale ko harata hai — dono simton me.** Jis ne email band ki magar nayi
bookings sunna chahta hai, use theek wahi milta hai. Aur jis ne email khuli rakhi magar
review alerts chup kar diye, use bhi.

**`essential` ka switch hai hi nahi** (#56). Invoice, payout, booking confirmation —
ye kisi ke paise ka record hain. Jo switch honour nahi hoga, us ka na hona behtar hai.

Aur `essential` ka check **overrides se pehle** hota hai: aisa override maujood **ho sakta
hai** — template ki class baad me badal sakti hai jab koi use pehle hi band kar chuka ho.

**API essential par inkaar karti hai, nazarandaz nahi.** Chupke se qubool kar lena wo
tareeqa hai jis se koi ye samajh kar chala jata hai ke us ne kuch band kar diya.

**Fehrist catalogue se banti hai**, us se nahi jo shakhs ne store kiya — warna pichle
hafte jura hua template tab tak nazar nahi aata jab tak koi use chhoo na le.

---

## 106. Settings me sirf wo jo asal me kuch karta ho

Screen pandrah cheezein deti thi. Un me se **do** kuch karti thin.

| Hataya | Kyun |
|---|---|
| `platformName`, `defaultLanguage`, `timezone` | deploy configuration hai, runtime setting nahi |
| `trialPeriodDays`, `maxPropertiesFreePlan` | aisi freemium product ki tafseel jo maujood hi nahi |
| `integrations` (Supabase/Stripe/Resend/GA/Twilio/Calendly) | Supabase stack me hai hi nahi, aur "Stripe connect karo" secret key ke sath `env.ts` ka faisla hai — koi button nahi |
| `defaultCurrency` | **read-only** — har daam USD cents hai, char jagah hard-coded |

Bachi do:

- **`supportEmail`** — waqai runtime: support ka pata provider aur team ke darmiyan chalta
  rehta hai, aur us ke liye deploy chahiye hona wo tareeqa hai jis se murda pata mahine bhar
  har email par rehta hai.
- **`defaultCommissionRateBps`** — nayi org ko kya rate milta hai.

**Nayi org par lagta hai, tareekh par kabhi nahi.** Partner ka rate us ki apni row par hai,
aur us ke invoices usi se bane the. Jo platform ek field edit kar ke maazi ki qeemat badal
sake, us se koi reconcile nahi kar sakta.

**Ek row, aur `CHECK (id = 1)` use ek hi rakhta hai.**

Wajah saaf hai: **jis form ke control kuch karte hi na hon wo chhoti form se bura hai** —
koi value set karta hai, us par yaqeen karta hai, aur bahut baad me pata chalta hai.


---

## 107. Ek message ka naam catalogue tay karta hai, screen nahi

`GET /notifications/preferences` ab har switch ke sath us ka **label aur description**
bhejta hai, aur wo `NOTIFICATION_COPY` se aata hai — usi file se jahan template ka class,
audience aur channels tay hote hain.

Wajah: teen surfaces yehi list render karti hain (guest ka dashboard, partner ka
`property/messaging`, admin). Har ek apne alfaaz likhti to ek hi switch ko teen naam mil
jaate — aur `partner_new_review` jaisa slug seedha partner ko dikh jaata.

`satisfies Record<NotificationTemplate, …>` is ka pehra hai: **copy ke baghair naya
template add karna build tor deta hai.**

## 108. Omit aur `null` ek cheez nahi

`POST /partner/inventory/rates` me har field optional aur nullable hai:

| Bheja | Matlab |
|---|---|
| field bheja hi nahin | **jo laga hai wahi rehne do** |
| `field: null` | **hata do** — rate plan ki apni value par wapas |
| `field: 5` | 5 laga do |

Pehle SQL `rate = COALESCE(EXCLUDED.rate, rate)` thi — jo dono ko ek kar deti thi. Nateeja:
**jo ek dafa set ho gaya wo kabhi hat nahi sakta tha.** Ghalti se lagi qeemat hamesha ke
liye lag jaati, aur ghalti se laga minimum stay bookings refuse karta rehta — wapsi ka
raasta hi nahi tha.

Ab sirf wohi columns assign hote hain jo waqai bheje gaye, aur un ke liye `EXCLUDED`
jaisa hai waisa liya jaata hai — `NULL` samet, kyunke wohi to clear hai.

Isi se juda: **`isOverridden` ka matlab "is raat ki apni qeemat hai"**, "row maujood hai"
nahi. Rate clear karne par row bachi rehti hai (us me raat ki restrictions hain), aur
row-level test plan ki apni qeemat par bhi "override" ka dawa karta rehta.

## 109. Padhne ka usool likhne par bhi lagta hai

`preferencesFor` hamesha partner se guest ke messages chhupata tha. Magar
`savePreferences` audience check nahi karta tha — to haath se banaya hua PATCH `offer`
(guest-only marketing) ka override store kar leta tha.

Ab **refuse hota hai, ignore nahi** — usi wajah se jis se `essential` refuse hota hai:
qabool kar ke nazarandaaz karna hi wo tareeqa hai jis se koi samajhta hai ke us ne kuch
band kar diya.

**SMS ka switch bhi gaya.** `sms_useful` store hota tha, API deti thi, settable tha — aur
`maySend` use kabhi parhta hi nahi, kyunke SMS `NotificationChannel` hai hi nahi. Guest ki
settings screen "Text alerts for your bookings" ka waada karti thi. Column reserved hai
(adapter aaye to jagah maujood), lekin **koi surface wo choice offer nahi karti**.

---

## 110. Keyset paging ke sath page number nahi ho sakta

Admin panel ka mock `{ rows, total }` aur page number deta tha. API `{ items, nextCursor }`
deti hai — aur ye sirf shakl ka farq nahi:

- **"page 7" aisi request hai hi nahi** jo ye API le sake. Chhe page gin kar aage jaana
  matlab hazaron aisi rows parhna jo kisi ne dekhi hi nahi, aur jawab phir bhi us waqt
  badal jaayega jab koi booking kar de.
- **`total` ka matlab poori table par `COUNT(*)`** — har keystroke par, aur render hone
  tak wo number purana ho chuka hota hai.

To `DataTable` ab **cursor stack** rakhti hai: aage jaane par cursor push, peechay jaane
par pop. "Previous page" wohi safar ulta chalta hai jo is session ne kiya — aur yehi wo
tareeqa hai jis se offset ke baghair "peechay" ka koi matlab ban sakta hai.

Sath hi **sort headers hata diye**. Admin list endpoints koi sort key leti hi nahi; wo
newest-first deti hain. Jo header sirf loaded 50 rows ko dobara tartib de, wo 51-vi row
aate hi jhoot bol raha hota hai.

Aur **facets ab single-select** hain: har facet ek query parameter hai, aur API ek value
leti hai. Multi-select control sirf pehla tick bhej kar baqi chup-chaap gira deta.

## 111. Badge sirf wahan jahan API waqai gin sakti ho

Sidebar par saat badge the. Teen bache:

| badge | kahan se |
|---|---|
| `propertiesPending` | `/admin/listings/queue` — wo khud hi queue hai |
| `reviewsToModerate` | `/admin/reviews` → `counts.pending` |
| `inboxUnread` | `/admin/support` → `counts.open` |

Hataye gaye: `usersInvited` (invite org ka hota hai, platform ka nahi), `reservations`
(ab tak ki har booking ka total queue nahi hai), `contentToModerate` (listing queue usay
already cover karti hai), `billingUnpaid` (unpaid invoice overdue nahi hoti, aur badge
aisa hi parha jaata tha).

Is ke liye teen jagah `counts` add kiye — support queue, moderation queue, aur users —
**har ek poore set par, page par nahi**. Jo badge sirf screen par mojood rows ginta ho, wo
filter lagate hi zero ho jaata — jo queue badge ka bilkul ulta maqsad hai.

## 112. Admin ka bell notification feed nahi, work queue hai

Catalogue ka har template guest ya partner ke naam hai (rule #105) — **admin audience hai
hi nahi**. To bell ek fixture parh raha tha aur "mark all read" offer kar raha tha.

Bell ka matlab "kuch tumhara intezar kar raha hai" hai, aur operator ke liye wo message
list nahi, **kaam ki qatar** hai. Ab wohi teen asli counts dikhata hai, har ek us screen
se juda jo usay khaali karti hai. "Mark all read" nahi hai — ye dekh lene se saaf nahi
hote, kar dene se hote hain.

---

## 113. Public page par har dawa qabil-e-saboot ho

Home page par chaar cheezein aisi thin jo product poora nahi karta:

| Kya | Masla |
|---|---|
| "Best Price Guarantee — we'll match it" | koi price-match kahin nahi hai; ye contract hai jo koi nibhata nahi |
| "Exclusive Perks — complimentary upgrades, spa credits" | inhein koi nahi deta; value-adds guest **khareedta** hai |
| "24/7 Concierge" | staffing ka wada hai, feature nahi — support ek ticket queue hai |
| Guest testimonials | teen ghar ke banaye quotes, farzi naam, generated chehre |

Aur **"342 properties in Dubai"** — marketplace me aath properties hain. Ab
`GET /destinations` asli grouped count deta hai: card par jo number hai, click karne par
utni hi hotels milti hain.

Newsletter form bhi gaya — email box aur Subscribe button jo kahin nahi jaate: koi list
nahi, koi confirmation nahi, koi double opt-in nahi. Jo pata product sambhal hi nahi
sakta — aur jise bhejne ke liye consent chahiye — wo maangna na maangne se bura hai
(rule #56).

Jo chaar bache, har ek code me kahin enforce hota hai: daam par kuch nahi jurta (#11),
verified badge sirf asli stay par (#40), cancellation terms daam se pehle (#1), aur
support bina account ke (#85).

## 114. Message booking par hangta hai, hotel par nahi

Support page ka form guest ko **koi bhi** hotel chun kar message bhejne deta tha. Aisi
guftagu is product me hai hi nahi: message ek **booking** se juda hota hai, aur wohi tay
karta hai ke usay kaun parh sakta hai — jo stay par hai, aur jis property ki hai.

Jis guest ki us hotel me koi booking nahi, us ka us hotel se koi thread nahi. Ek bana
dena matlab ye bhi banana ke wo kise dikhega.

Ab picker guest ki **apni bookings** hai. Aur jis ke paas koi nahi, us ke liye imaandaar
jawab saath wala support form hai — jo bina sign-in ke chalta hai, jaan-boojh kar
(rule #85).

## 115. Arrival window property ke check-in se banti hai

Checkout ki arrival list har hotel ke liye 15:00 se shuru hoti thi. Jo property 14:00 par
kholti hai us ka pehla ghanta ghayab tha; jo 16:00 par kholti hai wo aisa window offer
kar rahi thi jab andar koi jaa hi nahi sakta — aur field ke upar asli check-in time likha
hua tha, ghalat options ke saath.

Ab chhe hourly windows property ke apne `checkInTime` se, phir "later" aur "not sure yet".
Aakhri do ahem hain: aadhi raat pahunchne wala mehmaan aur wo jise waqai nahi pata — front
desk ke liye do alag baatein hain, aur koi bhi waqt nahi hai.


## 116. Registration ka draft server par rehta hai, browser me nahi

31 screens ke jawab `localStorage` me jama hote the. Matlab: refresh se bach jate the,
aur bas. Doosra device nahi, phone nahi, colleague nahi — aur **platform bhi nahi**. Jis
application ko koi dekh hi nahi sakta, us par faisla kaun karega?

Ab `GET/PATCH /join/registration` — draft pehli read par ban jata hai, har screen apna
patch bhejti hai, aur jawab me poora draft **`gaps` ke sath** aata hai. Save **Continue par
hota hai, har keystroke par nahi**: ek screen ek transaction hai. Debounced autosave ka
matlab hota ke connectivity toot-ne wala partner chaar screen aage barh jata is yaqeen ke
sath ke sab mehfooz hai.

## 117. Jo cheez draft me nahi, us ka gap bhi list me aata hai

`submissionGaps` sirf draft par chalta hai — isi liye wo shared hai aur bina database ke
test hota hai. To **account** ya **upload** ki shart wahan nahi ja sakti.

Wo service me jurti hai, **usi list me**: "Confirm your email address" aur "Add at least
one photo of the property". Partner ko is se koi gharz nahi ke kaun si shart kis taraf
girti hai — usay ye jaan-na hai ke **kya baqi hai**.

Email ki tasdeeq lazmi hai kyunke partner agreement, payout account aur approval ka faisla
— teenon usi patay par hangte hain. Jis address ko kisi ne confirm nahi kiya, us par
manzoor hone wala partner kabhi jaan hi nahi payega ke wo manzoor hua.

## 118. Approve hote hi IBAN draft se mit jata hai

`partner_payout_accounts` jaan-boojh kar sirf **aakhri chaar** ank rakhta hai. Magar poora
IBAN aur SWIFT `partner_registrations.data` ke JSON me hamesha ke liye pade rehte the —
har us admin ko nazar aate jis ke paas queue khuli ho. Ye us faisle ko chupke se ulta deta
hai.

Approval par account ban chuka hota hai, is liye draft se `iban` aur `swift` **saaf kar
diye jate hain**. Naam aur bank rehte hain — purani application pehchanne ke liye wahi
kaafi hai.

## 119. Listing bina tasveer ke live nahi hoti

Approval property ko seedha `active` par banata hai. Photos ka rasta `properties/:id/...`
se hokar jata hai — aur registration ke waqt property hai hi nahi. Natija: wizard ka
"photos" step ek **counter** tha (`photos: 4`), file picker kabhi khulta hi nahi tha, aur
manzoori ke baad listing **khali gallery** ke sath bazaar me chali jati thi.

Ab tasveer `registration_documents` me `kind: 'photo'` ke tor par jati hai — wahi presign →
PUT → confirm rasta, wahi key check. Approval un rows ki **storage key** `photos` me utar
deta hai (bytes copy nahi hote), `status: 'approved'` ke sath: platform ne ye tasveerein
abhi abhi dekh kar manzoor ki hain, unhe dobara review queue me bhejna listing ko khali
gallery ke sath live karna hai.

**Kam az kam ek tasveer** submit ki shart hai.

## 120. Wizard ka har jawab kisi jaga girna chahiye

Registration ke 31 screens me se kai aise the jo poochte the aur phenk dete the:

| Kya poocha jata tha | Kahan jata tha |
|---|---|
| `roomTypes` (step 7) — naam, bed, guests, count | **Kahin nahi.** Asli rooms steps 14–19 banate hain |
| Weekend pricing + markup (step 10) | Kahin nahi — is system me **day-of-week pricing hai hi nahi** |
| Seasonal rates (step 10) | Local state, Continue par khatam |
| Bathroom private/shared + fittings (step 16) | Draft tak, `buildUnits` inhe chhorta tha |
| Smoking (step 14) | Wahi |
| Beneficial owners ke naam + DOB (step 29) | **Kahin nahi** — "legal requirements" ke unwan ke neeche |
| Contracting party ka poora pata (step 31) | Uncontrolled inputs — likha hi nahi ja sakta tha |
| Invoice address (step 22) | Uncontrolled inputs, aur org me column bhi nahi tha |

Ab: `roomTypes` ki jagah **description** (jo submit ke liye lazmi hai aur koi screen poochti
hi nahi thi), weekend/seasonal **hataye gaye** (per-date pricing extranet calendar ka kaam
hai), bathroom + smoking **`rooms.features`** me, step 29 par asli **document upload**
(identity/ownership/business/tax — kinds jo shuru se maujood the aur koi screen istemal
nahi karti thi), aur invoice address ke liye `partner_orgs.billing_address`.

Usool: **jo jawab kahin nahi girta, wo sawal nahi poochna.** Aur zaati maloomat (naam,
tareekh-e-paidaish) compliance ke naam par lekar phenk dena — na poochne se bura hai.

## 121. Cancellation ek hi sawal hai, do screens par

Step 11 chaar presets deta tha, step 23 wahi sawal doosri zubaan me — "free until 6pm /
1 day / 3 days" plus "first night / full". `cancelFreeUntil` aur `cancelCharge` naam ke ye
do field **kahin maujood nahi the**: na contract me, na rate plan par, na approval me. Aur
"6pm arrival" kisi preset se milta hi nahi tha, to us ka matlab **kuch bhi nahi** tha.

Isse bhi bura: step 11 ke chaaron descriptions **ghalat** the — "Moderate: free up to 5
days" (asal me **48 ghante**), "Strict: 50% refund" (is system me **50% hai hi nahi** —
poora stay charge hota hai).

Ab dono screens `cancellationPresets()` se render hoti hain — ek field, do jagah, aur
sentence wahi jo refund calculate karta hai (rule #102).


## 122. Public page ka har aankra ginti se aaye, file se nahi

Rule #113 ki tawseeh. `/about` aur `/press` par chha aankray file me likhe hue the —
"2,400+ curated properties", "68 countries", "1.2M stays booked", "4.8/5 average guest
rating", "180 people in 14 countries", "founded 2019, London" — aur press page par un ke
upar likha tha ke sahafi inhe publish karein.

Catalogue me **aath properties, do mulk, sifar published reviews** hain. Header me
"Hotels" par ek click ye sab jhutla deta tha.

Ab `GET /platform/stats` — properties, cities, countries, reviews, average rating. Jo
gina ja sakta hai wo `<PlatformStats />` ginta hai. Jo nahi — employees, founding date,
HQ — wo **likha hi nahi jata**, kyunke system me aisi koi cheez nahi jo unhe jaanti ho.

Guest count jaan-boojh kar nahi hai: wo tijarati taur par hassas hai, aur jo marketplace
apne kam customers ka aelan kare wo imaandar nahi, ghaafil hai.

Aur jo aankra load na hua ho wo **dash** dikhata hai, sifar nahi. "0 countries" ek bara
jhoot hai bajaye is ke ke koi number hi na ho — aur "0/5 rating" kehta hai ke har property
kharab hai.

## 123. Mann-ghadant press coverage nahi

`/press` par chaar mentions the — The Continental Review, Hospitality Quarterly,
Traveller & Co., Northbound Business — headlines, tareekhon aur section labels ke sath.
In me se koi publication maujood hi nahi.

Ye placeholder copy nahi. Ye ye dawa hai ke **aazad sahafiyon ne is karobar ko dekha aur
pasand kiya** — press page ka wujood hi isi ke liye hai, aur yahi wo cheez hai jise
banaya nahi ja sakta. Section asli cuttings ke sath wapas aayega, warna bilkul nahi.

Isi tarah `/careers` par chhe farzi vacancies thin, "Updated weekly" badge ke sath. Ek
farzi job advert ki poori qeemat **darkhwast dene wala** ada karta hai.

## 124. Jis programme ka wujood nahi, us ki rate publish nahi hoti

`/partners/affiliate` par chaar commission tiers (4% → 8%), 45-din ka cookie window,
maasik payouts. `/partners/travel-agents` par "**Guaranteed** 10% commission on every
booking".

Schema me: koi referral code nahi, koi attribution nahi, koi affiliate account nahi, koi
agent rate nahi. Sirf `bookings.source` ki ek enum value `travel_agency` — bas.

**Public page par likhi hui rate ek offer hai.** Jis publisher ne wo parh kar hazaar
booking bheji, us ne kuch nahi kamaya — aur is baat ka koi record bhi nahi ke us ne kuch
bheja tha. "Guaranteed" wo lafz hai jo ise sangeen banata hai.

Dono pages ab "not open yet" kehte hain, koi aankra nahi, sirf dilchaspi darj karne ka
rasta.

## 125. Ek notification, ek source

Bell teen headers me tha (site, dashboard, extranet) aur **demo store** se parhta tha,
jabke `/dashboard/notifications` — ek click door — asli API se. Ek hi shakhs ko bell
"3 unread" dikhata aur page kuch bhi nahi.

Bell ka `audience` prop bhi gaya: `/notifications` server par hi caller ke hisab se scope
hota hai, to header se bheja gaya audience us faisle par **doosri raye** thi — aur us se
ikhtilaf kar sakti thi.

Aur ab wo **sign-in se pehle render hi nahi hota**. Pehle public header par Register/Login
buttons ke barabar khara tha: aise visitor ko notification tray dikhata jis ka account hi
nahi, aur har page par ek yaqeeni 401.

## 126. Jo button kuch nahi karta, wo button nahi hai

Is sweep me teen mile:

| Kahan | Kya kehta tha | Asliyat |
|---|---|---|
| Extranet change-password | `toast.success("Password updated")` | **koi request nahi** — password wahi rehta |
| Support search | `toast.success("Searching help articles…")` | kuch dhoondta nahi tha |
| Invoice row actions | "Reminder sent", "Downloading invoice…" | koi endpoint nahi (aur poora component orphan tha) |

Password wala sabse khatarnak: jis partner ka laptop kho gaya, usay **likh kar** bataya
gaya ke us ne password badal diya — aur badla nahi tha.

Support search ab wahi FAQ dhoondti hai jo usi page par neeche maujood hain, `?q=` ke
zariye — to jawab ka link bhejna bhi mumkin hai.


## 127. Admin panel ka role session se aata hai, localStorage se nahi

`/admin` ka role `localStorage["stayora.admin.role"]` se parhta tha, default
**`super_admin`**, aur topbar me ek dropdown tha jis se koi bhi apna role badal sakta tha.
Auth se pehle ye munasib stand-in tha. Auth ke baad ye ek surakh tha:

- **koi bhi signed-in account** — mehmaan ho ya partner — `/admin` khol kar poora
  super-admin shell dekh sakta tha: har section, har table, har control.
- API ne data nahi diya (dashboard ki dason calls par 403), to **koi data leak nahi hua**.
  Jo leak hua wo platform ke andaroon ka **naqsha** tha, aur har control aisa click tha jo
  sirf nakaam ho sakta tha.
- Switcher khud ijazat deta tha. **Jo control aap ki apni ijazat badal de, wo permission
  system nahi hai.**

Ab role `/auth/me` ka hai, aur `AdminRouteGuard` har screen ke upar se refuse karta hai.
`rbac.ts` ke chaaron entry points `AdminRole | null` lete hain — `null` ka jawab hamesha
`"none"` aur `false` — taake jo component check karna bhool jaye wo bhi admin control
render na kar sake.

**Note:** database me sirf `customer | partner | admin` hain. Client ke chaar sub-roles
(`super_admin`, `ops`, `finance`, `support`) ka koi column nahi, is liye har asli admin
`super_admin` par map hota hai — jo "aaj ek hi qism ka admin hai" ka imaandaar tarjuma hai.

## 128. Guard ke bahar ka chrome bhi na poochay

Admin ka topbar aur sidebar **guard ke ird-gird** render hote hain, andar nahi. Natija: jis
mehmaan ko guard refuse karne wala tha, us ka browser pehle hi teen admin queries maar
chuka hota tha — aur teen 403 le kar aata tha.

Guard theek tha; **chrome ne phir bhi poocha**. Ab badge counts bhi role par gated hain.

Usool: jo cheez guard ke bahar render hoti hai, us ki queries ko khud gate karna parta hai.

## 129. "Mat bhejo" ka matlab `enabled: false` hai, koi jhooti value nahi

Admin ka command palette teen queries banata hai aur sirf wo chahta hai jo role khol
sakay. "Mat bhejo" wo `{ limit: 0 }` bhej kar kehta tha — aur `limit` ka schema **min 1**
hai. Natija: **har admin screen par teen requests, teenon 400**.

Yehi baat public marketplace par thi: `useFavorites`, `useMyBookings`, `useMyTickets` bina
session ke fire hote the, to har signed-out visitor ko har page par 401 milta tha — home,
search, har property page.

react-query me is ka jawab `enabled` hai. Ek invalid parameter bhej kar server se "na"
kehlwana request na bhejne ke barabar nahi hai.

## 130. Client ka type API se tasdeeq shuda ho

Is QA pass me ek hi bug tin shakal me nikla:

| Kahan | Client kehta tha | API deti hai |
|---|---|---|
| `POST /auth/password` | `{ changed: true }` | `{ endedElsewhere: n }` |
| `GET /admin/reservations` | `BookingDto` (nested `guest`) | booking **row** (flat `guestFirstName`) |
| `GET /admin/reservations/:id` | `BookingDto` | `{ booking, events, payments, totals }` |

Doosra wala teen screens par `Cannot read properties of undefined (reading 'firstName')`
phenkta tha. Sahi type likhte hi compiler ne **har** ghalat jagah khud dikha di — ek aisi
bhi jo nazar se guzar chuki thi (global search).

Aur `api()` khud apna contract tor raha tha: Nest `null` ko **khaali body** bana deta hai,
client us par `undefined` lauta raha tha, aur react-query `undefined` qubool nahi karti
("Query data cannot be undefined") — to `payoutAccount` (jo jaan-boojh kar `| null` typed
hai) wali screen chal hi nahi sakti thi. Ab khaali body `null` hai.

**Har hand-written client type chalti API par tasdeeq karo.**

## 131. Login har role ko us ke apne ghar bhejta hai

Sab `/dashboard` par jaate the. Partner ke liye wo **mehmaan ka** dashboard hai — apni
khaali bookings aur favourites, aur kahin koi ishara nahi ke extranet naam ki koi cheez
hai, jahan us ki property, rates aur paisa hai. Admin ke saath bhi yehi.

Ab: partner → `/extranet`, admin → `/admin`, guest → `/dashboard`. `?next=` phir bhi
jeetta hai — checkout se aaya shakhs checkout par hi wapas jata hai.


## 132. Har authenticated surface ka apna darwaza ho

`/dashboard`, `/extranet` aur `/admin` — teenon par **koi route guard tha hi nahi**.
Address bar me `/extranet` likh kar, bina sign-in ke, poora partner shell khul jata tha:
sidebar, 56 screens, property selector. API ne har request 401 di, is liye kuch leak nahi
hua — magar product ne ek ajnabi ko bataya ke wo aisi jagah hai jahan wo hai hi nahi, aur
screen ka har control aisa tha jo sirf nakaam ho sakta tha.

`RequireRole` ab **layout ke sab se bahar** hai, chrome se bhi upar — kyunke header aur
sidebar mount par fetch karte hain (rule #128). Screen ke bajaye layout par guard lagane ka
matlab: kal likhi jane wali screen usi din mehfooz hai jis din likhi jaye.

Do alag jawab, kyunke do alag soortein hain:

- **Session nahi** — ye ijazat ka masla nahi, ek chhoota hua qadam hai. `/login?next=…`
  par bhejo, aur sign-in ke baad wapas wahin. (Login form `next` pehle se manta hai.)
- **Ghalat role** — mehmaan extranet ke darwazay par. Dobara sign in karne se kuch nahi
  hoga, to saaf kaho, aur **us ka apna darwaza** dikhao ("List a property", ya extranet).

## 133. `formatCurrency` cents leta hai — kyunke paisa cents me hi hai

Formatter poore units leta tha, aur API har qeemat **cents** me deti hai. 164 call sites me
se **108 ne yaad rakh kar `/ 100` kiya tha, 56 ne nahi** — aur wahi 56 sau guna qeemat
dikha rahe the:

| Kahan | Dikhta tha | Asal |
|---|---|---|
| Property card | $72,500 | **$725** |
| Checkout, ek raat | $32,000 | **$320** |
| Checkout, total | $64,000 | **$640** |

Jab default ghalat taraf ho aur 56 log us me gir jayein, to masla un 56 ka nahi — default
ka hai. Ab formatter khud taqseem karta hai aur call site sirf paisa deta hai. Wo `/ 100`
jo 108 jagah likha tha, hat gaya.

**Booking product ki sab se buri ghalti yehi thi:** checkout par likhi qeemat wo nahi thi
jo server ne quote ki.

## 134. Grid ya flex ka bachcha `min-w-0` ke baghair sikurta nahi

Extranet ke dashboard par 390px ke phone par page **282px baahar** nikal jata tha. Wajah
table nahi thi — table apne `overflow-x-auto` wrapper me theek thi. Wajah ye thi ke grid
item ka `min-width` default `auto` hota hai, yani "apne content se patla kabhi nahi", to
column 656px ka ho gaya aur poora page apne saath le gaya.

`min-w-0` grid children par, aur table apne wrapper ke andar scroll karti hai — jis ke liye
wo wrapper hai.

## 135. "Page chaurha hai" ka sahi paimana `scrollWidth` nahi

Isi peechha karte hue ek jhoota surag bhi mila: har public page `scrollWidth` me 97px zyada
batata tha. Ghanton us "bug" ka peechha kiya ja sakta tha — **magar page waqai sideways
scroll hota hi nahi** (`window.scrollTo(600,0)` ke baad `scrollX` sifar rehta hai).

Sticky header ke andar ek nested scroll container root ke `scrollWidth` ko phula deta hai
bina viewport ko hilaye. Jo cheez insan mehsoos karta hai wo ye hai ke **page khisakta hai
ya nahi** — QA usi ko naapti hai. Site header par jo "fix" is jhoote paimane par kiya gaya
tha, wo wapas le liya gaya: wo kabhi tuta hi nahi tha.


## 136. Rate limit ki ginti sab instances mein ek ho

`@nestjs/throttler` ka default store **per-process** hai. Do container chale to har ek
apni ginti rakhta hai, aur limit **do guna** ho jati hai: global 120/min ka 240, aur — jo
asal maayne rakhta hai — login ka 5/min ka 10.

Kuch tootta nahi, kuch log nahi hota. Tahaffuz bas utna nahi rehta jitna code kehta hai.

Ab ginti `rate_limits` table mein hai, aur poora hisaab **ek statement** mein:
`INSERT … ON CONFLICT DO UPDATE … RETURNING`. Read-then-write se wo bilkul us waqt kam
ginta jab ginti sab se zaruri hai — us load par jo hamla-awar khud banata hai.

Teen faisle:

**`UNLOGGED` table.** Poore schema mein yeh akeli hai aur is ka haq rakhti hai: yahan ek
row ek counter hai jo minute ke andar khatam ho jata hai. Har request par ek durable
(WAL) write us cheez ke liye jise crash bhool bhi jaye to koi harj nahi — mehngi ghalti
hoti. Crash par counters reset, jo deploy par bhi hota hai.

**DB na pohanche to request guzar jaye.** Do hi raste hain: sab ko 429 do, ya sab ko
guzarne do. Guzarna jeetta hai — jo limiter gin nahi sakta wo kamzor difaa hai; jo limiter
sab ko 429 de wo **poore product ka outage** hai, aur wo bhi us cheez ke haath jo hifazat
ke liye lagayi thi. `error` par log hota hai taake ye chupke se na ho.

**Safai cron par, request par nahi.** Jo limiter ginte waqt safai bhi kare, us ki qeemat wo
shakhs deta hai jo us waqt aaya — aur har instance alag alag.

**Aur ek baat:** storage ko `ThrottlerModule.forRootAsync` mein **saaf taur par** dena
parta hai. Global module se `ThrottlerStorage` provide karna kaafi nahi — `forRoot` apna
in-memory provider register karta hai jo jeet jata hai, aur limiter per-process ginta
rehta hai jabke configured lagta hai. Pata sirf is se chalta hai ke `rate_limits` mein
koi row nahi banti; test isi ki tasdeeq karta hai.

## 137. Jo cheez chup chaap fail hoti hai, us ke liye ek jagah ho

Email ke fail hone ka **har** tareeqa khamosh hai: key jo kabhi set hi na hui, sending
domain jo verify na hua, provider jo har message reject kare. API upar rehti hai, screens
hari rehti hain, aur har notification alag alag "failed" ho jati hai. Pehla shakhs jise
pata chalta hai wo partner hota hai jo poochta hai ke us ki property manzoor hone ki
khabar kyun nahi aayi.

`GET /admin/notifications/health` chaar number deta hai aur ek **faisla**:

| status | matlab |
|---|---|
| `ok` | ja rahi hain |
| `not_sending` | driver `fake` hai — har message qubool, kahin delivered nahi |
| `stuck` | due waqt se 10 minute upar aur ab bhi qatar mein (job har minute chalta hai) |
| `failing` | pichle ghante mein fail hui, aur ek bhi nahi gayi |

`not_sending` apna alag status hai kyunke wo **theek lagta hai**: local aur tests ke liye
durust setting, aur production mein bilkul aisi jo perfect nazar aati hai.

Dashboard par banner **sirf tab dikhta hai jab masla ho**. Jo dashboard hamesha ek hara
"email: OK" panel rakhe, wo sab ko sikha deta hai ke us panel ko na parhein. Settings page
par line hamesha dikhti hai — wahi jagah hai jahan koi **poochne** aata hai.

Do alag number bhi: `stuck` **`next_attempt_at`** par (do baar fail ho kar backing off
karna rukna nahi, intezar hai), aur `oldestPendingMinutes` **`created_at`** par (qatar mein
kitni der guzri). Dono ek jaise lagte hain aur alag sawal ka jawab dete hain.

## 138. "From" price kaha jaata nahi, nikala jaata hai

Property ka `base_price` wo number hai jis par **search filter karti hai** (`minPrice` /
`maxPrice`) aur jo card par "from $X" bun kar dikhta hai. Ye ek derived column hai —
`recomputeBasePrice` khud kehta hai ke isay "haath se kabhi set nahi karna".

Registration approval yahi kar raha tha. `createEverything` ne `base_price` us sab se
saste **unit** se bhara jo applicant ne form mein likha, lekin usi transaction ne ek
non-refundable plan bhi banaya jo us se **discount par** hai — aur wahi sab se sasti cheez
hai jo koi mehmaan asal mein book kar sakta hai. Yani listing us din live hui jis din us
ne apne hi sab se saste rate se **zyada** qeemat ka ilaan kiya.

Ye cosmetic nahi hai. $369 par bookable property "under $400" ke natije mein **thi hi
nahi** — pehle din se, khamoshi se, wo bookings haar rahi thi jo us ki thin. Aur koi
screen ye ghalat nahi dikhati: card ka number, filter ka number, sab ek doosre se
mutabiq the. Sirf **duniya** se mutabiq nahi the.

Isi liye approval ab plans banane ke baad `recomputeBasePrice(propertyId)` chalata hai.
Aur usool aam hai: **jo column derive hota hai, wo har us jagah derive ho jahan us ke
inputs badalte hain** — warna har naya raasta apni copy of the truth le kar aata hai.

> Ek maujood test ne ghalat tawaqqo likh rakhi thi (`toBe(92_000)`, wahi number jo
> applicant ne type kiya tha). Test green tha aur product ghalat. Test ko theek karna
> pada, na ke code ko test ke mutabiq.

### 138a. Derived column ko likhna **compile error** hona chahiye

Rule #138 ka fix sahi tha magar adhoora: jo cheez comment se mana ki jaye, wo agli baar
phir ho jati hai. `properties.base_price` par comment pehle hi likha tha —
*"Recomputed whenever a rate plan changes; never hand-written"* — aur registration
approval ne phir bhi haath se likh diya.

Ab wo type se mana hai:

```ts
export type NewProperty = Omit<
  typeof properties.$inferInsert,
  "basePrice" | "rankingScore" | "rankedAt"
>
```

Har insert site is se annotated hai. TypeScript ka **excess property checking** object
literal mein `basePrice` dekh kar mana kar deta hai. Jo bug QA ko dhoondna para tha, wo
ab `tsc` pehle second mein pakar leta hai.

> Yeh apni qeemat foran wasool kar gaya: type lagate hi build **doosri** creation path
> par toot gayi ([listing.service.ts](../backend/src/modules/catalog/listing.service.ts)),
> jo `basePrice: 0` likh rahi thi. Number theek tha — magar likhne ka haq usay bhi nahi
> tha, aur ab column ka apna default wahi kaam karta hai.

Aur wo helper jo ghalti ki wajah bana tha — `cheapest(units)`, jis ka comment kehta tha
*"the cheapest room, which is what `from $X` on a card means"* — poora hata diya. Us ka
sirf ek caller tha. **Ghalat mechanism ko rakh kar us ka nateeja theek karna, ghalti ko
agle banday ke liye rakh dena hai.**

### 138b. Path test nahi — invariant test

Bug green suite se guzar gaya kyunke har test ek **raasta** test karta tha, aur jo raasta
kisi ko yaad na raha us ka test bhi nahi tha. Mera pehla regression test bhi wahi ghalti
dobara kar raha tha: sirf registration ka raasta.

Derived column ka **har waqt** ek hi durust value hoti hai. To sawal ye nahi ke "is
endpoint ne recompute kiya?" — sawal ye hai ke **"koi bhi row ghalat to nahi?"** Ye
doosra sawal un endpoints ke liye bhi khud jawab de deta hai jo abhi likhe hi nahi gaye.

[`test/support/invariants.ts`](../backend/test/support/invariants.ts) mein `basePriceDrift`
poori table par ek query chalati hai — har property jis ka stored number us ke rate plans
se ikhtilaf rakhta ho. Jaan boojh kar SQL mein alag likhi gayi hai: **jo check us cheez ko
bula kar likha jaye jise wo check kar raha hai, wo sirf ye sabit karta hai ke function
deterministic hai.**

`invariants.e2e-spec.ts` har wo production raasta chalati hai jo derivation ko hila sakta
hai — plan banana, sasta plan baad mein aana, reprice (dono taraf), room archive, units
badalna — aur har qadam ke baad **poori table** scan karti hai.

> Tasdeeq ki ke test asal mein fail hota hai: `createRatePlan` se recompute hata kar chalaya
> to scan ne teen rows naam le kar ginwa deen (`stored: 0` vs `derived: 30000`). **Jo test
> sirf green rehna jaanta ho, wo test nahi hai.**

### 138c. Seed script bhi ek raasta hai

Type lagane ke baad build do jagah tooti. Doosri jagah **seed script** thi — jo `spec.base`
property par likh rahi thi, aur phir har room ke liye **do** plans banati thi: Flexible us
qeemat par, aur non-refundable us se **15% neeche**.

Yani dev database mein aath ke aath listings apne hi sab se saste rate se zyada qeemat ka
ilaan kar rahi thin. `the-plaza`: card par `$680`, jabke `$578` par bookable.

**Aur ye QA se kabhi nahi pakri jati.** `money.mjs` ne isay 16/16 pass kiya tha — us ne UI
ka number API se milaya, aur dono **ek jaise ghalat** the. Screen ke against screen check
karne se yehi hota hai; sirf duniya ke against check karne se pakra jata hai (yahan: rate
plans, jo asal cheez hai jo guest book karta hai).

Ab seed insert bhi `NewProperty` se annotated hai, aur run ke **aakhir mein** ek set-based
statement har property ka number derive karta hai — plans banne ke baad, kyunke us se
pehle ye sahi ho hi nahi sakta.

> Sabaq: **fixture data bhi ek code path hai.** Jo invariant production paths par lagaya
> jaye aur seed par nahi, wo har developer ki machine par roz toota rehta hai — aur wahi
> data hai jis par sab log product dekhte hain.

## 139. "From $X" ka matlab — faisla, default nahi

`properties.base_price` **advertised** sab se sasta rate hai: active rooms par
active plans mein sab se kam `base_price`. Bas.

Do cheezein asli booking ko is se **neeche** le ja sakti hain, aur dono jaan boojh
kar bahar rakhi hain:

- **Occupancy matrix** — single-occupancy discount aam cheez hai, to akela musafir
  base occupancy se kam deta hai (`occupancyAdjustment` manfi hota hai).
- **Calendar override** — poora off-season sasta ho to wo bhi neeche hai.

Inhein shamil karne ka matlab hota: aisi qeemat ka ilaan jo **sirf ek party size
ke liye, sirf ek hafte mein** sach hai. Aur search abhi **na dates leti hai na
guest count** — to us number ko kis ke against sach hona tha? Kuch bhi nahi.

To headline **standard-occupancy, bina discount wala** rate hai. Jis din search
dates aur guests lena shuru kare, ye tareef us ke saath dobara dekhni hai —
tab "from" ka matlab badalna wajib ho jayega, abhi nahi.

> Ye test se **pin** kiya hua hai (`invariants.e2e-spec.ts`), is liye nahi ke
> doosra padhna ghalat hai — balke isi liye ke **doosra padhna maaqool hai.**
> Jo maaqool mutabadil likha na ho, wo chhe maheene baad ghalti se implement ho
> jata hai, aur koi nahi keh sakta ke faisla kab badla.

## 140. Test suite bahar ki duniya ko haath nahi lagati

Do cheezein jo is session mein kaati:

**Database.** Specs files ke darmiyan `TRUNCATE` karti hain. Wo database jo
`npm run dev` bhi serve kar raha ho, us par ye test setup nahi — **do writers
ki race** hai: seeded catalogue beech run mein ghayab, live request truncate aur
re-insert ke beech aa girti hai, aur failure us spec mein dikhti hai jo us waqt
chal rahi thi. Har baar wo *test ke under wale code* ka bug lagta hai.

`TEST_DATABASE_URL` ab `NODE_ENV=test` par **required** hai — default nahi,
kyunke `DATABASE_URL` par khamosh fallback bilkul wohi haadsa hai jise rokna hai.

**Mail aur storage.** `MAIL_DRIVER=sendgrid` .env mein hona bilkul normal hai jab
mail set ho jaye. Suite ne wohi utha li aur **waqai bhejna shuru kar diya** —
`amelia@example.com`, `queue@example.com`, `race@example.com`. Wo bounce karti
hain, aur sending domain ki judgement bounce rate par hoti hai: qeemat har us
asli confirmation par parti hai jo baad mein jati.

Is liye `NODE_ENV=test` par `MAIL_DRIVER` aur `STORAGE_DRIVER` **zabardasti**
`fake` hain — validate nahi, **override**. Koi aisi configuration hai hi nahi
jis mein test run kisi ajnabi ko email kare.

> Ek run mein 11 asli requests SendGrid tak pahunch gayin (0 delivered, 5 invalid,
> 3 blocked) us se pehle ke ye pakra gaya.

## 141. Jo cheez date se hoti hai, us ka apna job hona chahiye

Teen cheezein sirf is liye hoti hain ke ek **tareekh guzar gayi** — koi click nahi
karta. Ab tak koi bhi nahi hoti thi, aur asar aik doosre par charhta gaya:

`canReview` `status === "completed"` maangta hai. Magar koi cheez booking ko
completed karti hi nahi thi — state machine mein `system → completed` ki ijazat
mojood thi aur comment bhi likha tha *"the nightly sweep closes stays the desk
forgot to check out"*, sweep bas likhi nahi gayi. **Natija: koi mehmaan kabhi
review likh hi nahi sakta tha** — aur jo email us se review maangti, wo bhi
template file mein likhi hui bekar pari thi.

Teen jobs, teen alag locks:

| kab | kya |
|---|---|
| 03:20 | `checked_in` stays band jin ka checkout guzar gaya |
| 09:00 | check-in se ek din pehle reminder |
| 10:00 | checkout ke baad review request |

**`confirmed` ko jaan boojh kar chhora hai.** State machine `confirmed →
completed` mana karta hai, aur theek karta hai: jis booking par kisi ne check-in
kiya hi nahi, wo no-show bhi ho sakti hai — aur ye faisla property ka hai,
ghari ka nahi.

**Har tareekh property ke timezone mein parhi jati hai.** "Kal" is baat ka
haqeeqat nahi ke ye process kahan chal raha hai. Paris aur New York ka din chhe
ghante alag shuru hota hai; server ke calendar par bheji gayi reminder aadhon ko
ek din pehle aur baqi ko us subah milti.

## 142. Do jobs ek lock par = ek job khamoshi se band

`pg_try_advisory_lock` sirf **number** dekhta hai. Do jobs ek hi id par ek doosre
ko rokte hain — aur haarne wala **error nahi deta**: lock leta hai, nakaam hota
hai, aur kuch kiye baghair wapas aa jata hai.

Yehi ho raha tha. **7005 par teen** jobs the aur **7004 par do**:

| id | kaun kaun |
|---|---|
| 7004 | monthly invoice run · **hourly** promotion sweep |
| 7005 | daily ranking · daily overdue invoices · **per-minute** email delivery |

Sab se bura `notificationDelivery` tha — **har minute** chalta hai, yani us ne
lock par qabza kiye rakha. Kisi bhi din ranking recompute ya overdue-invoice
sweep lock bhara paa kar chup chaap chhod deti — na error, na log. Search ranking
ruk jati aur koi na keh sakta kyun.

Ab saare ids [`job-lock.service.ts`](../backend/src/common/scheduling/job-lock.service.ts)
mein **ek jagah** hain — kyunke collision sirf tab **nazar** aati hai jab sab
saath dikhein. Aur `job-lock.spec.ts` unique hone ki tasdeeq karta hai, kyunke
is failure ka koi doosra nishan hai hi nahi.

## 143. Cap bina cursor ke jhoot hai

`releasableFor` aur `billableFor` dono par hard `LIMIT 5000` tha, aur callers
unhein "sab kuch" samajh kar use karte the. Jis org ke ek cycle mein is se zyada
un-invoiced bookings hon, us ki baqi **khamoshi se** payout se bahar reh jatin.

Kho kuch nahi raha tha — dono runs idempotent hain, agla cycle utha leta — magar
**"do hafte late, aur kahin darj nahi ke kyun"** wo cheez nahi jo ek finance
report kar sake.

Ab dono page karte hain (`PAGE = 5000`), `MAX_PAGES` ek asli stop hai, aur wo
stop `error` par **log** hota hai. Farq itna hi hai: "is org ka aur kuch nahi
bacha" aur "ye loop haar gaya" — aur wahi poora nuqta hai.

> Test 5100 bookings ek statement mein banata hai. 5000 se **upar** jaana zaroori
> tha, warna loop kabhi chalta hi nahi aur test sirf pehla page dekh kar khush
> ho jata.

## 144. Permission matrix jo sirf browser mein ho, wo sajawat hai

Admin panel chaar grades ke saath aaya — `super_admin`, `ops`, `finance`,
`support` — poori pandrah-section matrix aur action exceptions ke saath. **Sab
kuch browser mein.** API ek hi sawal poochti thi: *"kya ye admin hai?"*

Yani: finance wala banda URL type kar ke property suspend kar sakta tha, aur
audit log usay bilkul aam kaam ke tor par likh deta.

Teen hisse:

**Ek — matrix `@stayora/shared` mein.** Ek copy, dono taraf. Browser us se tay
karta hai ke **kya draw karna hai**; API us se tay karti hai ke **kya jawab
dena hai** — aur jawab wala faisla hi asal hai.

**Do — `users.platform_role`.** `role` ye batata hai ke account **kis surface**
ka hai; wo ye nahi bata sakta ke admin **kya kar sakta hai**. Column admin ke
liye lazmi hai aur baqi sab ke liye NULL — aur ye **database CHECK** se, is liye
ke customer row par `platform_role = 'super_admin'` har screen par **na-nazar**
aata aur har permission check mein **faisla-kun** hota.

**Teen — `AdminAccessGuard`.** Level HTTP method se nikalta hai, har route par
likha nahi jata: GET → `read`, baqi sab → `manage`. Pachaas routes par haath se
level likhna pachaas mauqe hain POST par `read` likh dene ke — aur wo ghalti
bilkul sahi line jaisi dikhti hai.

> Migration maujooda admins ko `super_admin` deti hai — CHECK lagne se **pehle**,
> warna wo pehle hi admin row par fail ho jati. `super_admin`, sab se mehfooz
> value nahi, aur jaan boojh kar: **ye migration hai, policy tabdeeli nahi.** Jo
> kal kuch kar sakta tha wo aaj bhi kar sakta hai; kisi ko tang karna ek insan ka
> faisla hai, us ke naam ke saath audit line ke sath.
>
> Magar **promote** karna `support` deta hai — sab se tang grade. Kisi ko admin
> banana aur usay sab kuch karne dena **do alag faisle** hain, aur sirf pehla
> maanga gaya tha.

## 145. Search "milta hua" nahi, "mil sakne wala" dikhaye

Search dates leti hi nahi thi. Yani wo us sawal ka jawab de rahi thi jo koi
poochta hi nahi: *hotels jo filters se **match** karte hain* — chahe ek kamra
bhi khali na ho.

Mehmaan New York mein paanch sitare tak narrow karta, ek chunta, aur property
page par pata chalta ke us hafte wo **poora bhara** hai — **chunne ke baad**.

Ab property tabhi aati hai jab us mein **kam az kam ek kamra** ho jo party ko
samaa sake aur stay ki **har raat** khula ho. Qualifying raaton ko gin kar stay
ki lambai se milana — yehi "har raat" ko "koi bhi raat" se alag karta hai: paanch
raat ke stay mein chaar raat khali kamra wo kamra nahi jo ye mehmaan book kar
sake.

Ye check **advisory** hai aur hona bhi chahiye — jawab dete waqt tak snapshot
purana ho chuka hota hai. Overbooking se rokne wala CHECK booking transaction
ke andar hai aur wohi asal mein "na" keh sakta hai. **Is ka kaam sirf itna hai
ke log wo hotels na dekhein jo unhein mil hi nahi sakte.**

Bina dates ke browse karna asli cheez hai aur bilkul pehle jaisa chalta hai —
filter tabhi lagta hai jab koi bataye **kab**.

> **Aadhi range 400 hai.** Akeli tareekh kuch filter nahi kar sakti, to request
> bilkul kamyab search jaisi wapas aati — har hotel par. Yehi wo shakl hai jis se
> koi aisa kamra book karta hai jo kabhi khali tha hi nahi.
