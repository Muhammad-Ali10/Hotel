import { API, ACCOUNTS, WEB, get, login, reporter, rows } from "../env.mjs"

/* ============================================================================
 * The critical path, end to end, through the real API.
 *
 * Not a substitute for the browser suites — it says nothing about what a page
 * RENDERS. It answers the narrower question worth asking after any restart:
 * does one booking still travel correctly from a guest, to the partner who
 * must honour it, to the platform that must account for it.
 * ========================================================================== */

const report = reporter("SMOKE — one booking, three surfaces")
const check = report.check

/* -------------------------------------------------------- the marketplace */
console.log("\nTHE MARKETPLACE IS SERVING\n")

const search = await get("/properties?city=New%20York&limit=5")
check("search returns listings", rows(search.body).length > 0, `${rows(search.body).length} in New York`)

const detail = await get("/properties/the-plaza")
const room = detail.body?.rooms?.[0]
const plan = room?.ratePlans?.[0]
check("a property page has rooms and rates", Boolean(plan), `${detail.body?.rooms?.length} rooms`)

/* The number search filters on must equal the cheapest plan actually offered. */
const cheapest = Math.min(
  ...detail.body.rooms.flatMap((r) => r.ratePlans.map((p) => p.basePrice))
)
check(
  "the from-price matches the cheapest bookable rate",
  detail.body.fromPrice === cheapest,
  `from ${detail.body.fromPrice}, cheapest ${cheapest}`
)

/* ------------------------------------------------------------- a booking */
console.log("\nA GUEST BOOKS\n")

const guest = await login(ACCOUNTS.guest)

const quoteRes = await fetch(`${API}/properties/the-plaza/quote`, {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie: guest },
  body: JSON.stringify({
    roomId: room.id,
    ratePlanId: plan.id,
    checkIn: "2027-03-08",
    checkOut: "2027-03-11",
    adults: 2,
    children: 0,
  }),
})
const quote = quoteRes.ok ? await quoteRes.json() : null
check("the server quotes a price", Boolean(quote?.quoteToken), `${quote?.pricing?.total} cents`)

const bookRes = await fetch(`${API}/bookings`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    cookie: guest,
    "Idempotency-Key": `smoke-${Date.now()}`,
  },
  body: JSON.stringify({
    quoteToken: quote.quoteToken,
    guest: {
      firstName: "Amelia",
      lastName: "Hart",
      email: "guest@stayora.test",
      phone: "+1 212 555 0143",
      country: "USA",
    },
  }),
})
const made = bookRes.ok ? await bookRes.json() : null
const booking = made?.booking ?? made
const ref = booking?.ref ?? booking?.reference
check("the booking is created", Boolean(ref), ref)

const mine = await get("/bookings", guest)
check(
  "the guest sees it in their own list",
  rows(mine.body).some((b) => (b.ref ?? b.reference) === ref),
  `${rows(mine.body).length} bookings`
)

/* ------------------------------------------------- and the others see it */
console.log("\nTHE PARTNER AND THE PLATFORM AGREE\n")

const partner = await login(ACCOUNTS.partner)
const theirs = await get("/partner/bookings?limit=50", partner)
const partnerRow = rows(theirs.body).find((b) => (b.ref ?? b.reference) === ref)
check("the partner sees the same booking", Boolean(partnerRow), partnerRow?.ref)
const guestTotal = booking?.pricing?.total ?? booking?.total
const partnerTotal = partnerRow?.pricing?.total ?? partnerRow?.total
check(
  "for the same money",
  partnerTotal === guestTotal,
  `partner ${partnerTotal} vs guest ${guestTotal}`
)

const admin = await login(ACCOUNTS.admin)
const platform = await get("/admin/reservations?limit=50", admin)
const adminRow = rows(platform.body).find((b) => (b.ref ?? b.reference) === ref)
check("the platform sees it too", Boolean(adminRow), adminRow?.ref)

const health = await get("/admin/notifications/health", admin)
check(
  "nothing is stuck in the mail queue",
  health.body?.stuck === 0 && health.body?.failedLastHour === 0,
  `${health.body?.status} · ${health.body?.pending} pending`
)

/* ---------------------------------------------------------- pages render */
console.log("\nTHE PAGES ANSWER\n")

for (const route of ["/", "/hotels", `/hotels/the-plaza`, "/login", "/support"]) {
  const res = await fetch(`${WEB}${route}`)
  check(`${route}`, res.status === 200, `HTTP ${res.status}`)
}

process.exit(report.finish() > 0 ? 1 : 0)
