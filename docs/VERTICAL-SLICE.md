# Vertical slice — ek raasta, poora, asli

Backend 11 modules aage hai. Frontend ne use **ek dafa bhi call nahi kiya**:

```
91 frontend files  →  @/data (dummy)
backend ko fetch   →  0
```

Admin surface ka transport layer poora bana hua hai — `request()`, react-query hooks,
loading aur error states — magar wo `src/lib/admin/api/store.ts` (in-memory) se parhta
hai, HTTP se nahi.

Shared contracts sabit karte hain ke **types** ittefaq rakhte hain. Ye sabit **nahi**
karte ke cookie cross-origin jati hai, CORS theek hai, `date` string ban kar wapas aati
hai, cents kahan format hote hain, ya error ka shape wahi hai jo frontend parhta hai.
Ye sirf asli request se pata chalta hai.

**Maqsad:** search → hotel → quote → booking → payment → confirmation, asli API par.

---

## Scouting me do cheezein nikli jo tarteeb badalti hain

### 1. Photos slice ko rok nahi rahi

Pehla andaza tha ke `photos` table likhne layak kiye baghair listing khali dikhegi.
Ghalat nikla:

- `photos.seed` aur `properties.seed` columns **maujood** hain
- detail DTO `seed` **pehle se bhejta hai** (`catalog.service.ts:163`)
- frontend ka `hotelImage(seed)` isi seed se tasveer resolve karta hai

Yaani placeholder ka pul **pehle se juda hua hai**. Asli upload ek alag, baad ka kaam
hai — slice ka blocker nahi.

### 2. Cookie ka ek deployment faisla, abhi nahi magar bhoolna nahi

`sameSite: "lax"` (session.service.ts:72). Dev me theek: `localhost:3000` aur
`localhost:3001` **ek hi site** hain (port site ka hissa nahi hota). Production me
`stayora.com` + `api.stayora.com` bhi ek hi site hain — theek.

**Toot ta yahan hai:** agar API bilkul alag domain par gayi (misal `stayora-api.fly.dev`),
to Lax cross-site XHR par cookie bhejna band kar dega aur har request anonymous ho jayegi.
Us soorat me `sameSite: "none"` + `secure: true` chahiye. Faisla deployment ke waqt.

---

## Tarteeb

