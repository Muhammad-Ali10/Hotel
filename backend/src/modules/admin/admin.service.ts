import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type {
  AdminBookingSearchInput,
  AdminGuestView,
  AdminRefundRequest,
  AdminTransitionInput,
  AdminUserSearchInput,
  AdminUserUpdateInput,
} from "@stayora/shared"
import {
  adminRefundRejection,
  bookingPricingSchema,
  canTransition,
  planAdminRefund,
  policyFromColumns,
  refundFor,
  refundStatusAfter,
  storedCancellationPolicySchema,
  type BookingStatus,
  type ISODate,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { BookingsRepository } from "../bookings/bookings.repository"
import { BookingsSupportRepository } from "../bookings/bookings-support.repository"
import { NotificationsService } from "../notifications/notifications.service"
import { PaymentsRepository } from "../payments/payments.repository"
import { PaymentsService } from "../payments/payments.service"
import { AdminRepository } from "./admin.repository"
import { AuditService } from "./audit.service"

@Injectable()
export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService,
    private readonly paymentsRepo: PaymentsRepository,
    private readonly bookings: BookingsRepository,
    private readonly support: BookingsSupportRepository,
    private readonly notifications: NotificationsService
  ) {}

  /* -------------------------------------------------------- reservations -- */

  searchBookings(query: AdminBookingSearchInput) {
    return this.repo.searchBookings(query)
  }

  async booking(bookingId: string) {
    const booking = await this.repo.findBooking(bookingId)
    if (!booking) throw new NotFoundException("Booking not found")

    const [totals, events, ledger] = await Promise.all([
      this.repo.paymentTotals(bookingId),
      this.bookings.eventsFor(bookingId),
      this.paymentsRepo.listForBooking(bookingId),
    ])

    return { booking, totals, events, payments: ledger }
  }

  /**
   * A platform refund (rules #76, #78).
   *
   * The amount is measured against what the ledger says was CAPTURED, never
   * `bookings.total` — on a guarantee rate the guest may have paid the platform
   * nothing, and refunding against the total sends out money that never came in.
   *
   * Anything beyond what the guest was already owed is goodwill, and the
   * platform gives up its commission for it: the platform made the call, so the
   * platform carries it. A property must not lose money on a decision it was
   * not part of.
   *
   * `idempotencyKey` is required and comes from the caller, so a retried
   * request replays rather than sending a second refund — and two DIFFERENT
   * goodwill refunds of the same size are told apart, which a key derived from
   * the amount could not do.
   */
  async refund(input: {
    bookingId: string
    body: AdminRefundRequest
    user: AuthenticatedUser
    idempotencyKey: string
    ip?: string | null
  }) {
    const booking = await this.repo.findBooking(input.bookingId)
    if (!booking) throw new NotFoundException("Booking not found")

    const [totals, property] = await Promise.all([
      this.repo.paymentTotals(input.bookingId),
      // The property's own clock decides when "free until 6pm" actually falls
      // (rule #33). Reading it from UTC would move the deadline by hours.
      this.support.propertyOf(booking.propertyId),
    ])

    /*
     * What the TERMS say the guest is owed, so the goodwill part can be told
     * apart from the entitled part. Parsed from the columns rather than
     * recomputed — an unrecognised value would fall through `refundFor`'s
     * switch and quietly refund the whole stay.
     */
    const entitled = refundFor({
      policy: storedCancellationPolicySchema.parse(policyFromColumns(booking)),
      // The pricing SNAPSHOT the guest agreed to, parsed rather than trusted —
      // an unrecognised shape reaching `refundFor` is how a stay gets refunded
      // in full by accident.
      pricing: bookingPricingSchema.parse(booking.pricing),
      checkIn: booking.checkIn as ISODate,
      checkInTime: property?.checkInTime ?? "15:00",
      timezone: property?.timezone ?? "UTC",
      cancelledAt: new Date(),
      /*
       * As if the GUEST cancelled — deliberately, and NOT `by: "admin"`.
       *
       * `refundFor` waives the penalty entirely when anybody but the guest
       * cancels, which is right for a real cancellation: a guest should not be
       * charged because the platform pulled the booking. But the question here
       * is different — what were they OWED under the terms they agreed to? —
       * and passing `admin` answers "everything", so no refund is ever
       * goodwill and rule #76 quietly never fires. The platform would keep its
       * commission on every gesture it made.
       */
      by: "guest",
      noShow: booking.status === "no_show",
    })

    const rejection = adminRefundRejection({
      captured: totals.captured,
      alreadyRefunded: totals.refunded,
      entitled: entitled.refund,
      commission: booking.commissionAmount,
      amount: input.body.amount,
    })
    if (rejection) throw new BadRequestException(refundRejectionMessage(rejection, totals))

    const plan = planAdminRefund({
      captured: totals.captured,
      alreadyRefunded: totals.refunded,
      entitled: entitled.refund,
      commission: booking.commissionAmount,
      amount: input.body.amount,
    })

    const payment = await this.paymentsRepo.findLivePrimary(input.bookingId)
    if (!payment) throw new BadRequestException("This booking has no payment to refund")

    /*
     * The money moves BEFORE the audit line, and that is deliberate.
     *
     * A refund that went out with no record is the failure this table exists
     * to prevent — so the write below is not allowed to be skipped, and
     * `AuditService.record` deliberately does not swallow its errors. Writing
     * the line first would risk the opposite: a record of a refund that never
     * left, which is a different lie and just as bad.
     */
    const sent = await this.payments.refund({
      payment,
      amount: plan.refund,
      idempotencyKey: `admin-refund:${payment.id}:${input.idempotencyKey}`,
    })

    if (sent.amount <= 0) {
      throw new ConflictException("The payment provider did not accept that refund")
    }

    /*
     * A replay: this exact instruction already went out.
     *
     * Nothing further happens — no second ledger entry, no second audit line,
     * no second email telling the guest their money is coming back. The
     * caller gets the same answer they got the first time, which is what a
     * retried request is supposed to receive.
     */
    if (sent.replayed) {
      const existing = await this.repo.findBooking(input.bookingId)
      return { booking: existing, refunded: sent.amount, plan, replayed: true as const }
    }

    const updated = await this.repo.updateBooking(input.bookingId, {
      refundAmount: totals.refunded + sent.amount,
      refundStatus: refundStatusAfter(plan),
      // Rule #76: goodwill is the platform's to carry, not the property's.
      ...(plan.voidsCommission ? { commissionStatus: "void" as const } : {}),
    })

    await this.audit.record({
      actor: input.user,
      action: "booking.refund",
      subjectType: "booking",
      subjectId: input.bookingId,
      reason: input.body.reason,
      metadata: {
        amount: sent.amount,
        entitled: entitled.refund,
        goodwill: plan.goodwill,
        commissionVoided: plan.voidsCommission,
        commissionGivenUp: plan.commissionGivenUp,
        alreadyRefunded: totals.refunded,
        captured: totals.captured,
      },
      ip: input.ip,
    })

    // The template existed from Module 9 and nothing ever sent it — there was
    // no refund a person could initiate until now.
    await this.notifications.notify({
      template: "refund_issued",
      subjectId: `${input.bookingId}:${sent.amount}`,
      userId: booking.customerId,
      toEmail: booking.guestEmail,
      payload: {
        ref: booking.ref,
        propertyName: booking.propertyName,
        amount: sent.amount,
        reason: input.body.reason,
      },
    })

    return { booking: updated, refunded: sent.amount, plan, replayed: false as const }
  }

  /**
   * Forcing a booking to another status (rule #78).
   *
   * The transition is still checked by `canTransition` — being an
   * administrator says who is asking, not that the state machine is optional.
   * A booking cannot be moved somewhere the machine has no edge to (rule #6).
   */
  async transition(input: {
    bookingId: string
    body: AdminTransitionInput
    user: AuthenticatedUser
    ip?: string | null
  }) {
    const booking = await this.repo.findBooking(input.bookingId)
    if (!booking) throw new NotFoundException("Booking not found")

    const from = booking.status as BookingStatus
    const guard = canTransition(from, input.body.to, "platform_admin")
    if (!guard.ok) throw new ConflictException(guard.reason)

    const updated = await this.bookings.transition({
      bookingId: input.bookingId,
      fromStatus: from,
      toStatus: input.body.to,
      actorId: input.user.id,
      actor: "platform_admin",
      reason: input.body.reason,
    })
    if (!updated) throw new ConflictException("That booking moved before this could apply")

    await this.audit.record({
      actor: input.user,
      action: "booking.force_status",
      subjectType: "booking",
      subjectId: input.bookingId,
      reason: input.body.reason,
      metadata: { from, to: input.body.to },
      ip: input.ip,
    })

    return { booking: updated }
  }

  /* --------------------------------------------------------------- users -- */

  async searchUsers(query: AdminUserSearchInput) {
    // The page, and the counts the tiles and tabs read. The counts answer for
    // the whole role rather than the page — see `userCounts`.
    const [page, counts] = await Promise.all([
      this.repo.searchUsers(query),
      this.repo.userCounts(query.role),
    ])

    return { ...page, counts }
  }

  /** A guest, with enough history to answer a complaint (rule #80). */
  async guest(userId: string): Promise<AdminGuestView & { bookings: unknown[]; reviews: unknown[] }> {
    const user = await this.repo.findUser(userId)
    if (!user) throw new NotFoundException("User not found")

    const [stats, bookings, reviews] = await Promise.all([
      this.repo.guestStats(userId),
      this.repo.bookingsForCustomer(userId, 50),
      this.repo.reviewsForCustomer(userId, 50),
    ])

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      country: user.country,
      role: user.role,
      status: user.status,
      tier: user.tier,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt,
      stats,
      bookings,
      reviews,
    }
  }

  /**
   * Changing what an account may do (rules #79, #81).
   *
   * No delete — bookings, reviews and payouts point at a user, and removing
   * one makes every record they touched anonymous. Suspending stops them
   * signing in, which is the thing actually wanted.
   */
  async updateUser(input: {
    userId: string
    body: AdminUserUpdateInput
    user: AuthenticatedUser
    ip?: string | null
  }) {
    const target = await this.repo.findUser(input.userId)
    if (!target) throw new NotFoundException("User not found")

    /*
     * The platform must keep one active administrator (rule #81).
     *
     * The same guard the org has one level down, for the same reason — except
     * here there is nobody above to undo it. A platform that loses its last
     * admin has no way back at all.
     */
    const losesAdmin =
      target.role === "admin" &&
      target.status === "active" &&
      ((input.body.role !== undefined && input.body.role !== "admin") ||
        input.body.status === "suspended")

    if (losesAdmin) {
      const others = await this.repo.countOtherActiveAdmins(target.id)
      if (others === 0) {
        throw new ConflictException(
          "The platform needs at least one administrator. Promote somebody else first."
        )
      }
    }

    /*
     * The grade travels with the role, or the row stops making sense.
     *
     * `platform_role` is meaningful only for administrators, and the database
     * enforces exactly that: an admin must have one, anybody else must not.
     * Changing `role` on its own therefore fails — which is how this was
     * found, as a 500 on the perfectly ordinary act of demoting somebody.
     *
     * Promoting grants `support`, the narrowest grade, rather than the widest.
     * Making somebody an administrator and making them able to do everything
     * are two decisions, and only the first one was asked for here.
     */
    const platformRole =
      input.body.role === undefined
        ? undefined
        : input.body.role === "admin"
          ? ((target.platformRole ?? "support") as "super_admin" | "ops" | "finance" | "support")
          : null

    const updated = await this.repo.updateUser(input.userId, {
      role: input.body.role,
      platformRole,
      status: input.body.status,
    })
    if (!updated) throw new NotFoundException("User not found")

    await this.audit.record({
      actor: input.user,
      action: input.body.status === "suspended" ? "user.suspend" : "user.update",
      subjectType: "user",
      subjectId: input.userId,
      reason: input.body.reason ?? "",
      metadata: {
        from: { role: target.role, status: target.status },
        to: { role: updated.role, status: updated.status },
      },
      ip: input.ip,
    })

    return updated
  }
}

/* ------------------------------------------------------------------ local -- */

function refundRejectionMessage(
  reason: "nothing_captured" | "not_positive" | "exceeds_captured",
  totals: { captured: number; refunded: number }
): string {
  if (reason === "nothing_captured") {
    return totals.captured === 0
      ? "Nothing was ever captured on this booking, so there is nothing to refund"
      : "Everything captured on this booking has already been refunded"
  }
  if (reason === "not_positive") return "A refund has to be more than zero"
  const left = totals.captured - totals.refunded
  return `That is more than is left to refund on this booking (${left} cents)`
}
