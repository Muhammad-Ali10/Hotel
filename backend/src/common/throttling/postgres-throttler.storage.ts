import { Inject, Injectable, Logger } from "@nestjs/common"
import type { ThrottlerStorage } from "@nestjs/throttler"
// Not re-exported from the package root, only from its own module file.
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface"
import { sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"

/* ============================================================================
 * The rate limiter's counters, in Postgres instead of in this process.
 *
 * `ThrottlerStorage` is one method, and the whole of it has to be ATOMIC: read
 * the count, decide whether the window has rolled over, increment, and answer
 * — with two instances doing the same thing at the same moment. Done as a
 * read-then-write it undercounts exactly when it matters, which is under the
 * load an attacker creates.
 *
 * So it is a single `INSERT … ON CONFLICT DO UPDATE … RETURNING`. One
 * statement, one round trip, and Postgres holds the row lock for the duration
 * of it. That is also why it can afford to be on every request: one indexed
 * upsert against an unlogged table, not a transaction.
 *
 * Milliseconds throughout — `@nestjs/throttler` v6 passes `ttl` and
 * `blockDuration` in ms, not the seconds v5 used.
 * ========================================================================== */

@Injectable()
export class PostgresThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(PostgresThrottlerStorage.name)

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    const compositeKey = `${throttlerName}:${key}`.slice(0, 255)

    try {
      const rows = await this.db.execute<{
        hits: number
        expires_at: string
        blocked_until: string | null
      }>(sql`
        INSERT INTO rate_limits (key, hits, expires_at, blocked_until)
        VALUES (
          ${compositeKey},
          1,
          now() + make_interval(secs => ${ttl} / 1000.0),
          NULL
        )
        ON CONFLICT (key) DO UPDATE SET
          /*
           * A window that has already closed starts again at one. Anything
           * else and a caller who waited out their minute would inherit the
           * count that got them blocked.
           */
          hits = CASE
            WHEN rate_limits.expires_at <= now() THEN 1
            ELSE rate_limits.hits + 1
          END,

          expires_at = CASE
            WHEN rate_limits.expires_at <= now()
              THEN now() + make_interval(secs => ${ttl} / 1000.0)
            ELSE rate_limits.expires_at
          END,

          blocked_until = CASE
            /*
             * A live block SURVIVES the window rolling over — that is the
             * point of it. Checked before the rollover branch, or a blocked
             * caller would be freed by the clock rather than by the block.
             */
            WHEN rate_limits.blocked_until IS NOT NULL
             AND rate_limits.blocked_until > now()
              THEN rate_limits.blocked_until

            WHEN rate_limits.expires_at <= now() THEN NULL

            WHEN ${blockDuration} > 0
             AND rate_limits.hits + 1 > ${limit}
              THEN now() + make_interval(secs => ${blockDuration} / 1000.0)

            ELSE NULL
          END
        RETURNING hits, expires_at, blocked_until
      `)

      const row = (rows as unknown as { rows?: unknown[] }).rows ?? rows
      const record = (Array.isArray(row) ? row[0] : row) as {
        hits: number
        expires_at: string
        blocked_until: string | null
      }

      const now = Date.now()
      const blockedUntil = record.blocked_until ? Date.parse(record.blocked_until) : 0
      const isBlocked = blockedUntil > now

      return {
        totalHits: Number(record.hits),
        timeToExpire: Math.max(0, Math.ceil((Date.parse(record.expires_at) - now) / 1000)),
        isBlocked,
        timeToBlockExpire: isBlocked ? Math.ceil((blockedUntil - now) / 1000) : 0,
      }
    } catch (error) {
      /*
       * The database is unreachable. Two choices, and neither is pleasant:
       * refuse every request, or serve them unlimited.
       *
       * Serving them wins. A limiter that cannot count is a degraded defence;
       * a limiter that returns 429 to everybody is an outage of the whole
       * product caused by the thing meant to protect it. Logged at `error` so
       * it is not a silent downgrade.
       */
      this.logger.error(
        `Rate limit storage unavailable — allowing the request: ${(error as Error).message}`
      )
      return { totalHits: 1, timeToExpire: Math.ceil(ttl / 1000), isBlocked: false, timeToBlockExpire: 0 }
    }
  }

  /**
   * Deletes counters whose window has closed and whose block has lapsed.
   *
   * Nothing reads an expired row — the upsert above starts it again from one —
   * so this is only about the table not growing without bound. Run from the
   * scheduler, under a lock, not from the request path.
   */
  async sweep(): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM rate_limits
      WHERE expires_at <= now() - interval '10 minutes'
        AND (blocked_until IS NULL OR blocked_until <= now())
    `)
    return (result as unknown as { rowCount?: number }).rowCount ?? 0
  }
}
