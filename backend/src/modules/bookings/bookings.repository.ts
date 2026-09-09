import { Inject, Injectable } from "@nestjs/common"
import type { BookingAddOn, ISODate } from "@stayora/shared"
import { allocateNightly, bookingPricingSchema, datesInRange } from "@stayora/shared"
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, or, sql, type SQL } from "drizzle-orm"

import { decodeCursor, encodeCursor, pageOf } from "../../common/pagination/keyset"
import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  bookingAddOns,
  bookingEvents,
  bookingNights,
  bookings,
  idempotencyKeys,
  roomInventory,
} from "../../db/schema"


/** The transaction handle Drizzle hands a callback — spelled once, here. */
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0]

/**
 * Writes a booking's stay-date ledger (rule #62).
 *
 * One row per night, carrying that night's share of the room revenue net of
 * promotion. Derived from the booking row itself rather than from anything the
 * caller passes, so the ledger cannot drift from the stay it describes.
 *
 * Called from both the create and the modify transactions. A modify deletes
 * first: the stay may have moved to different dates entirely, and an upsert
 * keyed on `(booking_id, date)` would leave the vacated nights behind, still
 * reporting revenue on nights nobody is staying.
 */
async function writeNights(tx: Tx, booking: typeof bookings.$inferSelect) {
  const pricing = bookingPricingSchema.parse(booking.pricing)
  const dates = datesInRange(booking.checkIn as ISODate, booking.checkOut as ISODate)

  /*
   * The two must agree — one rate per night is what the quote produced. If
   * they ever disagree the pricing is wrong, not the ledger, and writing
   * whichever is shorter would bury that under quietly missing revenue.
   */
  if (dates.length !== pricing.nightlyRates.length) {
    throw new Error(
      `Booking ${booking.id}: ${dates.length} nights but ${pricing.nightlyRates.length} rates`
    )
  }

  await tx.delete(bookingNights).where(eq(bookingNights.bookingId, booking.id))
  if (dates.length === 0) return

  const shares = allocateNightly({
    nightlyRates: pricing.nightlyRates,
    discount: pricing.discount?.amount ?? 0,
  })

  await tx.insert(bookingNights).values(
    dates.map((date, i) => ({
      bookingId: booking.id,
      date,
      propertyId: booking.propertyId,
      roomId: booking.roomId,
      ratePlanId: booking.ratePlanId,
      roomRevenue: shares[i]!,
    }))
  )
}

/** Raised when the DB's overbooking CHECK rejects a write. */
export class SoldOutError extends Error {
  constructor() {
    super("Those dates were just taken")
    this.name = "SoldOutError"
  }
}

const OVERBOOKING_CONSTRAINT = "room_inventory_no_overbooking"

/**
 * Derived from the table, never hand-written.
 *
 * The hand-written version drifted silently: it still carried `paymentMethod`
 * and `paymentStatus` after Module 7 replaced them, and TypeScript said
 * nothing — excess-property checks do not apply to a variable passed to
 * `.values()`, only to an object literal written there. Deriving it means the
 * next column that moves is a compile error instead of a runtime surprise.
 */
export type CreateBookingRow = typeof bookings.$inferInsert


