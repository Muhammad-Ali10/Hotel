import { ACCOUNTS, reporter } from "../env.mjs"
import { open, signIn, tab, text, visit } from "../browser.mjs"

/* ============================================================================
 * Every surface, every role, both directions.
 *
 * Both directions is the point. A suite that only checks the doors open for
 * the right people passes just as happily on a product with no locks at all —
 * which is what this found the first time it ran: `/extranet` and `/dashboard`
 * had no guard, and a signed-out visitor typing the URL walked straight in.
 *
 * CLOSED has two shapes, because the product refuses two different things two
 * different ways:
 *
 *   · **no session** — a missing step, not a permission problem, so it sends
 *     you to /login?next=… and brings you back afterwards.
 *   · **wrong role** — signing in again would not help, so it stays on the URL
 *     and says so. A guest at the extranet door is told where their own door is.
 *
 * Only those two count. A blank shell, a spinner that never resolves, a page
 * of chrome with no data — all OPEN, because the person is still standing
 * inside it. That distinction is the whole value of this file: the first run
 * found `/extranet` and `/dashboard` rendering their full shell to a signed-out
 * stranger, which a laxer check would have called "closed enough".
 * ========================================================================== */

/** The one phrase every wrong-role refusal shares, whatever door it is. */
const REFUSED = "belongs to a different kind of account"

const DASHBOARD = [
  "/dashboard",
  "/dashboard/bookings",
  "/dashboard/favorites",
  "/dashboard/reviews",
  "/dashboard/notifications",
  "/dashboard/profile",
  "/dashboard/settings",
]

const EXTRANET = [
  "/extranet",
  "/extranet/rates/calendar",
  "/extranet/reservations",
  "/extranet/finance/payouts",
  "/extranet/property/photos",
  "/extranet/inbox",
  "/extranet/account/contracts",
  "/extranet/analytics/performance",
]

const ADMIN = [
  "/admin",
  "/admin/properties",
  "/admin/reservations",
  "/admin/finance/payouts",
  "/admin/users",
  "/admin/settings",
  "/admin/audit",
]

/*
 * Who may stand where.
 *
 * `/dashboard` asks only that you are SIGNED IN — it is the account area, and
 * a partner has an account like anyone else. `/extranet` and `/admin` ask for
 * a role.
 */
const ROLES = [
  { name: "SIGNED OUT", email: null, opens: [] },
  { name: "GUEST", email: ACCOUNTS.guest, opens: DASHBOARD },
  { name: "PARTNER", email: ACCOUNTS.partner, opens: [...DASHBOARD, ...EXTRANET] },
  { name: "ADMIN", email: ACCOUNTS.admin, opens: [...DASHBOARD, ...ADMIN] },
]

const ALL = [...DASHBOARD, ...EXTRANET, ...ADMIN]

const report = reporter("GUARDS — every surface × every role")
const check = report.check
const browser = await open()

for (const role of ROLES) {
  report.section(`${role.name} — ${role.opens.length} of ${ALL.length} surfaces should open`)

  const { context, page } = await tab(browser)
  if (role.email) await signIn(page, role.email)

  for (const route of ALL) {
    const shouldOpen = role.opens.includes(route)

    const label = `${route} → ${shouldOpen ? "opens" : "does not open"}`

    let landed = ""
    let body = ""
    try {
      await visit(page, route, 3500)

      /*
       * Wait for the DECISION, not for a fixed number of milliseconds.
       *
       * The guard renders "Checking your access…" until /auth/me answers, and
       * a timer that expires first reads the spinner as an open door. This
       * suite reported nine false failures that way before the wait was here.
       */
      await page
        .waitForFunction(
          () => !document.body.innerText.includes("Checking your access"),
          undefined,
          { timeout: 10000 }
        )
        .catch(() => {})

      landed = new URL(page.url()).pathname
      body = await text(page)
    } catch (error) {
      check(label, false, String(error.message).slice(0, 60))
      continue
    }

    const sentToLogin = landed.startsWith("/login")
    const toldItIsNotTheirs = body.includes(REFUSED)
    const opened = !sentToLogin && !toldItIsNotTheirs

    check(
      label,
      opened === shouldOpen,
      opened === shouldOpen
        ? ""
        : opened
          ? `stayed on ${landed} and rendered the surface`
          : sentToLogin
            ? "sent to /login"
            : "told it is not theirs"
    )
  }

  await context.close()
}

await browser.close()
process.exit(report.finish() > 0 ? 1 : 0)
