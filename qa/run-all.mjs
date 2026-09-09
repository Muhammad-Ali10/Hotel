import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

import { API, WEB } from "./env.mjs"

/* ============================================================================
 * Every suite, in the order that makes each one's failures readable.
 *
 * `smoke` first: it creates the booking the later suites read, and if the
 * critical path is broken there is no point learning that eleven screens also
 * disagree about it.
 *
 * Each suite is its own process. A browser that hangs, a suite that throws on
 * import, an `process.exit` — none of it can take the others down with it.
 * ========================================================================== */

const SUITES = ["smoke", "guards", "boundaries", "money"]

const here = path.dirname(fileURLToPath(import.meta.url))

async function reachable(url, what) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    return res.status < 500
  } catch {
    console.error(`\n  ${what} is not answering at ${url}`)
    return false
  }
}

/*
 * Checked before anything runs, because "every check failed" and "nothing was
 * running" look identical in a report and mean completely different things.
 */
const up = [await reachable(`${WEB}/`, "the frontend"), await reachable(`${API}/health`, "the API")]
if (up.includes(false)) {
  console.error("\n  Start both, then try again. See README.md.\n")
  process.exit(2)
}

const run = (name) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(here, "suites", `${name}.mjs`)], {
      stdio: "inherit",
    })
    child.on("close", (code) => resolve({ name, code: code ?? 1 }))
  })

const results = []
for (const suite of SUITES) results.push(await run(suite))

console.log(`\n${"=".repeat(64)}`)
for (const { name, code } of results) {
  console.log(`  ${code === 0 ? "PASS" : "FAIL"}  ${name}`)
}
console.log(`${"=".repeat(64)}\n`)

process.exit(results.some((r) => r.code !== 0) ? 1 : 0)
