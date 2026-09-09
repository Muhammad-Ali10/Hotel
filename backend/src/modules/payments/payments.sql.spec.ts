import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { describe, expect, it } from "vitest"

import { payments } from "../../db/schema"

/**
 * `payments_one_live_primary` is a PARTIAL unique index, and Postgres will
 * only accept an `ON CONFLICT` that names its predicate — without one it
 * cannot tell which index is meant and refuses the statement.
 *
 * TypeScript is happy either way, and the failure only appears the first time
 * two people click "Pay now" at once. So the generated SQL is asserted here,
 * where a wrong option name is a red test rather than a 500 in production.
 */
describe("the ON CONFLICT clause guarding double charges", () => {
  const db = drizzle({ connection: "postgres://unused", casing: "snake_case" })

  it("carries the partial index predicate", () => {
    const query = db
      .insert(payments)
      .values({
        bookingId: "00000000-0000-0000-0000-000000000000",
        kind: "charge",
        amount: 1_000,
        provider: "fake",
      })
      .onConflictDoNothing({
        target: payments.bookingId,
        where: sql`kind IN ('charge', 'guarantee') AND status NOT IN ('failed', 'cancelled')`,
      })

    const { sql: text } = query.toSQL()

    // The predicate must sit between the conflict target and DO NOTHING —
    // that position is the INDEX predicate. Anywhere else and Postgres reads
    // it as a condition on the row, which is a different statement entirely.
    expect(text).toMatch(
      /on conflict \("booking_id"\) where kind IN \('charge', 'guarantee'\) AND status NOT IN \('failed', 'cancelled'\) do nothing/i
    )
  })
})
