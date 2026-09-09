import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common"
import {
  canTransitionPayment,
  policyFromColumns,
  policyText,
  intentFor,
  refundableAmount,
  settlementFor,
  settles,
  statusAfterRefund,
  type PaymentMode,
  type PaymentSession,
  type PaymentStatus,
  type PaymentView,
  type ProviderEvent,
} from "@stayora/shared"

import { env } from "../../config/env"
import type { AuthenticatedUser } from "../auth/auth.service"
import { BookingsRepository } from "../bookings/bookings.repository"
import { NotificationsService } from "../notifications/notifications.service"
import { PaymentsRepository, type PaymentRow } from "./payments.repository"
import { PAYMENT_PROVIDER, type PaymentProvider } from "./provider/payment-provider"

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    private readonly repo: PaymentsRepository,
    private readonly bookings: BookingsRepository,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider
  ) {}

  /* ------------------------------------------------------------- checkout */

  /**
   * Starts, or resumes, payment for a booking the guest is holding (#44).
   *
   * Resuming matters as much as starting. A guest who reloads the checkout
   * page, or comes back from their bank on a dead session, must land on the
   * SAME intent — a second one would either double-charge them or, at best,
   * leave an orphaned authorization on their card for a week.
   */
  async start(input: {
    bookingId: string
    returnPath?: string
    user: AuthenticatedUser
    now?: Date
  }): Promise<PaymentSession> {
    const now = input.now ?? new Date()

    // Scoped lookup — somebody else's booking does not exist here (API1).
    const booking = await this.repo.findOwnedBooking({
      bookingId: input.bookingId,
      userId: input.user.id,
    })
    if (!booking) throw new NotFoundException("Booking not found")

    if (booking.status !== "pending") {
      throw new BadRequestException(`A ${booking.status} booking is not awaiting payment.`)
    }
    if (booking.holdExpiresAt !== null && new Date(booking.holdExpiresAt) <= now) {
      // The sweeper may not have run yet, but the hold is gone either way.
      throw new ConflictException({
        message: "This booking's hold has expired. Please search again.",
        code: "hold_expired",
      })
    }

    const mode = booking.paymentMode as PaymentMode
    const { kind, amount } = intentFor(mode, booking.total)

    const existing = await this.repo.findLivePrimary(booking.id)
    const payment = existing ?? (await this.createPrimary(booking.id, kind, amount))

    // Already settled — hand back the same session rather than a new intent.
    if (payment.providerRef && payment.status !== "requires_payment_method") {
      return this.sessionOf(payment, mode)
    }

    /*
     * The provider call sits OUTSIDE any transaction (rule #45).
     *
     * A network call inside one holds a database connection open for as long
     * as the slowest thing on the internet takes, and a rollback cannot undo a
     * charge that already left. So the row is written first, the call is made,
     * and the reference is attached after — a crash in between leaves a row
     * with no reference, which the next `start` picks up and retries.
     */
    const intent = await this.provider.createIntent({
      paymentId: payment.id,
      amount,
      currency: payment.currency,
      description: `${booking.propertyName} · ${booking.ref}`,
      returnUrl: `${env.WEB_ORIGIN}${input.returnPath ?? "/checkout/confirmation"}`,
      customer: {
        email: booking.guestEmail,
        name: `${booking.guestFirstName} ${booking.guestLastName}`.trim(),
      },
    })

    const updated = await this.repo.attachProviderRef({
      paymentId: payment.id,
      providerRef: intent.providerRef,
      status: intent.requiresAction ? "requires_action" : "requires_payment_method",
    })

    return {
      ...this.sessionOf(updated ?? payment, mode),
      clientSecret: intent.clientSecret,
      redirectUrl: intent.redirectUrl,
    }
  }

  /**
   * Creates the primary payment, tolerating the click that arrives twice.
   *
   * The partial unique index decides; the loser reads the winner's row. What
   * this prevents is two live intents for one booking, which is how a guest
   * ends up charged twice for one stay.
   */
  private async createPrimary(
    bookingId: string,
    kind: "charge" | "guarantee",
    amount: number
  ): Promise<PaymentRow> {
    const created = await this.repo.createPrimary({
      bookingId,
      kind,
      amount,
      provider: this.provider.name,
      currency: "USD",
    })
    if (created) return created

    const existing = await this.repo.findLivePrimary(bookingId)
    if (!existing) {
      // The index refused the insert and yet nothing is live: the row it
      // collided with changed state in between. Rare, and a retry is right.
      throw new ConflictException("Payment is already in progress. Please try again.")
    }
    return existing
  }

  /* ------------------------------------------------------------- webhooks */

  /**
   * The provider telling us what really happened (rule #45).
   *
   * This is the ONLY thing that confirms a booking. A success reported by the
   * browser is a claim from a client; the webhook is signed by the processor.
   *
   * Three defences, because providers retry hard and networks reorder:
   *  1. the signature, over the raw bytes
   *  2. the event id, claimed by an INSERT — a replay claims nothing
   *  3. the status guard on the row itself
   */
  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const event = this.provider.parseWebhook(rawBody, signature)
    if (!event) {
      // Deliberately not "bad signature" — an attacker probing for the shape
      // of a valid one learns nothing from this.
      throw new BadRequestException("Invalid webhook")
    }

    const payment = await this.repo.findByProviderRef(this.provider.name, event.providerRef)

    const claimed = await this.repo.claimEvent({
      provider: this.provider.name,
      eventId: event.id,
      type: event.type,
      paymentId: payment?.id ?? null,
      payload: event,
    })
    // A replay. Already handled, and answered 200 so the provider stops.
    if (!claimed) return { handled: true, duplicate: true }

    if (!payment) {
      // Recorded, not acted on: an event for an intent this system never
      // created is worth keeping for reconciliation, not worth guessing about.
      this.logger.warn(`Webhook ${event.id} references unknown intent ${event.providerRef}`)
      return { handled: false, duplicate: false }
    }

    await this.apply(payment, event)
    return { handled: true, duplicate: false }
  }

  private async apply(payment: PaymentRow, event: ProviderEvent) {
    if (event.type === "payment.refunded") {
      // Refunds are recorded where they are initiated; a provider-side refund
      // reaching us is reconciliation, not a second refund to perform.
      return
    }

    const to: PaymentStatus =
      event.type === "payment.captured"
        ? "captured"
        : event.type === "payment.authorized"
          ? "authorized"
          : "failed"

    const guard = canTransitionPayment(payment.status as PaymentStatus, to)
    if (!guard.ok) {
      // Out-of-order or duplicated delivery. Not an error — providers do not
      // promise ordering, and the row already holds the later truth.
      this.logger.log(`Ignoring ${event.type} for ${payment.id}: ${guard.reason}`)
      return
    }

    const advanced = await this.repo.advance({
      paymentId: payment.id,
      fromStatus: payment.status,
      toStatus: to,
      capturedAt: to === "captured" ? new Date().toISOString() : null,
      ...(event.cardBrand ? { cardBrand: event.cardBrand } : {}),
      ...(event.cardLast4 ? { cardLast4: event.cardLast4 } : {}),
      // Without this a guarantee verifies a card it can never charge, and
      // every penalty under rule #42 silently becomes uncollectable.
      ...(event.providerMethodRef ? { providerMethodRef: event.providerMethodRef } : {}),
      ...(event.failureReason ? { failureReason: event.failureReason } : {}),
    })
    // Lost a race with another delivery of the same event. It won; nothing to do.
    if (!advanced) return

    await this.reconcileBooking(advanced)
  }

  /**
   * Brings the booking into line with what its payment now says (#44).
   *
   * Deliberately NOT in the same transaction as the payment write. A payment
   * is a fact about the outside world and must be recorded the moment it is
   * known; the booking is this system's own state and can be brought into line
   * a moment later. If the process dies in between, the hold sweeper finds a
   * pending booking whose payment has settled and confirms it — the same
   * reconciliation that already has to exist for a webhook that never arrives.
   */
  private async reconcileBooking(payment: PaymentRow) {
    const booking = await this.bookings.findById(payment.bookingId)
    if (!booking || booking.status !== "pending") return

    if (!settles(booking.paymentMode as PaymentMode, payment.status as PaymentStatus)) return

    /*
     * Who to tell is looked up BEFORE the transaction opens.
     *
     * The queue write goes inside it; the read that decides where it goes does
     * not, because a transaction should hold the booking's rows for as short a
     * time as possible (rule #45's sibling).
     */
    const partner = await this.notifications.recipientForProperty(booking.propertyId)
    const cancellationText = policyText(policyFromColumns(booking))

    await this.bookings.transition({
      bookingId: booking.id,
      fromStatus: "pending",
      toStatus: "confirmed",
      actorId: null,
      actor: "system",
      reason: "Payment settled",
      // The hold has done its job; a confirmed booking must never carry one,
      // or the sweeper will come back for it.
      patch: { holdExpiresAt: null },

      /*
       * Queued INSIDE the transaction that confirms the booking (rule #57).
       *
       * The two land together or not at all. Queued afterwards, a process that
       * died in between would leave a confirmed booking whose guest was never
       * told — and nothing anywhere recording that anything was owed them.
       *
       * The guard on `fromStatus` means a replayed webhook matches nothing and
       * this never runs twice.
       */
      within: async (tx) => {
        await this.notifications.notify(
          {
            template: "booking_confirmed",
            subjectId: booking.id,
            userId: booking.customerId,
            toEmail: booking.guestEmail,
            payload: {
              ref: booking.ref,
              propertyName: booking.propertyName,
              roomName: booking.roomName,
              ratePlanName: booking.ratePlanName,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              total: booking.total,
              /*
               * Generated from the same fields `refundFor()` reads (rule #1).
               * This sentence is the reason the templates live in the repo.
               */
              cancellationText,
            },
            inApp: {
              title: `Booking ${booking.ref} confirmed`,
              message: `Your stay at ${booking.propertyName} is confirmed.`,
              href: `/dashboard/bookings/${booking.ref}`,
            },
          },
          tx
        )

        /*
         * And the property, which until now was never told at all.
         *
         * A hotel that does not know a room was sold cannot staff for it,
         * cannot stop selling it elsewhere, and finds out when somebody
         * arrives at the desk.
         */
        if (partner) {
          await this.notifications.notify(
            {
              template: "partner_new_booking",
              subjectId: booking.id,
              userId: partner.userId,
              toEmail: partner.email,
              payload: {
                ref: booking.ref,
                guestName: `${booking.guestFirstName} ${booking.guestLastName}`.trim(),
                roomName: booking.roomName,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                total: booking.total,
              },
              inApp: {
                title: `New booking ${booking.ref}`,
                message: `${booking.roomName} · ${booking.checkIn} to ${booking.checkOut}`,
                href: "/extranet/reservations",
              },
            },
            tx
          )
        }
      },
    })
  }

  /* ---------------------------------------------------------- settlements */

  /**
   * Moves the money a cancellation calls for (rules #1, #46).
   *
   * Which direction depends on the mode, and `settlementFor` decides — a
   * prepaid booking sends part of it back, a guaranteed one charges the card
   * it saved. Both figures come from `refundFor()`; nothing is recomputed here.
   */
  async settleCancellation(input: {
    bookingId: string
    mode: PaymentMode
    refund: number
    charged: number
  }) {
    const settlement = settlementFor(input)
    if (settlement.action === "none") {
      // Nothing to collect, but a held authorization still has to be released.
      await this.voidFor(input.bookingId)
      return { action: "none" as const, amount: 0 }
    }

    const primary = await this.repo.findLivePrimary(input.bookingId)
    if (!primary) {
      // Nothing was ever taken and no card was saved. Worth a loud line: it
      // means a booking got confirmed without a payment, which rule #44 says
      // cannot happen.
      this.logger.error(`Cannot settle booking ${input.bookingId}: no live payment`)
      return { action: "none" as const, amount: 0 }
    }

    const result =
      settlement.action === "refund"
        ? await this.refund({ payment: primary, amount: settlement.amount })
        : await this.chargePenalty({ payment: primary, amount: settlement.amount })

    // The authorization has done its job either way. Left in place it sits on
    // the guest's available balance for days after a booking they no longer
    // have — the commonest complaint about guaranteed rates anywhere.
    await this.voidFor(input.bookingId)

    return result
  }

  /**
   * Charges a card an earlier guarantee saved.
   *
   * Also the no-show fee. The penalty is its own row pointing at the guarantee
   * — the guarantee itself is not rewritten, because it is the record of a
   * card being verified and that remains true.
   */
  async chargePenalty(input: { payment: PaymentRow; amount: number }) {
    const { payment, amount } = input

    if (!payment.providerMethodRef) {
      this.logger.error(`Payment ${payment.id} has no saved card to charge`)
      return { action: "charge_penalty" as const, amount: 0, failed: true }
    }

    const penalty = await this.repo.createPenalty({
      bookingId: payment.bookingId,
      parentPaymentId: payment.id,
      amount,
      provider: this.provider.name,
      currency: payment.currency,
    })

    const result = await this.provider.chargeSavedCard({
      paymentId: penalty.id,
      providerMethodRef: payment.providerMethodRef,
      amount,
      currency: payment.currency,
      description: `Cancellation charge · ${payment.bookingId}`,
    })

    await this.repo.advance({
      paymentId: penalty.id,
      fromStatus: "requires_payment_method",
      toStatus: result.outcome === "captured" ? "captured" : "failed",
      capturedAt: result.outcome === "captured" ? new Date().toISOString() : null,
      ...(result.cardBrand ? { cardBrand: result.cardBrand } : {}),
      ...(result.cardLast4 ? { cardLast4: result.cardLast4 } : {}),
      ...(result.failureReason ? { failureReason: result.failureReason } : {}),
    })
    await this.repo.attachProviderRef({
      paymentId: penalty.id,
      providerRef: result.providerRef,
      status: result.outcome === "captured" ? "captured" : "failed",
    })

    return {
      action: "charge_penalty" as const,
      amount: result.outcome === "captured" ? amount : 0,
      failed: result.outcome !== "captured",
    }
  }

  /**
   * Sends money back.
   *
   * The idempotency key names the INSTRUCTION, not the amount.
   *
   * It used to be `refund:<payment>:<amount>`, which is right for a retry and
   * wrong for two different refunds that happen to be equal. The provider
   * deduplicates on the key and replays the first result, while this method
   * increments `amount_refunded` regardless — so a second goodwill refund of
   * the same size reported success, sent nothing, and left the ledger claiming
   * twice what the guest received.
   *
   * Nothing could reach it until the platform refund existed: no other caller
   * issues two separate refunds of one amount against one payment. It is
   * pinned by `refund-idempotency.spec.ts`.
   *
   * The default keeps every existing caller exactly as it was — a cancellation
   * settles once per booking, so amount alone identifies it there.
   */
  async refund(input: { payment: PaymentRow; amount: number; idempotencyKey?: string }) {
    const { payment } = input

    const available = refundableAmount({
      status: payment.status as PaymentStatus,
      amount: payment.amount,
      amountRefunded: payment.amountRefunded,
    })
    const amount = Math.min(input.amount, available)
    if (amount <= 0) return { action: "refund" as const, amount: 0 }

    if (!payment.providerRef) {
      this.logger.error(`Payment ${payment.id} has no provider reference to refund`)
      return { action: "refund" as const, amount: 0 }
    }

    const { refunded, replayed } = await this.provider.refund({
      providerRef: payment.providerRef,
      amount,
      idempotencyKey: input.idempotencyKey ?? `refund:${payment.id}:${amount}`,
    })
    if (refunded <= 0) return { action: "refund" as const, amount: 0 }

    /*
     * A replay sent nothing, so nothing is recorded.
     *
     * The provider reports the SAME amount for a replay as for a fresh
     * refund, and incrementing `amount_refunded` on it books money that never
     * left — the ledger then claims twice what the guest received. The amount
     * is still returned, because the caller's instruction did succeed; it just
     * succeeded the first time.
     */
    if (replayed) return { action: "refund" as const, amount: refunded, replayed: true }

    await this.repo.recordRefund({
      paymentId: payment.id,
      amount: refunded,
      toStatus: statusAfterRefund({ amount: payment.amount }, payment.amountRefunded + refunded),
    })

    return { action: "refund" as const, amount: refunded }
  }

  /** Releases an authorization a cancelled booking no longer needs. */
  async voidFor(bookingId: string) {
    const primary = await this.repo.findLivePrimary(bookingId)
    if (!primary || primary.status !== "authorized" || !primary.providerRef) return

    await this.provider.cancelIntent(primary.providerRef)
    await this.repo.advance({
      paymentId: primary.id,
      fromStatus: "authorized",
      toStatus: "cancelled",
    })
  }

  /* ----------------------------------------------------------------- read */

  /** The ledger for one booking — the guest's own, or a 404. */
  async listForBooking(bookingId: string, user: AuthenticatedUser): Promise<PaymentView[]> {
    const booking = await this.repo.findOwnedBooking({ bookingId, userId: user.id })
    if (!booking) throw new NotFoundException("Booking not found")

    const rows = await this.repo.listForBooking(bookingId)
    return rows.map(toView)
  }

  private sessionOf(payment: PaymentRow, mode: PaymentMode): PaymentSession {
    return {
      paymentId: payment.id,
      status: payment.status as PaymentStatus,
      mode,
      amount: payment.amount,
      currency: payment.currency,
      clientSecret: null,
      redirectUrl: null,
    }
  }
}

/**
 * Explicit fields (API3).
 *
 * `providerRef`, `providerMethodRef` and `provider` are all absent. They
 * identify a payment instrument at the processor, and a checkout page has no
 * use for them — while anyone who collected them would have the handles to a
 * person's saved cards.
 */
function toView(row: PaymentRow): PaymentView {
  return {
    id: row.id,
    bookingId: row.bookingId,
    kind: row.kind as PaymentView["kind"],
    status: row.status as PaymentStatus,
    amount: row.amount,
    amountRefunded: row.amountRefunded,
    currency: row.currency,
    cardBrand: row.cardBrand,
    cardLast4: row.cardLast4,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
  }
}
