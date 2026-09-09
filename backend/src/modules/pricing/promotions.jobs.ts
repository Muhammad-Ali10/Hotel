import { Injectable, Logger } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"

import { JOB_LOCKS, JobLockService } from "../../common/scheduling/job-lock.service"
import { PromotionsService } from "./promotions.service"

/** Its own key — two jobs sharing one would take turns instead of running. */

/**
 * Moves promotions through their states.
 *
 * `isApplicable` insists on exactly `active` and refuses to infer it from the
 * window, so without this a promotion scheduled for today is offered to nobody
 * — the rule was written, the job that makes it true was not.
 *
 * Hourly rather than daily: a promotion scheduled to open today should open
 * today, not at whatever hour a single nightly run happens to sit at.
 */
@Injectable()
export class PromotionsJobs {
  private readonly logger = new Logger(PromotionsJobs.name)

  constructor(
    private readonly promotions: PromotionsService,
    private readonly locks: JobLockService
  ) {}

  @Cron("0 * * * *")
  async sweep() {
    await this.locks.withLock(JOB_LOCKS.promotionSweep, () => this.promotions.sweepStatuses())
  }
}
