import { index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core"

/* ============================================================================
 * Rate limit counters, shared across instances.
 *
 * `@nestjs/throttler` defaults to an in-memory store, which is a per-PROCESS
 * counter. With two containers behind a load balancer the limits silently
 * double: a global bucket of 120/min becomes 240, and — the one that matters —
 * the 5/min guard on login becomes 10. Nothing breaks and nothing logs, the
 * protection is simply half of what the code says it is.
 *
 * Three decisions worth stating:
 *
 * `UNLOGGED`, set by the migration. This is the only unlogged table in the
 * schema and it earns it: a row here is a counter that expires within the
 * minute, and writing every one of them through the WAL would put a durable
 * write on the path of every request in the product for state nobody would
 * miss. A crash resets the counters, which is the same as a deploy does.
 *
 * The key is the throttler's own — tracker, route and throttler name already
 * combined by the guard — so this table has no opinion about what is being
 * limited.
 *
 * No `id`, no `created_at`. Every other table in this schema carries both; a
 * counter is not a record, it is a number with an expiry, and one row per
 * client per route per minute is a lot of rows to give a UUID to.
 * ========================================================================== */

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: varchar("key", { length: 255 }).primaryKey(),

    hits: integer("hits").notNull().default(0),

    /** When the window closes and `hits` starts again from one. */
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),

    /**
     * Set only when a throttler is configured with a block duration.
     *
     * `null` is the ordinary case: the window simply expires and the caller is
     * free again. A block outlives its window on purpose — it is what stops a
     * caller who is over the limit from getting a fresh allowance the moment
     * the minute turns.
     */
    blockedUntil: timestamp("blocked_until", { withTimezone: true, mode: "string" }),
  },
  (t) => [
    /* The sweeper deletes by expiry; without this it reads the whole table. */
    index("rate_limits_expires_idx").on(t.expiresAt),
  ]
)
