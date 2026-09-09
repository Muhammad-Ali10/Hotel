import { Inject, Injectable } from "@nestjs/common"
import { and, asc, desc, eq, isNull, lt, or, sql, type SQL } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import { bookingMessages, supportMessages, supportThreads } from "../../db/schema"

export type ThreadRow = typeof supportThreads.$inferSelect
export type MessageRow = typeof supportMessages.$inferSelect

@Injectable()
export class SupportRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* -------------------------------------------------------------- threads -- */

  /**
   * A thread and its first message, together.
   *
   * In one transaction: a thread with no message is a ticket that says nothing,
   * and somebody in the queue would open it to find an empty page.
   */
  async open(input: {
    thread: typeof supportThreads.$inferInsert
    message: Omit<typeof supportMessages.$inferInsert, "threadId">
  }) {
    return this.db.transaction(async (tx) => {
      const [thread] = await tx.insert(supportThreads).values(input.thread).returning()
      await tx.insert(supportMessages).values({ ...input.message, threadId: thread!.id })
      return thread!
    })
  }

  async findById(threadId: string) {
    const [row] = await this.db
      .select()
      .from(supportThreads)
      .where(eq(supportThreads.id, threadId))
      .limit(1)
    return row ?? null
  }

  async messagesFor(threadId: string, includeInternal: boolean) {
    const where: SQL[] = [eq(supportMessages.threadId, threadId)]
    // An internal note is a colleague's aside. It never reaches the requester.
    if (!includeInternal) where.push(sql`${supportMessages.authorKind} <> 'internal'`)

    return this.db
      .select()
      .from(supportMessages)
      .where(and(...where))
      .orderBy(asc(supportMessages.createdAt))
  }

  /**
   * Adds a message and moves the thread's clock.
   *
   * One transaction, because a queue ordered by `last_message_at` is the only
   * ordering support works from — a message that landed without touching it
   * leaves the thread sitting where it was, and nobody sees the reply.
   */
  async reply(input: {
    threadId: string
    message: Omit<typeof supportMessages.$inferInsert, "threadId">
    /** An internal note is not the requester waiting, so it does not reorder. */
    touchesClock: boolean
    /** Set when the requester speaks on a resolved thread — it reopens. */
    reopen: boolean
  }) {
    return this.db.transaction(async (tx) => {
      const [message] = await tx
        .insert(supportMessages)
        .values({ ...input.message, threadId: input.threadId })
        .returning()

      const now = new Date().toISOString()
      const patch: Partial<typeof supportThreads.$inferInsert> = { updatedAt: now }
      if (input.touchesClock) patch.lastMessageAt = now
      if (input.reopen) {
        patch.status = "open"
        // The CHECK insists resolved and only resolved carries a time.
        patch.resolvedAt = null
      }

      await tx.update(supportThreads).set(patch).where(eq(supportThreads.id, input.threadId))
      return message!
    })
  }

  async updateThread(threadId: string, patch: Partial<typeof supportThreads.$inferInsert>) {
    const [row] = await this.db
      .update(supportThreads)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(supportThreads.id, threadId))
      .returning()
    return row ?? null
  }

  /* --------------------------------------------------------------- lists -- */

  /**
   * A guest's own tickets.
   *
   * Matched on the ACCOUNT, not the email address. Matching on email would
   * hand every ticket ever opened from an address to whoever registers it next.
   */
  async listForRequester(userId: string, limit: number) {
    return this.db
      .select()
      .from(supportThreads)
      .where(eq(supportThreads.requesterId, userId))
      .orderBy(desc(supportThreads.lastMessageAt))
      .limit(limit)
  }

  /** An org's tickets — the whole team's, not just the author's (rule #88). */
  async listForOrg(orgId: string, limit: number) {
    return this.db
      .select()
      .from(supportThreads)
      .where(and(eq(supportThreads.orgId, orgId), eq(supportThreads.audience, "partner")))
      .orderBy(desc(supportThreads.lastMessageAt))
      .limit(limit)
  }

  /**
   * The platform's queue.
   *
   * Ordered by `last_message_at` ASCENDING — longest wait first. Newest-first
   * is the ordering that lets a ticket sit for a week while fresh ones are
   * answered.
   */
  /**
   * How many threads sit in each status, across the whole queue.
   *
   * Counted over everything rather than over the page, because the number is
   * for the tabs and the sidebar badge — "3 open" has to mean three open
   * tickets, not three on the fifty rows somebody happens to be looking at.
   *
   * Deliberately NOT filtered by the caller's search: a badge that changes
   * when you type in a box is not a badge, it is a second result count.
   */
  async queueCounts(audience?: string) {
    const rows = await this.db
      .select({
        status: supportThreads.status,
        n: sql<number>`COUNT(*)::int`,
      })
      .from(supportThreads)
      .where(audience ? eq(supportThreads.audience, audience) : undefined)
      .groupBy(supportThreads.status)

    return Object.fromEntries(rows.map((row) => [row.status, row.n]))
  }

  async queue(input: {
    audience?: string
    status?: string
    priority?: string
    assigneeId?: string
    q?: string
    limit: number
    before?: string
  }) {
    const where: SQL[] = []
    if (input.audience) where.push(eq(supportThreads.audience, input.audience))
    if (input.status) where.push(eq(supportThreads.status, input.status))
    if (input.priority) where.push(eq(supportThreads.priority, input.priority))
    if (input.assigneeId) where.push(eq(supportThreads.assigneeId, input.assigneeId))
    if (input.before) where.push(lt(supportThreads.lastMessageAt, input.before))

    if (input.q) {
      const like = `%${input.q.toLowerCase()}%`
      where.push(
        or(
          sql`LOWER(${supportThreads.ref}) LIKE ${like}`,
          sql`LOWER(${supportThreads.subject}) LIKE ${like}`,
          sql`LOWER(${supportThreads.requesterEmail}) LIKE ${like}`
        )!
      )
    }

    const rows = await this.db
      .select()
      .from(supportThreads)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(asc(supportThreads.lastMessageAt))
      .limit(input.limit + 1)

    const hasMore = rows.length > input.limit
    const page = hasMore ? rows.slice(0, input.limit) : rows
    return {
      items: page,
      nextCursor: hasMore ? (page[page.length - 1]?.lastMessageAt ?? null) : null,
    }
  }

  /**
   * Links anonymous tickets to the account that just proved the address
   * (rule #86).
   *
   * Guarded on `requester_id IS NULL`, so it can only ever fill a gap — it
   * cannot move somebody else's ticket. Called on sign-in, where the owner has
   * just demonstrated the address is theirs.
   *
   * Deliberately does NOT attach bookings: the ticket was written by somebody
   * unproven at the time, and its contents are not evidence of anything.
   */
  async claimAnonymous(input: { userId: string; email: string }) {
    const rows = await this.db
      .update(supportThreads)
      .set({ requesterId: input.userId, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(supportThreads.requesterEmail, input.email),
          isNull(supportThreads.requesterId),
          eq(supportThreads.audience, "guest")
        )
      )
      .returning({ id: supportThreads.id })
    return rows.length
  }

  /** How many tickets this address opened recently — the anonymous guard. */
  async recentByEmail(email: string, since: string) {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(supportThreads)
      .where(
        and(
          eq(supportThreads.requesterEmail, email),
          sql`${supportThreads.createdAt} >= ${since}::timestamptz`
        )
      )
    return Number(row?.count ?? 0)
  }

  /* ----------------------------------------------------- booking messages -- */

  async addBookingMessage(row: typeof bookingMessages.$inferInsert) {
    const [created] = await this.db.insert(bookingMessages).values(row).returning()
    return created!
  }

  async bookingMessages(bookingId: string) {
    return this.db
      .select()
      .from(bookingMessages)
      .where(eq(bookingMessages.bookingId, bookingId))
      .orderBy(asc(bookingMessages.createdAt))
  }

  /**
   * Every guest conversation a property is part of, newest activity first.
   *
   * Written out as SQL rather than assembled from three round trips. The
   * obvious version — list the bookings, then a query per booking for its last
   * message, then another for its unread count — is an N+1 that gets slower
   * exactly as an inbox gets useful.
   *
   * Table names are spelled out because drizzle renders a column reference
   * inside a raw template WITHOUT its table qualifier, so `id = booking_id`
   * comes out ambiguous across a join. Values are still bound as parameters.
   */
  async conversationsForOrg(input: { orgId: string; limit: number; before?: string }) {
    const before = input.before ?? null

    const result = await this.db.execute<{
      booking_id: string
      ref: string
      guest_name: string
      property_id: string
      property_name: string
      check_in: string
      check_out: string
      status: string
      last_body: string
      last_side: string
      last_at: string
      unread: string
    }>(sql`
      WITH org_bookings AS (
        SELECT b.id, b.ref, b.property_id, b.property_name, b.check_in, b.check_out,
               b.status, b.guest_first_name, b.guest_last_name
        FROM bookings b
        JOIN properties p ON p.id = b.property_id
        WHERE p.partner_org_id = ${input.orgId}
      ),
      last_message AS (
        -- DISTINCT ON keeps the newest row per booking in one pass; a
        -- correlated MAX() subquery would read the table twice.
        SELECT DISTINCT ON (m.booking_id)
               m.booking_id, m.body, m.author_side, m.created_at
        FROM booking_messages m
        JOIN org_bookings ob ON ob.id = m.booking_id
        ORDER BY m.booking_id, m.created_at DESC
      ),
      unread AS (
        SELECT m.booking_id, COUNT(*) AS n
        FROM booking_messages m
        JOIN org_bookings ob ON ob.id = m.booking_id
        WHERE m.author_side = 'guest' AND m.read_at IS NULL
        GROUP BY m.booking_id
      )
      SELECT ob.id            AS booking_id,
             ob.ref           AS ref,
             trim(ob.guest_first_name || ' ' || ob.guest_last_name) AS guest_name,
             ob.property_id   AS property_id,
             ob.property_name AS property_name,
             ob.check_in      AS check_in,
             ob.check_out     AS check_out,
             ob.status        AS status,
             lm.body          AS last_body,
             lm.author_side   AS last_side,
             lm.created_at    AS last_at,
             COALESCE(u.n, 0) AS unread
      FROM last_message lm
      JOIN org_bookings ob ON ob.id = lm.booking_id
      LEFT JOIN unread u ON u.booking_id = lm.booking_id
      WHERE ${before}::timestamptz IS NULL OR lm.created_at < ${before}::timestamptz
      ORDER BY lm.created_at DESC
      LIMIT ${input.limit + 1}
    `)

    return result.rows
  }

  /**
   * Marks the OTHER side's messages as read.
   *
   * `read_at IS NULL` in the guard so the first read is the one recorded — a
   * later visit must not overwrite when they actually saw it.
   */
  async markRead(input: { bookingId: string; readerSide: "guest" | "property" }) {
    const otherSide = input.readerSide === "guest" ? "property" : "guest"
    await this.db
      .update(bookingMessages)
      .set({ readAt: new Date().toISOString() })
      .where(
        and(
          eq(bookingMessages.bookingId, input.bookingId),
          eq(bookingMessages.authorSide, otherSide),
          isNull(bookingMessages.readAt)
        )
      )
  }
}
