import { Inject, Injectable } from "@nestjs/common"
import { and, desc, eq, gte, lt, lte, ne, or, sql, type SQL } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import { bookings, reviews, users } from "../../db/schema"

/**
 * The platform's reads and writes (Module 11).
 *
 * Unscoped by design — this is the one surface that legitimately sees every
 * booking and every account. That is exactly why every route reaching it is
 * `@Roles("admin")` and every write it performs is audited (rule #77).
 */
@Injectable()
export class AdminRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* -------------------------------------------------------- reservations -- */

  /**
   * Every booking, searchable the way support actually searches.
   *
   * One `q` box across reference, guest email and guest name, because that is
   * what a person on a call has: a code the guest read out, or their name.
   * Matched case-insensitively on the SNAPSHOT columns — the booking's own
   * copy of who was staying, which is right even if the account changed since.
   */
  async searchBookings(input: {
    q?: string
    status?: string
    propertyId?: string
    customerId?: string
    from?: string
    to?: string
    limit: number
    before?: string
  }) {
    const where: SQL[] = []

    if (input.q) {
      const like = `%${input.q.toLowerCase()}%`
      where.push(
        or(
          sql`LOWER(${bookings.ref}) LIKE ${like}`,
          sql`LOWER(${bookings.guestEmail}) LIKE ${like}`,
          sql`LOWER(${bookings.guestFirstName} || ' ' || ${bookings.guestLastName}) LIKE ${like}`
        )!
      )
    }
    if (input.status) where.push(eq(bookings.status, input.status))
    if (input.propertyId) where.push(eq(bookings.propertyId, input.propertyId))
    if (input.customerId) where.push(eq(bookings.customerId, input.customerId))
    if (input.from) where.push(gte(sql`${bookings.createdAt}::date`, input.from))
    if (input.to) where.push(lte(sql`${bookings.createdAt}::date`, input.to))
    // Keyset, not offset: this list grows at the head while support reads it.
    if (input.before) where.push(lt(bookings.createdAt, input.before))

    const rows = await this.db
      .select()
      .from(bookings)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(bookings.createdAt))
      .limit(input.limit + 1)

    const hasMore = rows.length > input.limit
    const page = hasMore ? rows.slice(0, input.limit) : rows
    return {
      items: page,
      nextCursor: hasMore ? (page[page.length - 1]?.createdAt ?? null) : null,
    }
  }

  async findBooking(bookingId: string) {
    const [row] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)
    return row ?? null
  }

  /**
   * What actually moved on this booking, from the payments ledger.
   *
   * The refund ceiling is what was CAPTURED, never `bookings.total`: on a
   * `guarantee` rate the guest may have paid the platform nothing at all, and
   * measuring against the total would send back money that never came in
   * (rule #52).
   */
  async paymentTotals(bookingId: string) {
    const result = await this.db.execute<{ captured: string; refunded: string }>(sql`
      SELECT
        COALESCE(SUM(amount) FILTER (
          WHERE kind IN ('charge', 'penalty')
            AND status IN ('captured', 'refunded', 'partially_refunded')
        ), 0)::bigint AS captured,
        -- amount_refunded on the payment row, NOT a row of its own. There is
        -- no refund payment KIND: the kinds are charge, guarantee and penalty,
        -- and a refund is recorded by incrementing this column on the payment
        -- it came out of. A first attempt filtered on kind = refund, which
        -- matches nothing and would have reported every booking as never
        -- refunded -- letting the same money go back twice.
        COALESCE(SUM(amount_refunded), 0)::bigint AS refunded
      FROM payments
      WHERE booking_id = ${bookingId}::uuid
    `)

    const row = result.rows[0]
    return {
      captured: Number(row?.captured ?? 0),
      // The booking's `refund_amount` is the INTENDED figure; this is what the
      // ledger says actually went back.
      refunded: Number(row?.refunded ?? 0),
    }
  }

  async updateBooking(bookingId: string, patch: Partial<typeof bookings.$inferInsert>) {
    const [row] = await this.db
      .update(bookings)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(bookings.id, bookingId))
      .returning()
    return row ?? null
  }

  /* --------------------------------------------------------------- users -- */

  /**
   * How many accounts sit in each status, for one role.
   *
   * Counted over the whole table, not the page, because the number is for the
   * stat tiles and the status tabs — "3 suspended" has to mean three suspended
   * accounts, not three on the fifty rows in view.
   *
   * Scoped by ROLE and nothing else: the Guests screen and the Managers screen
   * are two different populations, and a shared total would be right for
   * neither. The caller's search is deliberately not applied — a tile that
   * moves while somebody types is a second result count, not a total.
   */
  async userCounts(role?: string): Promise<Record<string, number>> {
    const rows = await this.db
      .select({ status: users.status, n: sql<number>`COUNT(*)::int` })
      .from(users)
      .where(role ? eq(users.role, role) : undefined)
      .groupBy(users.status)

    return Object.fromEntries(rows.map((row) => [row.status, row.n]))
  }

  async searchUsers(input: {
    q?: string
    role?: string
    status?: string
    limit: number
    before?: string
  }) {
    const where: SQL[] = []

    if (input.q) {
      const like = `%${input.q.toLowerCase()}%`
      where.push(
        or(
          sql`LOWER(${users.email}) LIKE ${like}`,
          sql`LOWER(${users.firstName} || ' ' || ${users.lastName}) LIKE ${like}`
        )!
      )
    }
    if (input.role) where.push(eq(users.role, input.role))
    if (input.status) where.push(eq(users.status, input.status))
    if (input.before) where.push(lt(users.createdAt, input.before))

    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        platformRole: users.platformRole,
        status: users.status,
        tier: users.tier,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(input.limit + 1)

    const hasMore = rows.length > input.limit
    const page = hasMore ? rows.slice(0, input.limit) : rows
    return {
      items: page,
      nextCursor: hasMore ? (page[page.length - 1]?.createdAt ?? null) : null,
    }
  }

  /**
   * One account.
   *
   * Explicit columns, and no password hash — it is in `user_credentials` for
   * exactly this reason, and a `SELECT *` here is a normal thing to write.
   */
  async findUser(userId: string) {
    const [row] = await this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        country: users.country,
        role: users.role,
        platformRole: users.platformRole,
        status: users.status,
        tier: users.tier,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return row ?? null
  }

  async updateUser(
    userId: string,
    /*
     * `platformRole` is `string | null | undefined`, and the three mean three
     * different things: leave it alone, clear it, set it. Collapsing null and
     * undefined would make demoting an administrator impossible — the grade
     * would survive the demotion and the row would fail its own CHECK.
     */
    patch: { role?: string; platformRole?: string | null; status?: string }
  ) {
    const [row] = await this.db
      .update(users)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        platformRole: users.platformRole,
        status: users.status,
      })
    return row ?? null
  }

  /**
   * How many OTHER active platform admins there are (rule #81).
   *
   * The same shape as the org's last-admin guard, for the same reason one
   * level up: a platform with no administrator has no way back, because there
   * is nobody above it.
   */
  async countOtherActiveAdmins(exceptUserId: string) {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(users)
      .where(
        and(eq(users.role, "admin"), eq(users.status, "active"), ne(users.id, exceptUserId))
      )
    return Number(row?.count ?? 0)
  }

  /**
   * A guest's history, for the profile screen (rule #80).
   *
   * Spend counts realised bookings only — a cancelled stay is not money the
   * guest spent, and a "lifetime value" inflated by abandoned holds is worse
   * than no figure at all.
   */
  async guestStats(userId: string) {
    const result = await this.db.execute<{
      bookings: number
      completed: number
      cancelled: number
      spend: string
      reviews: number
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE b.status <> 'pending')::int AS bookings,
        COUNT(*) FILTER (WHERE b.status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE b.status IN ('cancelled', 'no_show'))::int AS cancelled,
        COALESCE(SUM(b.total) FILTER (
          WHERE b.status IN ('confirmed', 'checked_in', 'completed')
        ), 0)::bigint AS spend,
        (SELECT COUNT(*)::int FROM reviews rv WHERE rv.author_id = ${userId}::uuid) AS reviews
      FROM bookings b
      WHERE b.customer_id = ${userId}::uuid
    `)

    const row = result.rows[0]
    return {
      bookings: Number(row?.bookings ?? 0),
      completed: Number(row?.completed ?? 0),
      cancelled: Number(row?.cancelled ?? 0),
      spend: Number(row?.spend ?? 0),
      reviews: Number(row?.reviews ?? 0),
    }
  }

  /** A guest's bookings, newest first — the other half of their profile. */
  async bookingsForCustomer(userId: string, limit: number) {
    return this.db
      .select()
      .from(bookings)
      .where(eq(bookings.customerId, userId))
      .orderBy(desc(bookings.createdAt))
      .limit(limit)
  }

  /** Their reviews, so a complaint can be read next to what they wrote. */
  async reviewsForCustomer(userId: string, limit: number) {
    return this.db
      .select({
        id: reviews.id,
        propertyId: reviews.propertyId,
        rating: reviews.rating,
        title: reviews.title,
        status: reviews.status,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(eq(reviews.authorId, userId))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
  }

}