@Injectable()
export class BookingsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Creates a booking and claims its inventory in ONE transaction.
   *
   * This is the only place in the system that can actually say "sold out" and
   * be believed. Everything in `shared/domain/availability.ts` is advisory —
   * by the time it answers, the snapshot it read is already stale, and two
   * guests can both be told "1 room left" and both be right.
   *
   * The sequence matters:
   *
   *   1. materialise the stay's inventory rows (the calendar is sparse, and a
   *      row that does not exist cannot be locked)
   *   2. lock them ORDER BY date ASC
   *   3. re-verify against the LOCKED numbers
   *   4. increment — the CHECK constraint is the real gate
   *   5. write the booking, its extras, and its first event
   */
  async createWithInventory(input: {
    row: CreateBookingRow
    addOns: BookingAddOn[]
    actorId: string | null
    actor: string
    verify: (locked: { date: string; sellableUnits: number; bookedUnits: number; isClosed: boolean | null }[]) => void
  }) {
    return this.db.transaction(async (tx) => {
      const { roomId } = input.row

      // 1. Materialise. `DO NOTHING` so a concurrent creator does not collide;
      //    total/sellable are seeded from the room, which is what gives the
      //    row-level CHECK something to compare against.
      await tx.execute(sql`
        INSERT INTO ${roomInventory} (room_id, date, total_units, sellable_units, booked_units)
        SELECT r.id, d::date, r.units, r.units, 0
        FROM rooms r
        CROSS JOIN generate_series(${input.row.checkIn}::date,
                                   ${input.row.checkOut}::date - 1, '1 day') AS d
        WHERE r.id = ${roomId}
        ORDER BY d
        ON CONFLICT (room_id, date) DO NOTHING
      `)

      // 2. Lock, in a FIXED order.
      //
      //    `ORDER BY date ASC` is not tidiness. Two overlapping bookings that
      //    took their locks in different orders would deadlock — one holding
      //    the 12th waiting for the 13th while the other holds the 13th
      //    waiting for the 12th. One order for everybody means never.
      const locked = await tx.execute<{
        date: string
        sellable_units: number
        booked_units: number
        is_closed: boolean | null
      }>(sql`
        SELECT date::text AS date, sellable_units, booked_units, is_closed
        FROM ${roomInventory}
        WHERE room_id = ${roomId}
          AND date >= ${input.row.checkIn}::date
          AND date <  ${input.row.checkOut}::date
        ORDER BY date ASC
        FOR UPDATE
      `)

      // 3. Verify against what is actually true right now, under the lock.
      input.verify(
        locked.rows.map((r) => ({
          date: r.date,
          sellableUnits: r.sellable_units,
          bookedUnits: r.booked_units,
          isClosed: r.is_closed,
        }))
      )

      // 4. Claim. If a concurrent transaction got the last unit, the CHECK
      //    rejects this one — which is the entire point.
      try {
        await tx.execute(sql`
          UPDATE ${roomInventory}
          SET booked_units = booked_units + 1, updated_at = now()
          WHERE room_id = ${roomId}
            AND date >= ${input.row.checkIn}::date
            AND date <  ${input.row.checkOut}::date
        `)
      } catch (error) {
        if (isOverbooking(error)) throw new SoldOutError()
        throw error
      }

      // 5. The booking itself.
      const [created] = await tx.insert(bookings).values(input.row).returning()
      if (!created) throw new Error("Failed to create booking")

      if (input.addOns.length > 0) {
        await tx.insert(bookingAddOns).values(
          input.addOns.map((a) => ({
            bookingId: created.id,
            valueAddId: a.valueAddId,
            name: a.name,
            unit: a.unit,
            unitPrice: a.unitPrice,
            qty: a.qty,
            amount: a.amount,
          }))
        )
      }

      await tx.insert(bookingEvents).values({
        bookingId: created.id,
        fromStatus: null,
        toStatus: created.status,
        actorId: input.actorId,
        actor: input.actor,
        reason: null,
      })

      // The stay-date ledger (rule #62), in the same transaction that claimed
      // the inventory — a booking that exists without its nights would be
      // invisible to every analytics screen.
      await writeNights(tx, created)

      return created
    })
  }

  /**
   * Moves a booking to new dates, swapping its inventory atomically.
   *
   * Old dates are RELEASED and new ones CLAIMED inside one transaction, over a
   * lock taken on the UNION of both ranges in date order. Releasing first is
   * what lets a stay shift by a night without blocking itself — the booking
   * would otherwise be competing with its own held units.
   *
   * If the new dates cannot take it, the CHECK rejects the whole thing and the
   * old dates are never actually given up.
   */
  async modifyWithInventorySwap(input: {
    bookingId: string
    fromStatus: string
    roomId: string
    oldCheckIn: ISODate
    oldCheckOut: ISODate
    newCheckIn: ISODate
    newCheckOut: ISODate
    patch: Record<string, unknown>
    actorId: string | null
    actor: string
    reason: string
    verify: (locked: { date: string; sellableUnits: number; bookedUnits: number; isClosed: boolean | null }[]) => void
  }) {
    return this.db.transaction(async (tx) => {
      // Materialise any new dates that have no row yet.
      await tx.execute(sql`
        INSERT INTO ${roomInventory} (room_id, date, total_units, sellable_units, booked_units)
        SELECT r.id, d::date, r.units, r.units, 0
        FROM rooms r
        CROSS JOIN generate_series(${input.newCheckIn}::date, ${input.newCheckOut}::date - 1, '1 day') AS d
        WHERE r.id = ${input.roomId}
        ORDER BY d
        ON CONFLICT (room_id, date) DO NOTHING
      `)

      // Lock BOTH ranges together, in one ascending order — the same ordering
      // rule as create, for the same reason.
      await tx.execute(sql`
        SELECT 1 FROM ${roomInventory}
        WHERE room_id = ${input.roomId}
          AND (
            (date >= ${input.oldCheckIn}::date AND date < ${input.oldCheckOut}::date)
            OR (date >= ${input.newCheckIn}::date AND date < ${input.newCheckOut}::date)
          )
        ORDER BY date ASC
        FOR UPDATE
      `)

      // Release the old nights FIRST, so a shifted stay does not block itself.
      await tx.execute(sql`
        UPDATE ${roomInventory}
        SET booked_units = GREATEST(booked_units - 1, 0), updated_at = now()
        WHERE room_id = ${input.roomId}
          AND date >= ${input.oldCheckIn}::date
          AND date <  ${input.oldCheckOut}::date
      `)

      const locked = await tx.execute<{
        date: string
        sellable_units: number
        booked_units: number
        is_closed: boolean | null
      }>(sql`
        SELECT date::text AS date, sellable_units, booked_units, is_closed
        FROM ${roomInventory}
        WHERE room_id = ${input.roomId}
          AND date >= ${input.newCheckIn}::date
          AND date <  ${input.newCheckOut}::date
        ORDER BY date ASC
      `)

      input.verify(
        locked.rows.map((r) => ({
          date: r.date,
          sellableUnits: r.sellable_units,
          bookedUnits: r.booked_units,
          isClosed: r.is_closed,
        }))
      )

      try {
        await tx.execute(sql`
          UPDATE ${roomInventory}
          SET booked_units = booked_units + 1, updated_at = now()
          WHERE room_id = ${input.roomId}
            AND date >= ${input.newCheckIn}::date
            AND date <  ${input.newCheckOut}::date
        `)
      } catch (error) {
        if (isOverbooking(error)) throw new SoldOutError()
        throw error
      }

      const [updated] = await tx
        .update(bookings)
        .set({ ...input.patch, updatedAt: new Date().toISOString() })
        .where(and(eq(bookings.id, input.bookingId), eq(bookings.status, input.fromStatus)))
        .returning()

      if (!updated) return null

      // A modification is not a status change, so `from` and `to` are the same
      // — the row exists to record that the stay moved, and why.
      await tx.insert(bookingEvents).values({
        bookingId: input.bookingId,
        fromStatus: input.fromStatus,
        toStatus: input.fromStatus,
        actorId: input.actorId,
        actor: input.actor,
        reason: input.reason,
      })

      // The stay moved, so its nights did too — old dates dropped, new ones
      // written from the re-quoted pricing. Leaving the old rows behind would
      // report revenue on nights the guest is no longer staying.
      await writeNights(tx, updated)

      return updated
    })
  }

  /** Replaces a booking's extras wholesale. */
  async replaceAddOns(bookingId: string, addOns: BookingAddOn[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(bookingAddOns).where(eq(bookingAddOns.bookingId, bookingId))
      if (addOns.length > 0) {
        await tx.insert(bookingAddOns).values(
          addOns.map((a) => ({
            bookingId,
            valueAddId: a.valueAddId,
            name: a.name,
            unit: a.unit,
            unitPrice: a.unitPrice,
            qty: a.qty,
            amount: a.amount,
          }))
        )
      }
    })
  }

  /**
   * Releases a booking's inventory and records the cancellation, atomically.
   *
   * The release is `GREATEST(booked_units - 1, 0)` rather than a bare
   * decrement: a row that has somehow drifted to zero must not go negative and
   * fail the CHECK, turning a data problem into an unfixable booking.
   */
  async cancelWithRelease(input: {
    bookingId: string
    fromStatus: string
    cancelledBy: "guest" | "property" | "admin"
    reason: string
    refundAmount: number
    refundStatus: string
    actorId: string | null
    actor: string
    roomId: string
    checkIn: ISODate
    checkOut: ISODate
    /** Database work to run inside the same transaction — see `transition`. */
    within?: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<void>
  }) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(bookings)
        .set({
          status: "cancelled",
          // A cancelled booking is not holding anything (rule #44).
          holdExpiresAt: null,
          cancelledAt: new Date().toISOString(),
          cancelledBy: input.cancelledBy,
          cancellationReason: input.reason,
          refundAmount: input.refundAmount,
          refundStatus: input.refundStatus,
          // Commission is only earned by a stay that happened (rule #9). The
          // amount is kept for reporting, not zeroed.
          commissionStatus: "void",
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(bookings.id, input.bookingId), eq(bookings.status, input.fromStatus)))
        .returning()

      // The status guard above is a second line against a double-cancel racing
      // itself: if it matched nothing, someone else already moved this booking.
      if (!updated) return null

      await tx.execute(sql`
        UPDATE ${roomInventory}
        SET booked_units = GREATEST(booked_units - 1, 0), updated_at = now()
        WHERE room_id = ${input.roomId}
          AND date >= ${input.checkIn}::date
          AND date <  ${input.checkOut}::date
      `)

      await tx.insert(bookingEvents).values({
        bookingId: input.bookingId,
        fromStatus: input.fromStatus,
        toStatus: "cancelled",
        actorId: input.actorId,
        actor: input.actor,
        reason: input.reason,
      })

      await input.within?.(tx)

      return updated
    })
  }

  /** A plain status move, with its audit row. */
  /**
   * Moves a booking between states.
   *
   * `within` runs INSIDE the transaction, after the row and its audit event
   * have been written and only if the guarded update actually matched. It
   * exists so a notification can be queued atomically with the thing it
   * describes (rule #57): without it the event commits, the process can die,
   * and the guest is never told — with no record that anything was owed them.
   *
   * It is for DATABASE work only. A provider call in here would hold the
   * booking's rows locked across the internet (rule #45).
   */
  async transition(input: {
    bookingId: string
    fromStatus: string
    toStatus: string
    actorId: string | null
    actor: string
    reason?: string
    patch?: Record<string, unknown>
    within?: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<void>
  }) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(bookings)
        .set({
          status: input.toStatus,
          /*
           * Leaving `pending` always drops the hold (rule #44).
           *
           * `bookings_hold_consistency` refuses a non-pending booking that
           * still carries one, so forgetting it here is a failed transition
           * rather than a booking the sweeper comes back to collect. Done in
           * one place so every caller inherits it; `patch` can still override.
           */
          ...(input.toStatus === "pending" ? {} : { holdExpiresAt: null }),
          ...(input.patch ?? {}),
          updatedAt: new Date().toISOString(),
        })
        // Guarded on the CURRENT status, so two concurrent transitions cannot
        // both succeed.
        .where(and(eq(bookings.id, input.bookingId), eq(bookings.status, input.fromStatus)))
        .returning()

      if (!updated) return null

      await tx.insert(bookingEvents).values({
        bookingId: input.bookingId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actorId: input.actorId,
        actor: input.actor,
        reason: input.reason ?? null,
      })

      await input.within?.(tx)

      return updated
    })
  }

  /* ----------------------------------------------------------------- reads */

  async findById(id: string) {
    const [row] = await this.db.select().from(bookings).where(eq(bookings.id, id)).limit(1)
    return row ?? null
  }

  async findByRef(ref: string) {
    const [row] = await this.db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1)
    return row ?? null
  }

  async addOnsFor(bookingId: string) {
    return this.db.select().from(bookingAddOns).where(eq(bookingAddOns.bookingId, bookingId))
  }

  /**
   * How many stays this guest has actually completed (rules #3, #53).
   *
   * Completed, not booked. A guest who reserves ten rooms and cancels them all
   * has demonstrated nothing, and tying a discount to bookings rather than
   * stays is an invitation to do precisely that.
   */
  async countCompletedFor(customerId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.customerId, customerId), eq(bookings.status, "completed")))
    return Number(row?.count ?? 0)
  }

  /**
   * A guest's own bookings, newest first.
   *
   * Keyed on `created_at` with the id breaking ties: two bookings made inside
   * one transaction share `now()` exactly, and without the tiebreak one of
   * them falls into the gap between pages.
   */
  async listForCustomer(input: { customerId: string; limit: number; cursor?: string }) {
    const where: SQL[] = [eq(bookings.customerId, input.customerId)]

    const cursor = decodeCursor(input.cursor)
    if (cursor) {
      where.push(
        or(
          lt(bookings.createdAt, cursor.value),
          and(eq(bookings.createdAt, cursor.value), gt(bookings.id, cursor.id))
        )!
      )
    }

    const rows = await this.db
      .select()
      .from(bookings)
      .where(and(...where))
      .orderBy(desc(bookings.createdAt), asc(bookings.id))
      .limit(input.limit + 1)

    return pageOf(rows, input.limit, (row) => encodeCursor(row.createdAt, row.id))
  }

  /**
   * Every booking across the properties a partner may see, soonest arrival
   * first.
   *
   * The tiebreak matters MORE here than anywhere else: `check_in` is a DATE,
   * so a hotel with three arrivals on one day has three rows sharing the sort
   * value. A cursor of `check_in > '2027-03-08'` alone would skip the other
   * two — silently, from a list that looks complete.
   */
  async listForProperties(input: {
    propertyIds: string[]
    limit: number
    cursor?: string
    status?: string
    from?: string
    to?: string
  }) {
    if (input.propertyIds.length === 0) return { items: [], nextCursor: null }

    const where: SQL[] = [inArray(bookings.propertyId, input.propertyIds)]
    if (input.status) where.push(eq(bookings.status, input.status))
    // By STAY, not by booking date: an arrivals list is a question about dates
    // the guest will be here, and a booking spans them.
    if (input.from) where.push(gte(bookings.checkOut, input.from))
    if (input.to) where.push(lte(bookings.checkIn, input.to))

    const cursor = decodeCursor(input.cursor)
    if (cursor) {
      where.push(
        or(
          gt(bookings.checkIn, cursor.value),
          and(eq(bookings.checkIn, cursor.value), gt(bookings.id, cursor.id))
        )!
      )
    }

    const rows = await this.db
      .select()
      .from(bookings)
      .where(and(...where))
      .orderBy(asc(bookings.checkIn), asc(bookings.id))
      .limit(input.limit + 1)

    return pageOf(rows, input.limit, (row) => encodeCursor(row.checkIn, row.id))
  }

  /* ------------------------------------------------- the nightly ledger */

  /**
   * Bookings whose nightly ledger is missing.
   *
   * `booking_nights` is written inside the create and modify transactions, so
   * it only ever covered bookings made AFTER the table existed — every stay
   * older than it is invisible to occupancy and ADR, and the reports simply
   * show a shorter history without saying why.
   *
   * Written as a repair rather than a one-off backfill script, because "the
   * table is new" is only one of the ways rows go missing: a modify that
   * failed between the delete and the insert leaves exactly this state, and a
   * script that ran once in 2026 would not catch it.
   */
  async bookingsMissingNights(limit: number) {
    const rows = await this.db
      .select()
      .from(bookings)
      .where(
        sql`NOT EXISTS (SELECT 1 FROM ${bookingNights} n WHERE n.booking_id = ${bookings.id})`
      )
      .orderBy(asc(bookings.createdAt))
      .limit(limit)
    return rows
  }

  /**
   * Rebuilds one booking's nights, in its own transaction.
   *
   * Per booking, deliberately. `writeNights` throws when a booking's dates and
   * its stored nightly rates disagree — a real possibility in old data — and
   * one such row must not take the rest of the backfill down with it. The
   * caller logs and moves on.
   */
  async rebuildNights(bookingId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId))
      if (!booking) return false
      await writeNights(tx, booking)
      return true
    })
  }

  /* ------------------------------------------------------ the stay clock */

  /*
   * All three read the date in the PROPERTY's timezone, not the server's.
   *
   * "Tomorrow" is not a fact about where this process happens to run. A hotel
   * in Paris and one in New York start their day six hours apart, and a
   * reminder sent on the server's calendar reaches half of them a day early
   * and the other half the morning they arrive. `now() AT TIME ZONE
   * p.timezone` is the guest's tomorrow, which is the only one that matters.
   */

  /**
   * Stays the desk checked in and never checked out.
   *
   * The state machine has always permitted `system` to close a stay — the
   * comment beside it even says "the nightly sweep closes stays the desk
   * forgot to check out". The sweep was simply never written, so bookings sat
   * in `checked_in` forever, and since `canReview` requires `completed`,
   * NOBODY could ever leave a review.
   */
  async checkedInStaysToClose(limit: number) {
    const result = await this.db.execute(sql`
      SELECT b.id
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE b.status = 'checked_in'
        AND b.check_out <= (now() AT TIME ZONE p.timezone)::date
      ORDER BY b.check_out ASC
      LIMIT ${limit}
    `)
    return (result.rows as Record<string, unknown>[]).map((row) => String(row.id))
  }

  /** Confirmed stays that begin tomorrow, where the guest is. */
  async staysStartingTomorrow(limit: number) {
    const result = await this.db.execute(sql`
      SELECT b.id, b.ref, b.customer_id, b.guest_email, b.property_name,
             b.check_in, b.check_out, p.check_in_time
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE b.status = 'confirmed'
        AND b.check_in = ((now() AT TIME ZONE p.timezone)::date + 1)
      ORDER BY b.check_in ASC
      LIMIT ${limit}
    `)
    return (result.rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      ref: String(row.ref),
      customerId: row.customer_id === null ? null : String(row.customer_id),
      guestEmail: String(row.guest_email),
      propertyName: String(row.property_name),
      checkIn: String(row.check_in).slice(0, 10),
      checkOut: String(row.check_out).slice(0, 10),
      checkInTime: String(row.check_in_time),
    }))
  }

  /**
   * Finished stays with no review yet, still inside the window.
   *
   * `customer_id IS NOT NULL` because the review form lives in the dashboard:
   * asking somebody with no account to write one sends them to a door they
   * cannot open. And `check_out < today`, not `<=` — a request that arrives
   * while they are still packing is asking about a stay that is not over.
   */
  async staysAwaitingReview(input: { windowDays: number; limit: number }) {
    const result = await this.db.execute(sql`
      SELECT b.id, b.ref, b.customer_id, b.guest_email, b.property_name, b.check_out
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      LEFT JOIN reviews r ON r.booking_id = b.id
      WHERE b.status = 'completed'
        AND r.id IS NULL
        AND b.customer_id IS NOT NULL
        AND b.check_out < (now() AT TIME ZONE p.timezone)::date
        AND ((now() AT TIME ZONE p.timezone)::date - b.check_out) <= ${input.windowDays}
      ORDER BY b.check_out DESC
      LIMIT ${input.limit}
    `)
    return (result.rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      ref: String(row.ref),
      customerId: String(row.customer_id),
      guestEmail: String(row.guest_email),
      propertyName: String(row.property_name),
      checkOut: String(row.check_out).slice(0, 10),
    }))
  }

  async eventsFor(bookingId: string) {
    return this.db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, bookingId))
      .orderBy(asc(bookingEvents.createdAt))
  }

  /* ---------------------------------------------------------- idempotency */

  /**
   * Claims an idempotency key, or reports the booking a previous call made.
   *
   * The unique index does the work: two simultaneous submits both try to
   * insert, one wins, and the loser reads back the winner's booking instead of
   * creating a second reservation.
   */
  async claimIdempotencyKey(input: { key: string; userId: string; requestHash: string }) {
    const inserted = await this.db
      .insert(idempotencyKeys)
      .values({ key: input.key, userId: input.userId, requestHash: input.requestHash })
      .onConflictDoNothing()
      .returning()

    if (inserted.length > 0) return { claimed: true as const }

    const [existing] = await this.db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, input.userId), eq(idempotencyKeys.key, input.key)))
      .limit(1)

    return { claimed: false as const, existing: existing ?? null }
  }

  async attachBookingToKey(input: { key: string; userId: string; bookingId: string }) {
    await this.db
      .update(idempotencyKeys)
      .set({ bookingId: input.bookingId })
      .where(and(eq(idempotencyKeys.userId, input.userId), eq(idempotencyKeys.key, input.key)))
  }

  async releaseIdempotencyKey(input: { key: string; userId: string }) {
    await this.db
      .delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, input.userId), eq(idempotencyKeys.key, input.key)))
  }

  /** Housekeeping — keys older than a day are of no further use. */
  async purgeIdempotencyKeys(before: Date) {
    await this.db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, before.toISOString()))
  }
}

function isOverbooking(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const candidate = error as { constraint?: string; message?: string; cause?: unknown }
  if (candidate.constraint === OVERBOOKING_CONSTRAINT) return true
  if (candidate.message?.includes(OVERBOOKING_CONSTRAINT)) return true
  // Drizzle wraps driver errors, so the real one is often a level down.
  return candidate.cause !== undefined && isOverbooking(candidate.cause)
}
