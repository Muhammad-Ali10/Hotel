import { ACCOUNTS, API, PASSWORD, WEB, reporter } from "../env.mjs"
import { ask, open, signIn, tab, text } from "../browser.mjs"

/* ============================================================================
 * What happens when somebody asks for something that is not theirs.
 *
 * The role sweep proves each surface opens for the right people. This is the
 * other half: a signed-in account naming a record that belongs to somebody
 * else. Those requests are well-formed and authenticated, and the only thing
 * between them and the data is whether the query is scoped.
 *
 * OWASP API1 — the failure no amount of role checking catches, because the
 * caller has the right role and the wrong id.
 * ========================================================================== */

const report = reporter("BOUNDARIES — somebody else's data")
const check = report.check
const browser = await open()

const asUser = async (email) => {
  const t = await tab(browser)
  if (email) await signIn(t.page, email)
  return t
}

/* ------------------------------------------------- a second guest to rob */

const victimEmail = `qa-victim-${Date.now()}@example.test`
let victimBookingId = null

{
  const { context, page } = await asUser()
  await page.goto(`${WEB}/signup`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)

  const signedUp = await page.evaluate(
    async ([api, email, password]) => {
      const created = await fetch(`${api}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, firstName: "Vera", lastName: "Novak" }),
      })
      if (!created.ok) return false
      const login = await fetch(`${api}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember: false }),
      })
      return login.ok
    },
    [API, victimEmail, PASSWORD]
  )
  check("a second guest account exists", signedUp, victimEmail)

  if (signedUp) {
    const property = await (await fetch(`${API}/properties/the-plaza`)).json()
    const room = property.rooms[0]
    const plan = room.ratePlans[0]

    const made = await page.evaluate(
      async ([api, roomId, planId]) => {
        const quoted = await fetch(`${api}/properties/the-plaza/quote`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            ratePlanId: planId,
            checkIn: "2027-01-12",
            checkOut: "2027-01-14",
            adults: 2,
            children: 0,
          }),
        })
        if (!quoted.ok) return null
        const quote = await quoted.json()

        const booked = await fetch(`${api}/bookings`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `qa-victim-${Date.now()}`,
          },
          body: JSON.stringify({
            quoteToken: quote.quoteToken,
            guest: {
              firstName: "Vera",
              lastName: "Novak",
              email: "vera.qa@example.test",
              phone: "+1 212 555 0199",
              country: "USA",
            },
          }),
        })
        return booked.ok ? await booked.json() : null
      },
      [API, room.id, plan.id]
    )
    victimBookingId = (made?.booking ?? made)?.id ?? null
    check("that guest has a booking of their own", Boolean(victimBookingId))
  }

  await context.close()
}

/* ============================================ a guest reaching for another */

if (victimBookingId) {
  report.section("ONE GUEST, ANOTHER GUEST'S BOOKING")
  const { context, page } = await asUser(ACCOUNTS.guest)

  const read = await ask(page, `${API}/bookings/${victimBookingId}`)
  check("cannot read it", read.status === 403 || read.status === 404, `HTTP ${read.status}`)

  const cancelBody = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "changed my plans" }),
  }
  const cancel = await ask(page, `${API}/bookings/${victimBookingId}/cancel`, cancelBody)
  check("cannot cancel it", cancel.status === 403 || cancel.status === 404, `HTTP ${cancel.status}`)

  /*
   * The subtler half. Refusing is not enough if the refusal DIFFERS for a
   * booking that exists and one that does not — that difference alone is an
   * oracle for enumerating real ids.
   */
  const ghost = "01a00000-0000-7000-8000-000000000000"
  const ghostRead = await ask(page, `${API}/bookings/${ghost}`)
  const ghostCancel = await ask(page, `${API}/bookings/${ghost}/cancel`, cancelBody)
  check(
    "a real booking and an imaginary one answer alike",
    read.status === ghostRead.status && cancel.status === ghostCancel.status,
    `read ${read.status}/${ghostRead.status} · cancel ${cancel.status}/${ghostCancel.status}`
  )

  await page.goto(`${WEB}/dashboard/bookings/${victimBookingId}`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(3000)
  const shown = await text(page)
  check(
    "the deep link shows nothing of it",
    !shown.includes("Vera") && !shown.includes("vera.qa"),
    shown.slice(0, 60)
  )

  await context.close()
}

/* ================================================ reaching across surfaces */

report.section("A GUEST REACHING INTO THE PARTNER AND ADMIN APIS")
{
  const { context, page } = await asUser(ACCOUNTS.guest)
  const paths = [
    "/partner/properties",
    "/partner/bookings",
    "/partner/payouts",
    "/partner/invoices",
    "/admin/listings?limit=5",
    "/admin/users?limit=5",
    "/admin/registrations",
  ]
  for (const path of paths) {
    const res = await ask(page, `${API}${path}`)
    check(`${path} is refused`, res.status === 403 || res.status === 401, `HTTP ${res.status}`)
  }
  await context.close()
}

report.section("A PARTNER REACHING INTO THE PLATFORM API")
{
  const { context, page } = await asUser(ACCOUNTS.partner)
  const paths = [
    "/admin/registrations",
    "/admin/users?limit=5",
    "/admin/finance/overview?from=2026-01-01&to=2026-12-31",
  ]
  for (const path of paths) {
    const res = await ask(page, `${API}${path}`)
    check(`${path} is refused`, res.status === 403, `HTTP ${res.status}`)
  }

  const nobodys = "01a00000-0000-7000-8000-000000000000"
  const patched = await ask(page, `${API}/partner/rate-plans/${nobodys}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ basePrice: 100 }),
  })
  check(
    "a rate plan that is not theirs is refused",
    patched.status === 403 || patched.status === 404,
    `HTTP ${patched.status}`
  )
  await context.close()
}

/* ================================================== the limiter, for real */

report.section("THE RATE LIMITER ACTUALLY REFUSES")
{
  /*
   * From node, not from the page: a browser will not send `x-forwarded-for` on
   * a cross-origin fetch unless the server names it in the preflight, so an
   * in-page attempt measures CORS instead of the limiter.
   */
  const attempt = (ip) =>
    fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({
        email: "nobody@example.test",
        password: "not the right password",
        remember: false,
      }),
    }).then((r) => r.status)

  const seen = []
  for (let i = 0; i < 9; i += 1) seen.push(await attempt("198.51.100.77"))
  check(
    "a password list is cut off",
    seen.some((s) => s === 429),
    `${seen.filter((s) => s === 429).length} of 9 refused`
  )

  const bystander = await attempt("198.51.100.78")
  check("a bystander is not blocked by it", bystander !== 429, `HTTP ${bystander}`)
}

/* ============================================================== not found */

report.section("WHAT A WRONG URL DOES")
{
  const { context, page } = await asUser()

  await page.goto(`${WEB}/hotels/no-such-hotel`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500)
  const missing = await text(page)
  check(
    "a property that does not exist says so",
    /not found|no longer listed/i.test(missing),
    missing.slice(0, 50)
  )

  await page.goto(`${WEB}/nowhere-at-all`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)
  const unknown = await text(page)
  check("an unknown route says so", /not found|404/i.test(unknown), unknown.slice(0, 50))

  await context.close()
}

await browser.close()
process.exit(report.finish() > 0 ? 1 : 0)
