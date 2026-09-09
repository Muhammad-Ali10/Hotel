import { ACCOUNTS, API, WEB, get, login, reporter, rows } from "../env.mjs"
import { open, signIn, tab, text, visit } from "../browser.mjs"

/* ============================================================================
 * Does the number on the screen equal the number the server sent.
 *
 * Money is stored in CENTS everywhere and rendered in dollars, so every figure
 * crosses one division on its way to a person. Get it wrong in one direction
 * and a $640 stay is billed as $64,000; wrong in the other and it is $6.40.
 * Both have shipped in this codebase.
 *
 * Every check here is TWO-SIDED: the right figure must be present AND both
 * wrong ones must be absent. Asserting only the first passes on a page showing
 * "$640 $64,000" side by side, which is exactly what a half-migrated formatter
 * produces.
 * ========================================================================== */

const report = reporter("MONEY — every figure against the API")
const check = report.check

const dollars = (cents) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)

/**
 * Is this exact figure on the page — not merely these characters?
 *
 * `"$725".includes("$7")` is true, and a substring check reported a correct
 * page as broken for exactly that reason. A figure ends where a digit, comma
 * or decimal point stops following it.
 */
function shows(body, figure) {
  let from = 0
  for (;;) {
    const at = body.indexOf(figure, from)
    if (at === -1) return false
    const after = body[at + figure.length] ?? " "
    if (!/[0-9,.]/.test(after)) return true
    from = at + 1
  }
}

/** The right number is there, and neither way of getting it wrong is. */
function figure(label, body, cents) {
  const right = dollars(cents)
  const asIfDollars = dollars(cents * 100) // cents rendered as dollars
  const dividedTwice = dollars(cents / 100) // divided on the server AND the client

  const present = shows(body, right)
  const wrongHigh = shows(body, asIfDollars)
  const wrongLow = cents >= 100 && shows(body, dividedTwice)

  check(
    `${label}   ${right}`,
    present && !wrongHigh && !wrongLow,
    present ? (wrongHigh ? `also shows ${asIfDollars}` : wrongLow ? `also shows ${dividedTwice}` : "") : "missing"
  )
}

const browser = await open()

/* -------------------------------------------------------- the marketplace */

report.section("PUBLIC MARKETPLACE")
{
  const { context, page } = await tab(browser)

  const search = await get("/properties?city=New%20York&limit=6")
  await visit(page, "/hotels", 6000)
  const listing = await text(page)
  for (const property of rows(search.body).slice(0, 4)) {
    figure(`search card · ${property.name}`, listing, property.fromPrice)
  }

  const detail = await get("/properties/the-plaza")
  await visit(page, "/hotels/the-plaza", 6000)
  const propertyPage = await text(page)

  const cheapest = Math.min(
    ...detail.body.rooms.flatMap((room) => room.ratePlans.map((plan) => plan.basePrice))
  )
  figure("property page · cheapest rate", propertyPage, cheapest)

  await context.close()
}

/* --------------------------------------------------------- one booking */

report.section("THE SAME BOOKING, THREE SURFACES")
{
  const admin = await login(ACCOUNTS.admin)
  const reservations = await get("/admin/reservations?limit=5", admin)
  const booking = rows(reservations.body)[0]

  if (!booking) {
    check("there is a booking to check", false, "none found — run qa smoke first")
  } else {
    const total = booking.pricing?.total ?? booking.total

    const { context, page } = await tab(browser)
    await signIn(page, ACCOUNTS.admin)
    await visit(page, "/admin/reservations", 6000)
    figure(`admin reservations · ${booking.ref}`, await text(page), total)
    await context.close()

    const partnerTab = await tab(browser)
    await signIn(partnerTab.page, ACCOUNTS.partner)
    /*
     * The extranet is a PER-PROPERTY surface: its reservations screen filters
     * on the property chosen in the switcher, which lives in localStorage. A
     * test that skips this reads an empty table and calls it a missing figure.
     */
    await partnerTab.page.evaluate(
      (id) => window.localStorage.setItem("stayora.extranet.property", id),
      booking.propertyId
    )
    await visit(partnerTab.page, "/extranet/reservations", 6000)
    figure(`extranet reservations · ${booking.ref}`, await text(partnerTab.page), total)
    await partnerTab.context.close()
  }
}

await browser.close()
process.exit(report.finish() > 0 ? 1 : 0)
