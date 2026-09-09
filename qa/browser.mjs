import { chromium } from "playwright-core"

import { CHROME, PASSWORD, WEB, freshIp } from "./env.mjs"

/* ============================================================================
 * A real browser, driven the way a person drives one.
 *
 * Runs against the PRODUCTION build (`next start`), never the dev server: dev
 * compiles each route on first request, which turns "did this screen load" into
 * "did it compile in under three seconds" and reports half-fetched tables as
 * empty ones.
 * ========================================================================== */

export async function open() {
  return chromium.launch({ executablePath: CHROME, headless: true })
}

export async function tab(browser, { width = 1280, height = 800 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  return { context, page }
}

/**
 * Signs in through the actual form.
 *
 * Not by planting a cookie: the form is what a person uses, and a login that
 * only works when a test bypasses it is a login nobody has tested.
 */
export async function signIn(page, email) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": freshIp() })

  await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("#email", { timeout: 20000 })
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(300)

  await page.fill("#email", email)
  await page.fill("#password", PASSWORD)

  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", {
      timeout: 25000,
    }),
    page.click('button[type="submit"]'),
  ])
  if (!res.ok()) throw new Error(`login ${email}: HTTP ${res.status()}`)

  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }).catch(() => {})
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {})
  return page.url()
}

export async function visit(page, route, settle = 4000) {
  await page.goto(`${WEB}${route}`, { waitUntil: "domcontentloaded", timeout: 25000 })
  await page.waitForLoadState("networkidle", { timeout: settle }).catch(() => {})
  await page.waitForTimeout(200)
}

/** The page's visible text, whitespace collapsed — what a person can read. */
export const text = (page) =>
  page
    .locator("body")
    .innerText()
    .then((t) => t.replace(/\s+/g, " "))
    .catch(() => "")

/**
 * A request made from INSIDE a signed-in page, so the session cookie rides
 * along and CORS applies exactly as it does for the app.
 */
export async function ask(page, url, init = {}) {
  return page.evaluate(
    async ([target, options]) => {
      const res = await fetch(target, { credentials: "include", ...options })
      let body = null
      try {
        body = await res.json()
      } catch {
        /* no body */
      }
      return { status: res.status, body }
    },
    [url, init]
  )
}
