import { Injectable } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"

import { JOB_LOCKS, JobLockService } from "../../common/scheduling/job-lock.service"
import { NotificationsRepository } from "./notifications.repository"
import { NotificationsService } from "./notifications.service"


/** Delivered messages are worth keeping for a month, then they are noise. */
const SENT_RETENTION_DAYS = 30

/**
 * The worker half of rule #57.
 *
 * Enqueueing happens inside the transaction that produced the event; this is
 * what actually sends. Every minute, because "your booking is confirmed" that
 * arrives a quarter of an hour late has already been overtaken by the guest
 * refreshing the page and wondering.
 */
@Injectable()
export class NotificationsJobs {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly repo: NotificationsRepository,
    private readonly locks: JobLockService
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async deliver() {
    await this.locks.withLock(JOB_LOCKS.notificationDelivery, () => this.notifications.deliverDue())
  }

  /** The outbox is a queue, not an archive. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purge() {
    await this.locks.withLock(JOB_LOCKS.notificationPurge, async () => {
      const before = new Date(Date.now() - SENT_RETENTION_DAYS * 86_400_000).toISOString()
      return this.repo.purgeSent(before)
    })
  }
}
