import { Injectable, Logger } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"
import { REVIEW_WINDOW_DAYS } from "@stayora/shared"

import { JOB_LOCKS, JobLockService } from "../../common/scheduling/job-lock.service"
import { NotificationsService } from "../notifications/notifications.service"
import { BookingsRepository } from "./bookings.repository"

/* ============================================================================
 * The stay clock.
 *
 * Three things that happen to a booking because a DATE passed, not because
 * anybody clicked anything. Until now nothing did them, and the effects
 * compounded: a stay that ended stayed `checked_in` forever, `canReview`
 * requires `completed`, so no guest could ever leave a review — and the review
 * request that would have asked them was written and never sent.
 *
 * All three run in the small hours and are cheap, so they are separate jobs
 * with separate locks: one of them failing should not stop the other two, and
 * a shared lock is how a job silently does nothing (see `JOB_LOCKS`).
 * ========================================================================== */

/**
 * A ceiling per run, not a target.
 *
 * These are daily jobs on a table that grows forever. Without a bound the
 * first run after a quiet month tries to close a season's worth of stays in
 * one transaction. Anything above the limit is simply picked up tomorrow —
 * every one of these is idempotent, so nothing is lost by deferring it.
 */
const BATCH = 500

@Injectable()
export class BookingsJobs {
  private readonly logger = new Logger(BookingsJobs.name)

  constructor(
    private readonly repo: BookingsRepository,
    private readonly notifications: NotificationsService,
    private readonly locks: JobLockService
  ) {}

  /**
   * Closes stays the front desk forgot to check out.
   *
   * 03:20, so it runs after the last timezone's midnight has passed for the
   * previous day and before the reminder job needs the results.
   *
   * `checked_in` only. `confirmed` is deliberately left alone: the state
   * machine does not allow `confirmed → completed`, because a booking nobody
   * checked in is a booking nobody can say happened — it might be a no-show,
   * and that is a judgement the property makes, not a clock.
   */
  @Cron("20 3 * * *")
  async closeFinishedStays() {
    await this.locks.withLock(JOB_LOCKS.closeStays, async () => {
      const ids = await this.repo.checkedInStaysToClose(BATCH)
      let closed = 0

      for (const bookingId of ids) {
        const ok = await this.repo.transition({
          bookingId,
          fromStatus: "checked_in",
          toStatus: "completed",
          actorId: null,
          actor: "system",
          reason: "Stay ended — closed by the nightly sweep",
        })
        if (ok) closed++
      }

      if (closed > 0) this.logger.log(`Closed ${closed} finished stays`)
      return { examined: ids.length, closed }
    })
  }

  /**
   * "Your stay is tomorrow", with the address and the check-in time.
   *
   * 09:00 rather than the small hours: this one is read by a person, and a
   * message about tomorrow that arrives at 3am is one they see after everything
   * else in their inbox. The date is still computed in the property's
   * timezone, so a Paris hotel's guest is told on Paris's calendar.
   */
  @Cron("0 9 * * *")
  async sendStayReminders() {
    await this.locks.withLock(JOB_LOCKS.stayReminders, async () => {
      const stays = await this.repo.staysStartingTomorrow(BATCH)

      for (const stay of stays) {
        /*
         * `subjectId` is the booking, and the outbox has a unique index on
         * (template, dedupe key) — so re-selecting the same stay tomorrow
         * cannot send a second copy. The job does not need to remember what
         * it has done.
         */
        await this.notifications.notify({
          template: "stay_reminder",
          subjectId: stay.id,
          userId: stay.customerId,
          toEmail: stay.guestEmail,
          payload: {
            ref: stay.ref,
            propertyName: stay.propertyName,
            checkIn: stay.checkIn,
            checkInTime: stay.checkInTime,
          },
          inApp: {
            title: `Your stay at ${stay.propertyName} is tomorrow`,
            message: `Check-in from ${stay.checkInTime}.`,
            href: `/dashboard/bookings/${stay.ref}`,
          },
        })
      }

      if (stays.length > 0) this.logger.log(`Reminded ${stays.length} guests`)
      return { reminded: stays.length }
    })
  }

  /**
   * Fills in any booking whose nightly ledger is missing.
   *
   * 03:40, after the stays are closed and before anything reads the numbers.
   *
   * The first run does the historical backfill — every booking made before
   * `booking_nights` existed, which is why occupancy and ADR reports simply
   * began partway through. After that it is a repair: it finds nothing on a
   * healthy database, and finds exactly the bookings a half-failed modify left
   * behind on an unhealthy one.
   */
  @Cron("40 3 * * *")
  async backfillNightlyLedger() {
    await this.locks.withLock(JOB_LOCKS.backfillNights, async () => {
      const missing = await this.repo.bookingsMissingNights(BATCH)
      let rebuilt = 0
      let failed = 0

      for (const booking of missing) {
        try {
          if (await this.repo.rebuildNights(booking.id)) rebuilt++
        } catch (error) {
          /*
           * One booking, not the run.
           *
           * `writeNights` refuses a booking whose dates and stored nightly
           * rates disagree — correctly, since writing the shorter of the two
           * would bury missing revenue. In old data that is a real
           * possibility, and it must not stop the other four hundred.
           */
          failed++
          this.logger.error(
            `Could not rebuild nights for booking ${booking.ref}: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        }
      }

      if (rebuilt > 0 || failed > 0) {
        this.logger.log(`Nightly ledger: ${rebuilt} rebuilt, ${failed} refused`)
      }
      return { examined: missing.length, rebuilt, failed }
    })
  }

  /**
   * "How was it?", once, after the stay is over.
   *
   * 10:00 the day after check-out at the earliest. Bounded by the same window
   * the review form enforces — asking for something the API would refuse is
   * worse than not asking, because the guest tries.
   */
  @Cron("0 10 * * *")
  async requestReviews() {
    await this.locks.withLock(JOB_LOCKS.reviewRequests, async () => {
      const stays = await this.repo.staysAwaitingReview({
        windowDays: REVIEW_WINDOW_DAYS,
        limit: BATCH,
      })

      for (const stay of stays) {
        await this.notifications.notify({
          template: "review_request",
          subjectId: stay.id,
          userId: stay.customerId,
          toEmail: stay.guestEmail,
          payload: {
            bookingId: stay.id,
            ref: stay.ref,
            propertyName: stay.propertyName,
            checkOut: stay.checkOut,
          },
          inApp: {
            title: `How was ${stay.propertyName}?`,
            message: "A few words help the next traveller.",
            href: `/dashboard/reviews?booking=${stay.id}`,
          },
        })
      }

      if (stays.length > 0) this.logger.log(`Asked ${stays.length} guests for a review`)
      return { asked: stays.length }
    })
  }
}
