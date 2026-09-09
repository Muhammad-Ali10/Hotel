import { Inject, Injectable, Logger } from "@nestjs/common"
import { sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"

/**
 * Runs a job on exactly one instance at a time.
 *
 * A scheduled job in Nest fires on EVERY process running the app. With two
 * containers behind a load balancer, the hold sweeper runs twice a minute
 * instead of once — and while the guarded updates make that harmless in
 * outcome, it doubles the work and turns any future job that is not idempotent
 * into a real bug.
 *
 * `pg_try_advisory_lock` is the right tool because it needs no table, no rows
 * and no cleanup: the lock is held by the session and released the instant the
 * connection goes, so an instance that is killed mid-job does not leave a
 * stale claim behind for the next one to time out on.
 */
@Injectable()
export class JobLockService {
  private readonly logger = new Logger(JobLockService.name)

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Runs `job` if this instance can take the lock, and skips it otherwise.
   *
   * Skipping is the normal, uninteresting outcome on every instance but one —
   * so it is not logged as anything.
   */
  async withLock<T>(key: number, job: () => Promise<T>): Promise<T | null> {
    /*
     * The lock and the job must share ONE connection.
     *
     * An advisory lock belongs to the session that took it. Taken on a pooled
     * connection and released on whichever one the pool hands back next, it
     * would unlock a lock this process never held — and leave its own held
     * forever. `db.transaction` pins a single connection for the whole block.
     */
    return this.db.transaction(async (tx) => {
      const result = await tx.execute<{ locked: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(${key}) AS locked`
      )
      if (!result.rows[0]?.locked) return null

      try {
        return await job()
      } catch (error) {
        // Swallowed on purpose: a scheduled job that throws takes down nothing
        // else, and an unhandled rejection in a timer is how a Node process
        // dies quietly at three in the morning.
        this.logger.error(`Job ${key} failed`, error instanceof Error ? error.stack : error)
        return null
      }
    })
  }
}

/**
 * Lock keys.
 *
 * Arbitrary but FIXED — two jobs sharing a number would take turns instead of
 * running, and the symptom would be one of them looking like it never runs.
 */
/**
 * Every scheduled job's lock id, in ONE place.
 *
 * `pg_try_advisory_lock` keys on the number and nothing else, so two jobs
 * sharing an id exclude each other — and the loser does not fail, it returns
 * quietly having done nothing. That is precisely what had happened: three jobs
 * held 7005 and two held 7004.
 *
 * The worst of it was `notificationDelivery`, which runs EVERY MINUTE. It sat
 * on the same id as the nightly ranking recompute and the overdue-invoice
 * sweep, so on any given day either could find the lock taken and skip — no
 * error, no log, just a search ranking that stopped moving and invoices that
 * were never chased. The hourly promotion sweep did the same to the monthly
 * invoice run.
 *
 * Declared here rather than in each jobs file because that is what makes a
 * collision VISIBLE. `job-lock.spec.ts` asserts they stay unique, since the
 * failure mode gives no other sign.
 */
export const JOB_LOCKS = {
  sweepHolds: 7_001,
  purgeIdempotencyKeys: 7_002,
  payoutRun: 7_003,
  invoiceRun: 7_004,
  invoiceOverdue: 7_005,
  ranking: 7_006,
  notificationDelivery: 7_007,
  notificationPurge: 7_008,
  promotionSweep: 7_009,
  rateLimitSweep: 7_010,

  /* The stay lifecycle — see bookings.jobs.ts. */
  closeStays: 7_011,
  stayReminders: 7_012,
  reviewRequests: 7_013,
  backfillNights: 7_014,
} as const
