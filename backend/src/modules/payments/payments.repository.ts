import { Inject, Injectable } from "@nestjs/common"
import { and, desc, eq, inArray, sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import { bookings, paymentEvents, payments } from "../../db/schema"

export type PaymentRow = typeof payments.$inferSelect

/**
 * The predicate of the `payments_one_live_primary` partial index.
 *
 * It has to match the index definition exactly, so it is written once and
 * used by the only statement that needs it.
 */
const LIVE_PRIMARY = sql`kind IN ('charge', 'guarantee') AND status NOT IN ('failed', 'cancelled')`

/** The live states — anything else is a finished attempt. */
const LIVE_STATUSES = [
  "requires_payment_method",
  "requires_action",
  "authorized",
  "captured",
  "partially_refunded",
  "refunded",
]

@Injectable()
export class PaymentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* ----------------------------------------------------------------- write */

  /**
   * Creates the primary payment for a booking.
   *
   * `onConflictDoNothing` against the partial unique index rather than a
   * read-then-write: two clicks on "Pay now" arrive together, both see no live
   * payment, and only the index can settle which one exists. The loser reads
   * the winner's row and resumes it — the guest gets one intent, not two
   * charges.
   */
  async createPrimary(row: {
    bookingId: string
    kind: "charge" | "guarantee"
    amount: number
    provider: string
    currency: string
  }) {
    const [created] = await this.db
      .insert(payments)
      .values(row)
      // `targetWhere` is not optional here. The index is PARTIAL, and without
      // the matching predicate Postgres cannot tell which index is meant and
      // refuses the statement outright — verified against the database, since
      // TypeScript is perfectly happy either way.
      .onConflictDoNothing({ target: payments.bookingId, where: LIVE_PRIMARY })
      .returning()
    return created ?? null
  }

  /** A penalty or no-show fee, charged against an earlier guarantee. */
  async createPenalty(row: {
    bookingId: string
    parentPaymentId: string
    amount: number
    provider: string
    currency: string
  }) {
    const [created] = await this.db
      .insert(payments)
      .values({ ...row, kind: "penalty" })
      .returning()
    return created!
  }

  async attachProviderRef(input: {
    paymentId: string
    providerRef: string
    status: string
    providerMethodRef?: string
  }) {
    const [row] = await this.db
      .update(payments)
      .set({
        providerRef: input.providerRef,
        status: input.status,
        ...(input.providerMethodRef ? { providerMethodRef: input.providerMethodRef } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(payments.id, input.paymentId))
      .returning()
    return row ?? null
  }

  /**
   * Moves a payment forward, guarded on the status it is moving FROM.
   *
   * The guard is what makes a replayed webhook harmless at the row level, on
   * top of the event table: a second `captured` finds the row already captured,
   * matches nothing, and changes nothing.
   */
  async advance(input: {
    paymentId: string
    fromStatus: string
    toStatus: string
    capturedAt?: string | null
    cardBrand?: string
    cardLast4?: string
    providerMethodRef?: string
    failureReason?: string | null
  }) {
    const [row] = await this.db
      .update(payments)
      .set({
        status: input.toStatus,
        ...(input.capturedAt !== undefined ? { capturedAt: input.capturedAt } : {}),
        ...(input.cardBrand ? { cardBrand: input.cardBrand } : {}),
        ...(input.cardLast4 ? { cardLast4: input.cardLast4 } : {}),
        ...(input.providerMethodRef ? { providerMethodRef: input.providerMethodRef } : {}),
        ...(input.failureReason !== undefined ? { failureReason: input.failureReason } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(payments.id, input.paymentId), eq(payments.status, input.fromStatus)))
      .returning()
    return row ?? null
  }

  /**
   * Records cents sent back, and the status that follows.
   *
   * The increment happens in SQL — `amount_refunded + $n`, never a figure read
   * in JavaScript and written back. Two refunds landing together would both
   * read the old total and both write the same new one, quietly losing one of
   * them from the ledger while the money really left.
   */
  async recordRefund(input: { paymentId: string; amount: number; toStatus: string }) {
    const [row] = await this.db
      .update(payments)
      .set({
        amountRefunded: sql`${payments.amountRefunded} + ${input.amount}`,
        status: input.toStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(payments.id, input.paymentId))
      .returning()
    return row ?? null
  }

  /* ------------------------------------------------------------------ read */

  async findById(id: string) {
    const [row] = await this.db.select().from(payments).where(eq(payments.id, id)).limit(1)
    return row ?? null
  }

  async findByProviderRef(provider: string, providerRef: string) {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.provider, provider), eq(payments.providerRef, providerRef)))
      .limit(1)
    return row ?? null
  }

  /** The live primary payment for a booking, if it has one. */
  async findLivePrimary(bookingId: string) {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.bookingId, bookingId),
          inArray(payments.kind, ["charge", "guarantee"]),
          inArray(payments.status, LIVE_STATUSES)
        )
      )
      .limit(1)
    return row ?? null
  }

  async listForBooking(bookingId: string) {
    return this.db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .orderBy(desc(payments.createdAt))
  }

  /**
   * The booking a payment is for, scoped to its owner.
   *
   * The ownership filter is in the query (API1): somebody else's booking is not
   * something to pay for, and it does not exist here.
   */
  async findOwnedBooking(input: { bookingId: string; userId: string }) {
    const [row] = await this.db
      .select({
        id: bookings.id,
        ref: bookings.ref,
        status: bookings.status,
        total: bookings.total,
        paymentMode: bookings.paymentMode,
        propertyName: bookings.propertyName,
        guestEmail: bookings.guestEmail,
        guestFirstName: bookings.guestFirstName,
        guestLastName: bookings.guestLastName,
        holdExpiresAt: bookings.holdExpiresAt,
      })
      .from(bookings)
      .where(and(eq(bookings.id, input.bookingId), eq(bookings.customerId, input.userId)))
      .limit(1)
    return row ?? null
  }

  /* --------------------------------------------------------------- events */

  /**
   * Claims a provider event, or reports that it was already handled (#45).
   *
   * The insert IS the claim. Checking first and inserting after would leave the
   * window that matters: providers retry aggressively, and two deliveries of
   * the same `payment.captured` arriving together would both find nothing and
   * both confirm the booking.
   */
  async claimEvent(input: {
    provider: string
    eventId: string
    type: string
    paymentId: string | null
    payload: unknown
  }) {
    const inserted = await this.db
      .insert(paymentEvents)
      .values({
        provider: input.provider,
        eventId: input.eventId,
        type: input.type,
        paymentId: input.paymentId,
        payload: input.payload,
      })
      .onConflictDoNothing({ target: [paymentEvents.provider, paymentEvents.eventId] })
      .returning()

    return inserted.length > 0
  }
}
