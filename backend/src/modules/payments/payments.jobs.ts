import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"

import { JOB_LOCKS, JobLockService } from "../../common/scheduling/job-lock.service"
import { BookingsRepository } from "../bookings/bookings.repository"
import { HoldsService } from "./holds.service"

/** Idempotency keys are worth keeping for a day, then they are noise. */
const IDEMPOTENCY_RETENTION_HOURS = 24

/**
 * The scheduled half of rule #44.
 *
 * The sweeper existed and was tested before anything called it, which is the
 * quietest way for a rule to be false in production: every test passes, and
 * inventory is never actually released.
 */
@Injectable()
export class PaymentsJobs {
  private readonly logger = new Logger(PaymentsJobs.name)

  constructor(
    private readonly holds: HoldsService,
    private readonly bookings: BookingsRepository,
    private readonly locks: JobLockService
  ) {}

  /**
   * Every minute, because a fifteen-minute hold checked every ten would keep
   * a room off sale for up to twenty-five.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepHolds() {
    await this.locks.withLock(JOB_LOCKS.sweepHolds, async () => {
      const result = await this.holds.sweep()
      return result
    })
  }

  /** Yesterday's idempotency keys can no longer collide with anything. */
  @Cron(CronExpression.EVERY_HOUR)
  async purgeIdempotencyKeys() {
    await this.locks.withLock(JOB_LOCKS.purgeIdempotencyKeys, async () => {
      const before = new Date(Date.now() - IDEMPOTENCY_RETENTION_HOURS * 3_600_000)
      await this.bookings.purgeIdempotencyKeys(before)
      this.logger.log(`Purged idempotency keys older than ${before.toISOString()}`)
    })
  }
}