| # | Kaam | Kyun pehle |
|---|---|---|
| 1 | **API client** — base URL, `credentials: "include"`, error shape, zod parse | Har baqi cheez isi par khari hai |
| 2 | **Seed script** — ek asli org, property, rooms, rate plans, inventory | Bina data ke wire karne ka koi matlab nahi |
| 3 | **Auth** — signup/login asli API par, session cookie | Quote ko signed-in guest ka tier chahiye (rule #3) |
| 4 | **Search + detail** — `/hotels`, `/hotels/[id]` | Sab se sasta raasta, sab se zyada maloomat |
| 5 | **Quote + booking + payment + confirmation** | Yahan paisa hai — cents, dates aur error shape sab ek sath test hote hain |

Photos ka asli upload (presigned S3, `StorageProvider` port) iske **baad**, apne module
ke tor par.

---

---

## Slice ne kya pakda

Char cheezein, aur **char me se koi bhi** 511 tests me nahi pakdi gayi thi — kyunki
tests dono taraf ek hi process me chalate hain aur strings ko strings se milate hain.

### 1. Har timestamp ghalat shakl me ja raha tha

API bhejta tha `2026-08-21 13:15:28.785077+00` — space, `T` nahi; `+00`, `Z` nahi.
Ye **ECMAScript Date Time String Format se bahar** hai. V8 (Node/Chrome) ise
implementation-defined fallback se parse kar leta hai, isliye dev me chhupa raha.
Faisla-kun saboot ghar ka nikla: **`z.iso.datetime()` ise rad karta hai** — hamare
apne shared contracts hamari hi API ka output refuse kar dete.

**Fix kahan lagi, aur kahan nahi lag sakti:**

| Jagah | Natija |
|---|---|
| Driver (`types.setTypeParser`) | **Namumkin.** drizzle-orm har query me apna `getTypeParser` thopta hai aur TIMESTAMPTZ/TIMESTAMP/DATE/INTERVAL ke liye `(val) => val` hard-code karta hai — global parser kabhi poocha hi nahi jata |
| Schema (`customType` per column) | Sab se usooli, magar timestamp columns 11 modules me bikhre hain — ek column chhoot jaye to khamoshi se wahi bug wapas |
| Har DTO me | Sirf tab tak chalta hai jab tak sab yaad rakhein. Ye invariant nahi, aadat hai |
| **Wire (global interceptor)** | **Yehi.** Ek jagah, bhoola nahi ja sakta, aur `app.module.ts` me register kiya (na ke `main.ts` me) taake **e2e tests me bhi chale** — warna guarantee production me hoti aur test kabhi na hoti |

`YYYY-MM-DD` ko haath nahi lagaya jata: check-in **calendar din** hai, lamha nahi.
Use `T00:00:00Z` banana client ko local time me render karne ki dawat hai — aur
mehmaan ko ghalat din dikhana hotel software ki sab se purani ghalti hai.

### 2. Guest ko pata hi nahi chalta tha ke paisa aaj katega ya nahi

`ratePlans[].paymentMode` public detail me tha hi nahi. Guest "Flexible" aur
"Non-refundable" me se chunta tha bina jaane ke ek **abhi paisa le leta hai**.
Rule #42 kehta hai rate plan faisla karta hai aur client badal nahi sakta — magar
guest ko batana to laazim hai. Ab DTO aur contract dono me hai.

### 3. 15 minute ka hold guest ko dikhta hi nahi tha

`holdExpiresAt` booking DTO me nahi tha. Rule #44 ka hold chal raha hota, guest
payment form par baitha hota, aur booking bina kisi warning ke gayab ho jati.

### 4. Tests aur dev **ek hi database** share karte hain

Poori suite chalate hi `resetDb` seed uda deta hai. Aaj sirf takleef hai; jis din
koi asli data dev DB me rakhega, us din nuqsan hoga. Alag test database chahiye.

---

## Jo is slice se sabit hona chahiye

Ye sawal aaj **kisi test se nahi** guzarte, kyunki dono taraf ek hi process me chalti hain:

- [x] **Session cookie cross-origin** — `Access-Control-Allow-Credentials: true` +
      `Set-Cookie: HttpOnly; SameSite=Lax`, `Origin: localhost:3000` ke sath tasdeeq shuda
- [x] **Preflight** — `OPTIONS /bookings` `Idempotency-Key` aur `x-stayora-session`
      dono ko allow karta hai. Ye do headers baghair booking mumkin hi nahi
- [x] **Error shape** — `ApiError` usi shape ko parhta hai, aur `extras` sambhalta hai
      (409 ka `alternatives` guest ko agla click deta hai, dead end nahi)
- [x] **`date` → JSON** — ISO 8601 interceptor se theek; calendar din chhoora nahi
- [x] **Cents** — adapter unhe bina chhue guzarta hai; format sirf `lib/format`
- [x] **Ek hi contract** — frontend ab `@stayora/shared` se import karta hai, apni copy nahi
- [x] **`Idempotency-Key`** — hook me **ek dafa** banti hai, har retry par nahi (rule #23)
- [x] **Quote token** — reserve card aur checkout dono apna apna token lete hain; checkout
      pehle wala **dobara use nahi karta** (rule #13 ne use lifetime di hai, aur guest ke
      page parhne me wo purana ho jata)

---

## Ab kya wire ho chuka

| Cheez | Haal |
|---|---|
| API client (`lib/api/client.ts`) | `credentials: "include"`, error shape, network error alag |
| Endpoints + react-query hooks | auth · search · detail · quote · booking · payment |
| Adapter (`lib/api/adapt.ts`) | API ke types ↔ UI ke types, ek jagah |
| `/hotels/[id]` | **asli API par** — loading, 404 aur network error alag alag |
| `generateMetadata` | server se fetch, `revalidate: 300` |

### Wire karte hue do bug nikle

**1. `ValueAddUnit` do alag zabanein thin.** Frontend `"per stay"` (space), API `"per_stay"`
(underscore) — aur frontend me **chautha unit tha hi nahi**: `per_person_per_night`, yaani
theek wo jiske liye rule #10 bana tha ("Daily breakfast" per-person laga aur teen raat ke
stay par $32 ek dafa). Frontend ne API ki vocabulary apna li; compiler ne foran
`valueAddPrice()` ka adhoora switch pakad liya, jo ab chautha unit sambhalta hai.

**2. Har page ka title doubled tha.** Root layout ka template `%s · Stayora` hai aur 26
pages apne title me bhi `· Stayora` lagate the — yaani har browser tab aur har SEO title
"About Us · Stayora · Stayora". 26 files theek.

### Booking ka poora raasta ab server par

| Screen | Pehle | Ab |
|---|---|---|
| Reserve card | `priceBooking()` local | `POST /quote`, debounced · **rate plan chunna** (naya) |
| Checkout | local pricing + store write | apna quote · `POST /bookings` (token se) · `POST /payments/start` |
| Confirmation | "Booking Confirmed!" foran | `pending` par **intezaar**, settle hone tak poll |

`priceBooking`, `valueAddPrice` aur `checkAvailability` in teenon me se **nikal chuke hain**.

### Wire karte hue jo nikla

**Booking DTO me guest ka naam aur email tha hi nahi.** Confirmation ko "Thank you, Amelia"
aur "sent to amelia@…" kehna tha aur dono maujood nahi the. Ye session se nikalna mumkin
nahi — guest kisi aur ke liye booking kar sakta hai (booking us ki jo signed in hai, guest
details us ki jo theher raha hai). DTO me `guest` add hua.

**Booking detail me hotel ka live pata nahi tha.** Booking par `propertyName` aur `city`
**snapshot** hain — jaan boojh kar, taake hotel ka naam badalne par bhi reservation wahi
dikhaye jo book hua. Magar guest ko **pahunchna** bhi hai: pata, check-in ka waqt, aur ek
link jo aaj ke hotel par jaye. Wo live hain, aur alag sawal hain. `detail` ab dono deta hai.

**Add-on picker ka daam.** Server sirf **chune hue** extras ko price karta hai. Un-ticked
box ka total yahan nikalna wahi hisaab wapas laata jo "Daily breakfast" ko teen raat ke
liye ek dafa charge kar chuka tha. Ab unit price aur unit dikhta hai; tick karte hi asli
raqam summary me aati hai.

### Auth ab asli hai

Login aur signup **sirf ek toast dikha kar `/dashboard` par bhej dete the** — koi session
banta hi nahi tha. Yaani upar wala poora booking raasta sirf us session par chalta jo
curl se banaya gaya ho; asli user wahan pahunch hi nahi sakta tha.

- Dono form ab **API ke apne schema** se validate karte hain (`loginSchema`, `signupSchema`),
  apni copy se nahi
- Signup ke baad **dashboard par nahi** bhejta — API jaan boojh kar session nahi deta
  (rule #58), to "check your email" keh kar login par bhejta hai
- `?next=` sambhalta hai: checkout se aaya guest checkout par wapas jata hai, apni dates
  aur room kho kar dashboard par nahi. Relative path hi qubool, warna ye open redirect hota
- Signup me **do naam ke khane** — API `firstName` aur `lastName` alag rakhta hai, aur ek
  "Full name" ko space par todna "Mary Jane Watson" ko kharab kar deta hai

Tasdeeq: naya account bana, dobara wahi email dene par **wahi ek jawab**, login se session,
aur ghalat password aur na-maujood account dono ke liye **ek hi message**.

### Do cheezein jo build ne pakdin

**1. Turbopack `@stayora/shared` resolve nahi kar pa raha tha.** Aur ye sirf **ab** nikla:
pehle us package se sirf **types** import hote the, jo compile par mit jate hain aur
Turbopack tak pahunchte hi nahi. `loginSchema` ek asli value hai, to bundler ko wo file
dhoondni padi — aur Turbopack apne root se bahar kuch resolve nahi karta. Root wo lockfile
se chunta hai, yaani `frontend/`, aur `shared/` bahar reh gaya. `turbopack.root` ko repo
root par le jane se theek. Docs isi soorat ka naam le kar zikr karte hain.

**2. `useSearchParams()` ko Suspense chahiye.** Bina us ke page prerender ho hi nahi sakta.
Login ab do hisson me hai: page (Suspense ke sath) aur form. Fallback wahi card hai jiske
khane grey hain, to form aane par page uchalta nahi.

### `/hotels` search ab API par

Ab tak wo poora catalogue memory me rakh kar client me filter karta tha — jo fixture ke
sath chalta tha aur asli catalogue ke sath chal hi nahi sakta: dus hotel dikhane ke liye
browser ko platform ka har hotel utarna padta.

Ab server filter karta hai: `city`, `type`, `maxPrice`, `minStars`, `amenities`, `sort`.

**Amenity ka slug bhejta hai, label nahi** (rule #74). HTTP par sabit:

```
?amenities=Free%20WiFi   →  0 results
?amenities=wifi          →  8 results
```

Filter ke options **platform ki vocabulary** se aate hain (`GET /amenities`), nateejon se
nahi — warna har dafa nateeje badalne par options badalte, aur jo amenity sab kuch filter
kar deti wo panel se hi gayab ho jati.

### Do filter jinke peeche kuch tha hi nahi

**Room type** — search API me aisa koi filter hai hi nahi. Hata diya; yahan karne ka
matlab hai phir se har hotel utarna.

**Guest rating** — API `minStars` par filter karta hai, jo **alag cheez hai** (listing ka
star rating, mehmaanon ka score nahi). Panel ab stars par filter karta hai, jo API waqai
kar sakta hai.

`recommended` aur `rating` dono `price_asc` par girte hain: API sirf price aur naam par
sort karta hai. **Mojooda page ko** browser me rating par sort karna is se bura hota —
sheher ka sab se behtar hotel page teen par ho sakta hai.

### Card par daam — aur ek gap jo darj karna zaroori hai

Card ab **"from $X / night"** dikhata hai, dates ka poora total nahi. Wo total
`priceBooking()` se banta tha, aur ab wo ghalat hai.

Magar asal wajah gehri hai: **search endpoint dates leta hi nahi.** To API kisi stay ka
daam bata hi nahi sakta — aur client me banana wahi jhoot hai jo hata raha hoon. Card ab
kehta hai *"Final price shown when you pick your dates"*, aur asli daam detail page se
aata hai.

**Dates-aware search pricing apna kaam hai** — API ko bahut si properties ke liye
per-date rates nikalne honge. Wo abhi nahi hai, aur us ka na hona ab saaf likha hai.

### Teesri dafa: ek aur do-zaban vocabulary

`PropertyType` frontend me `"Hotel"` tha, API me `"hotel"`. Bilkul wahi jo `ValueAddUnit`
me tha. API ki zaban apna li.

### Abhi baqi

Dashboard aur extranet ke `priceBooking` callers — API server-side filter + cursor pagination
karta hai jabke wo poore catalogue par client-side filter karta hai; wo apna refactor hai.
Reserve card abhi frontend ke apne `priceBooking` par hai, asli quote par nahi. Checkout
wire nahi hua.
