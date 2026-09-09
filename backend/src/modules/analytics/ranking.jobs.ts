import { Injectable, Logger } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"

import { JOB_LOCKS, JobLockService } from "../../common/scheduling/job-lock.service"
import { RankingService } from "./ranking.service"

/** Its own key — two jobs sharing one would take turns instead of running. */

/**
 * Recomputes where every live listing sits in `recommended` search (rule #104).
 *
 * Nightly rather than per request. Sorting by a score means ranking EVERY
 * match before paging, and recomputing five factors for a city's whole
 * catalogue on each keystroke is not a search, it is a report.
 *
 * 02:00 because it reads the whole catalogue and the impression table: the
 * quietest hour is the right one for the heaviest query in the system.
 *
 * A missed night is not an outage. Yesterday's ordering is a day stale, which
 * is what a materialised ranking always is — the alternative is a search that
 * gets slower as the marketplace grows.
 */
@Injectable()
export class RankingJobs {
  private readonly logger = new Logger(RankingJobs.name)

  constructor(
    private readonly ranking: RankingService,
    private readonly locks: JobLockService
  ) {}

  @Cron("0 2 * * *")
  async refresh() {
    await this.locks.withLock(JOB_LOCKS.ranking, async () => {
      const result = await this.ranking.refreshAll()
      this.logger.log(`Ranking refreshed for ${result.ranked} listings`)
    })
  }
}
