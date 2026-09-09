import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"

import { JOB_LOCKS, JobLockService } from "../../common/scheduling/job-lock.service"
import { FinanceService } from "./finance.service"
import { InvoicesService } from "./invoices.service"

/** Its own key — two jobs sharing one would take turns instead of running. */
/* Distinct advisory-lock keys: the three runs must never wait on each other. */

/**
 * The fortnightly payout run (rule #48).
 *
 * `0 3 1,16 * *` — 03:00 on the 1st and the 16th. Early morning because the
 * run reads every settled booking for every property, and because a bank that
 * rejects a transfer leaves a working day to notice.
 */
@Injectable()
export class FinanceJobs {
  private readonly logger = new Logger(FinanceJobs.name)

  constructor(
    private readonly finance: FinanceService,
    private readonly invoices: InvoicesService,
    private readonly locks: JobLockService
  ) {}

  @Cron("0 3 1,16 * *")
  async runPayouts() {
    await this.locks.withLock(JOB_LOCKS.payoutRun, async () => {
      // Money moves here. One instance, or the same fortnight settles twice —
      // and while `payouts_org_period_unique` would refuse the second row, the
      // work of getting there is not free.
      const result = await this.finance.runAll()
      this.logger.log(`Payout run complete: ${JSON.stringify(result)}`)
      return result
    })
  }

  /**
   * The month's commission bills (rules #91, #94).
   *
   * On the 1st, for the whole of the previous month — a different cycle from
   * payouts, which run fortnightly. Paying somebody and asking them for money
   * do not have to happen on the same day, and a monthly bill is the thing an
   * accounts department actually reads.
   *
   * At 04:00, an hour after a payout run that may share the date: the payout
   * decides what was deducted, and billing before it would ask for commission
   * the same morning's payout was about to hold back.
   */
  @Cron("0 4 1 * *")
  async runInvoices() {
    await this.locks.withLock(JOB_LOCKS.invoiceRun, async () => {
      const { periodStart, periodEnd } = previousMonth(new Date())
      const result = await this.invoices.runForMonth({ periodStart, periodEnd })
      this.logger.log(`Invoice run for ${periodStart}: ${JSON.stringify(result)}`)
      return result
    })
  }

  /**
   * Invoices that have run out of time (rule #95).
   *
   * Daily, because the consequence is real — the org drops back to `deduct`
   * and its payouts stop — and a partner who paid yesterday should not be
   * penalised for another month because the sweep runs monthly.
   */
  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async sweepOverdue() {
    await this.locks.withLock(JOB_LOCKS.invoiceOverdue, async () => {
      const result = await this.invoices.sweepOverdue()
      if (result.marked > 0) this.logger.log(`Marked ${result.marked} invoices overdue`)
      return result
    })
  }
}

/**
 * The month that just ended.
 *
 * Computed from the run's own clock rather than passed in, so a cron that
 * fires late still bills the right month — and `setUTCDate(0)` lands on the
 * last day of the previous month without anybody counting to 31.
 */
function previousMonth(now: Date): { periodStart: string; periodEnd: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  end.setUTCDate(0)
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  }
}
