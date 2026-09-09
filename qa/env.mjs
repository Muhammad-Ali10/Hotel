/* ============================================================================
 * Where everything is, and how to sign in.
 *
 * One file, because every suite needs the same four facts and a suite that
 * carries its own copy is a suite that keeps a stale one.
 * ========================================================================== */

export const WEB = process.env.QA_WEB ?? "http://localhost:3000"
export const API = process.env.QA_API ?? "http://localhost:4000/api/v1"
export const PASSWORD = "correct horse battery staple"

export const CHROME =
  process.env.QA_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe"

export const ACCOUNTS = {
  guest: "guest@stayora.test",
  partner: "owner@aurora.test",
  admin: "admin@stayora.test",
}

/* -------------------------------------------------------------- reporting */

export function reporter(title) {
  const results = []
  console.log(`\n${"=".repeat(64)}\n  ${title}\n${"=".repeat(64)}`)

  return {
    section(name) {
      console.log(`\n${name}\n`)
    },
    check(name, pass, detail = "") {
      results.push({ name, pass, detail })
      console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? `   (${detail})` : ""}`)
    },
    /** Exit code 1 on any failure, so `npm run all` can stop meaning nothing. */
    finish() {
      const failed = results.filter((r) => !r.pass)
      console.log(`\n${"-".repeat(64)}`)
      console.log(`  ${results.length - failed.length}/${results.length} passed`)
      if (failed.length) {
        console.log("\n  FAILED\n")
        for (const f of failed) console.log(`    ${f.name}  —  ${f.detail}`)
      }
      console.log("")
      return failed.length
    },
  }
}

/* ------------------------------------------------------------------ HTTP */

/*
 * A fresh client address per sign-in.
 *
 * Login is the tightest bucket in the product (5/min per client), and a suite
 * that signs in a dozen times from one machine is one client. Real traffic is
 * many people from many addresses; this is what that looks like, and it stops
 * the limiter from being what the suite measures.
 */
let run = 0
export const freshIp = () => `198.51.100.${(run += 1) % 250}`

/** Signs in over HTTP and returns the cookie header. No browser involved. */
export async function login(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": freshIp() },
    body: JSON.stringify({ email, password: PASSWORD, remember: false }),
  })
  if (!res.ok) throw new Error(`login ${email}: HTTP ${res.status}`)
  return res.headers.getSetCookie().join("; ")
}

export async function get(path, cookie) {
  const res = await fetch(`${API}${path}`, { headers: cookie ? { cookie } : {} })
  return { status: res.status, body: res.ok ? await res.json().catch(() => null) : null }
}

/**
 * The list endpoints answer in two shapes and always have.
 *
 * `/admin/reservations` is a keyset envelope; the guest and partner lists were
 * bare arrays until they were paginated. Reading both without caring which is
 * one line here and was two broken suites before it existed.
 */
export const rows = (body) => (Array.isArray(body) ? body : (body?.items ?? []))
