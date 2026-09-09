import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"

import { JOB_LOCKS, JobLockService } from "../scheduling/job-lock.service"
import { PostgresThrottlerStorage } from "./postgres-throttler.storage"

/** Its own advisory lock id, like every other job (see `JobLockService`). */

/**
 * Clears counters nobody will read again.
 *
 * Not on the request path, deliberately. A limiter that tidies up while it
 * counts pays for the tidying in the latency of whoever happened to arrive —
 * and does it on every instance at once.
 *
 * Nothing depends on this running: an expired row is started again from one by
 * the upsert, so a missed sweep costs disk, not correctness.
 */
@Injectable()
export class RateLimitJobs {
  private readonly logger = new Logger(RateLimitJobs.name)

  constructor(
    private readonly storage: PostgresThrottlerStorage,
    private readonly locks: JobLockService
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweep() {
    await this.locks.withLock(JOB_LOCKS.rateLimitSweep, async () => {
      const removed = await this.storage.sweep()
      if (removed > 0) this.logger.log(`Rate limits: ${removed} expired counters removed`)
      return removed
    })
  }
}
