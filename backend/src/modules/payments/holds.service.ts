import { Inject, Injectable, Logger } from "@nestjs/common"
import { settles, type PaymentMode, type PaymentStatus } from "@stayora/shared"
import { and, eq, inArray, lte, sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import { bookings, payments, properties } from "../../db/schema"
import { BookingsRepository } from "../bookings/bookings.repository"
import { NotificationsService } from "../notifications/notifications.service"

/**
 * Lapsed holds, and the bookings that quietly settled anyway (rule #44).
 *
 * Two jobs in one pass, because they are the same question asked of the same
 * rows: a booking whose hold has run out either got paid for, or it did not.
 *
 *  - paid for → confirm it. This is the safety net for a webhook that never
 *    arrived, or that arrived while the process was restarting. Without it a
 *    guest whose money left their account watches their room get released.
 *  - not paid for → release the inventory. This is what stops a script holding
 *    a hotel empty by starting bookings it never pays for (API6).
 */
@Injectable()
export class HoldsService {
  private readonly logger = new Logger(HoldsService.name)

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly bookingsRepo: BookingsRepository,
    private readonly notifications: NotificationsService
  ) {}

  async sweep(now = new Date()) {
    /*
     * The extra columns are for the message, not for the sweep.
     *
     * Releasing the room without telling anybody was the whole of this job
     * until now: a guest who stepped away mid-checkout came back to a booking
     * that had simply vanished, with nothing sent and nothing to explain it.
     * `properties.slug` is joined because the message links back to the
     * listing, and the booking row does not carry one.
     */
    const expired = await this.db
      .select({
        id: bookings.id,
        ref: bookings.ref,
        roomId: bookings.roomId,
        roomName: bookings.roomName,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        paymentMode: bookings.paymentMode,
        customerId: bookings.customerId,
        guestEmail: bookings.guestEmail,
        propertyName: bookings.propertyName,
        propertySlug: properties.slug,
      })
      .from(bookings)
      .innerJoin(properties, eq(properties.id, bookings.propertyId))
      .where(and(eq(bookings.status, "pending"), lte(bookings.holdExpiresAt, now.toISOString())))
      .limit(200)

    let confirmed = 0
    let released = 0

    for (const booking of expired) {
      const settled = await this.hasSettledPayment(booking.id, booking.paymentMode as PaymentMode)

      if (settled) {
        const ok = await this.bookingsRepo.transition({
          bookingId: booking.id,
          fromStatus: "pending",
          toStatus: "confirmed",
          actorId: null,
          actor: "system",
          reason: "Payment settled — confirmed by reconciliation",
        })
        if (ok) confirmed++
        continue
      }

      const ok = await this.bookingsRepo.cancelWithRelease({
        bookingId: booking.id,
        fromStatus: "pending",
        cancelledBy: "admin",
        reason: "Payment was not completed in time",
        refundAmount: 0,
        refundStatus: "none",
        actorId: null,
        actor: "system",
        roomId: booking.roomId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      })
      if (!ok) continue
      released++

      /*
       * Told, and told what to do about it.
       *
       * Deliberately AFTER the release succeeded, and only then: a message
       * saying the room went back on sale, sent when it did not, is worse
       * than silence. `notify` never throws, so a mail problem cannot leave
       * inventory held.
       */
      await this.notifications.notify({
        template: "booking_hold_expired",
        subjectId: booking.id,
        userId: booking.customerId,
        toEmail: booking.guestEmail,
        payload: {
          ref: booking.ref,
          propertyName: booking.propertyName,
          propertySlug: booking.propertySlug,
          roomName: booking.roomName,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
        },
        inApp: {
          title: `Booking ${booking.ref} wasn't completed`,
          message: `${booking.roomName} at ${booking.propertyName} has gone back on sale. Nothing was charged.`,
          href: `/hotels/${booking.propertySlug}`,
        },
      })
    }

    if (confirmed > 0 || released > 0) {
      this.logger.log(`Holds swept: ${confirmed} confirmed, ${released} released`)
    }
    return { confirmed, released, examined: expired.length }
  }

  /**
   * Whether this booking has a payment that settled.
   *
   * Asked of the ledger, not of a flag on the booking. The booking is exactly
   * the row whose state is in doubt here — trusting a copy of the answer that
   * lives on it would defeat the purpose of the check.
   */
  private async hasSettledPayment(bookingId: string, mode: PaymentMode): Promise<boolean> {
    const rows = await this.db
      .select({ status: payments.status })
      .from(payments)
      .where(
        and(eq(payments.bookingId, bookingId), inArray(payments.kind, ["charge", "guarantee"]))
      )
    return rows.some((row) => settles(mode, row.status as PaymentStatus))
  }

  /** How many holds are outstanding — for the health endpoint and alerting. */
  async pendingCount(now = new Date()) {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.status, "pending"), lte(bookings.holdExpiresAt, now.toISOString())))
    return Number(row?.count ?? 0)
  }
}
