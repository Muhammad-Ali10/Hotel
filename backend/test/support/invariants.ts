import { sql } from "drizzle-orm"

import type { Database } from "../../src/db/drizzle.module"

/* ============================================================================
 * Invariants, checked across the whole table rather than along one path.
 *
 * The bug that motivated this (rule #138) survived a green suite because every
 * test tested a PATH, and the path nobody remembered had no test. A derived
 * column has one correct value at all times, so the useful question is not
 * "did this endpoint remember to recompute" but "is any row wrong" — a
 * question that answers itself for endpoints that do not exist yet.
 * ========================================================================== */

export type Drift = { slug: string; stored: number; derived: number }

/**
 * Every property whose stored "from" price disagrees with its rate plans.
 *
 * The derivation is `recomputeBasePrice`, restated in SQL: the cheapest active
 * plan on an active room, or zero when there is none. Kept deliberately
 * separate from the implementation — a check written by calling the thing it
 * checks proves only that the function is deterministic.
 */
export async function basePriceDrift(db: Database): Promise<Drift[]> {
  const result = await db.execute(sql`
    SELECT p.slug,
           p.base_price AS stored,
           COALESCE(MIN(rp.base_price), 0) AS derived
    FROM properties p
    LEFT JOIN rooms r
      ON r.property_id = p.id AND r.status = 'active'
    LEFT JOIN rate_plans rp
      ON rp.room_id = r.id AND rp.status = 'active'
    GROUP BY p.id, p.slug, p.base_price
    HAVING p.base_price <> COALESCE(MIN(rp.base_price), 0)
    ORDER BY p.slug
  `)

  return (result.rows as Record<string, unknown>[]).map((row) => ({
    slug: String(row.slug),
    stored: Number(row.stored),
    derived: Number(row.derived),
  }))
}
