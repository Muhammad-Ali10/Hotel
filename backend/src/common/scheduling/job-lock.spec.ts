import { describe, expect, it } from "vitest"

import { JOB_LOCKS } from "./job-lock.service"

/* ============================================================================
 * Two jobs must never share a lock id.
 *
 * `pg_try_advisory_lock` keys on the number alone. Two jobs holding the same
 * one exclude each other — and the loser does not throw, log, or retry. It
 * takes the lock, fails, and returns having done nothing.
 *
 * That is why this is a test rather than a code review note. Three jobs shared
 * 7005 and two shared 7004 for as long as the ids lived in five separate
 * files, and the only symptom was a search ranking that stopped moving and
 * overdue invoices nobody chased. Nothing anywhere said why.
 * ========================================================================== */

describe("job locks", () => {
  it("gives every job an id of its own", () => {
    const entries = Object.entries(JOB_LOCKS)
    const byId = new Map<number, string[]>()

    for (const [name, id] of entries) {
      byId.set(id, [...(byId.get(id) ?? []), name])
    }

    const shared = [...byId.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([id, names]) => `${id}: ${names.join(", ")}`)

    // Named in the message, because "expected 12 to be 13" would send the
    // next person looking in the wrong place entirely.
    expect(shared).toEqual([])
    expect(new Set(Object.values(JOB_LOCKS)).size).toBe(entries.length)
  })

  it("keeps them in one range, so a future one is obviously a job lock", () => {
    /*
     * Advisory locks share a namespace with anything else in the database that
     * takes one. Keeping every job in 7000-7999 means a number outside it is
     * visibly not ours, and a collision with some future feature's lock is a
     * thing somebody can see rather than debug.
     */
    for (const [name, id] of Object.entries(JOB_LOCKS)) {
      expect(id, `${name} is outside the job-lock range`).toBeGreaterThanOrEqual(7_000)
      expect(id, `${name} is outside the job-lock range`).toBeLessThan(8_000)
    }
  })
})
