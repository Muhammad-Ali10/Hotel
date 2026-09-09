import { Inject, Injectable } from "@nestjs/common"
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lte, sql, type SQL } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  notificationOutbox,
  notificationPreferences,
  notificationSettings,
  notifications,
  partnerMembers,
  properties,
  users,
} from "../../db/schema"

export type NotificationRow = typeof notifications.$inferSelect
export type OutboxRow = typeof notificationOutbox.$inferSelect

/** Any Drizzle handle — the pool, or a transaction the caller already owns. */
type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0]

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* -------------------------------------------------------------- enqueue */

  /**
   * Queues a message, or does nothing if this event is already queued.
   *
   * Takes an optional executor so the caller can enqueue INSIDE the
   * transaction that produced the event (rule #57). That is the whole design:
   * the row lands with the booking or not at all, and delivery is a separate
   * problem with its own retries. A send attempted inline would put SendGrid's
   * availability in the path of confirming a reservation.
   */
  /**
   * Who an offer may be sent to, one page at a time.
   *
   * Three conditions, and each is there for its own reason:
   *
   *  - `role = customer` — partners and admins did not sign up for marketing;
   *  - `status = active` — a suspended or closed account is not an audience;
   *  - `email_verified_at IS NOT NULL` — an unverified address is one nobody
   *    has proved they own, and bulk mail to those is how a sending domain
   *    earns a spam reputation.
   *
   * Consent itself is NOT checked here. `notify()` asks `maySend` for every
   * message, and `offer` is the only template classed `marketing`, so the
   * switch a person actually set is honoured in one place rather than two
   * that can disagree.
   */
  async customersForOffer(input: { limit: number; afterId: string | null }) {
    const where: SQL[] = [
      eq(users.role, "customer"),
      eq(users.status, "active"),
      isNotNull(users.emailVerifiedAt),
    ]
    if (input.afterId) where.push(gt(users.id, input.afterId))

    return this.db
      .select({ id: users.id, email: users.email, firstName: users.firstName })
      .from(users)
      .where(and(...where))
      .orderBy(asc(users.id))
      .limit(input.limit)
  }

  async enqueue(
    row: {
      userId: string | null
      template: string
      dedupeKey: string
      channel: string
      toEmail: string
      payload: unknown
    },
    tx?: Executor
  ) {
    const [created] = await (tx ?? this.db)
      .insert(notificationOutbox)
      .values({
        ...row,
        /*
         * The APPLICATION's clock, not the database's.
         *
         * `next_attempt_at` defaults to `now()` in Postgres while the worker
         * compares it against a `Date` from Node. Those are two clocks, and a
         * few milliseconds of skew is enough for a message to read as "not due
         * yet" the instant after it was queued — intermittently, and more
         * often under load. Writing it from the same clock that reads it
         * removes the comparison entirely.
         */
        nextAttemptAt: new Date().toISOString(),
      })
      // A booking is confirmed once, however many times a webhook is
      // redelivered. The index decides, not a prior read.
      .onConflictDoNothing({
        target: [notificationOutbox.template, notificationOutbox.dedupeKey],
      })
      .returning()
    return created ?? null
  }

  /** Writes the dashboard entry. Same transaction, same reasoning. */
  async createInApp(
    row: {
      userId: string
      template: string
      kind: string
      audience: string
      title: string
      message: string
      href?: string | null
    },
    tx?: Executor
  ) {
    const [created] = await (tx ?? this.db).insert(notifications).values(row).returning()
    return created!
  }

  /* --------------------------------------------------------------- worker */

  /**
   * Messages due to be sent.
   *
   * `FOR UPDATE SKIP LOCKED` so two workers never pick the same row: the
   * second one steps over what the first has claimed instead of waiting for
   * it. Without it, either the message goes twice or the workers serialise
   * into one.
   */
  /**
   * Claims messages due to be sent, by WRITING to them.
   *
   * `SELECT ... FOR UPDATE SKIP LOCKED` on its own does not work here, and the
   * reason is easy to miss: a bare statement runs in an implicit transaction
   * that commits the instant it finishes, releasing every lock it took. Two
   * workers a millisecond apart both read the same rows and the guest gets the
   * same email twice. (Proven, not assumed — the test for it failed first.)
   *
   * So the claim is an UPDATE, whose own transaction holds the locks while the
   * inner SELECT is skipping past whatever another worker already took.
   *
   * The claim pushes `next_attempt_at` out by a LEASE rather than moving the
   * row to a `sending` state. A lease needs no extra status and no reaper: a
   * worker that dies mid-send simply stops renewing, and the row becomes due
   * again on its own.
   *
   * `attempts` is incremented HERE, at claim time, so a worker that crashes
   * mid-send still burns an attempt — otherwise a message that crashes the
   * worker every time is retried forever.
   */
  async claimDue(input: { now: string; limit: number; leaseSeconds: number }) {
    const leaseUntil = new Date(
      new Date(input.now).getTime() + input.leaseSeconds * 1000
    ).toISOString()

    return this.db
      .update(notificationOutbox)
      .set({
        nextAttemptAt: leaseUntil,
        attempts: sql`${notificationOutbox.attempts} + 1`,
        updatedAt: input.now,
      })
      .where(
        inArray(
          notificationOutbox.id,
          sql`(
            SELECT id FROM ${notificationOutbox}
            WHERE status = 'pending' AND next_attempt_at <= ${input.now}::timestamptz
            ORDER BY next_attempt_at ASC
            LIMIT ${input.limit}
            FOR UPDATE SKIP LOCKED
          )`
        )
      )
      .returning()
  }

  async markSent(input: { id: string; providerRef: string; now: string }) {
    const [row] = await this.db
      .update(notificationOutbox)
      .set({
        status: "sent",
        sentAt: input.now,
        providerRef: input.providerRef,
        updatedAt: input.now,
      })
      .where(and(eq(notificationOutbox.id, input.id), eq(notificationOutbox.status, "pending")))
      .returning()
    return row ?? null
  }

  /**
   * Records a failure, and either schedules another go or gives up.
   *
   * `attempts` is NOT touched here — `claimDue` already counted this try, so
   * that a worker which dies mid-send still burns one.
   */
  async markAttemptFailed(input: {
    id: string
    error: string
    nextAttemptAt: string | null
    now: string
  }) {
    const [row] = await this.db
      .update(notificationOutbox)
      .set({
        // `null` means no further attempt — the message is done with.
        status: input.nextAttemptAt === null ? "failed" : "pending",
        lastError: input.error.slice(0, 1000),
        ...(input.nextAttemptAt ? { nextAttemptAt: input.nextAttemptAt } : {}),
        updatedAt: input.now,
      })
      .where(eq(notificationOutbox.id, input.id))
      .returning()
    return row ?? null
  }

  /** A message the recipient's settings refuse. Recorded, never sent. */
  async markSuppressed(id: string) {
    await this.db
      .update(notificationOutbox)
      .set({ status: "suppressed", updatedAt: new Date().toISOString() })
      .where(eq(notificationOutbox.id, id))
  }

  /* ----------------------------------------------------------------- read */

  async listFor(input: { userId: string; limit: number; unreadOnly: boolean }) {
    const where = [eq(notifications.userId, input.userId)]
    if (input.unreadOnly) where.push(isNull(notifications.readAt))

    return this.db
      .select()
      .from(notifications)
      .where(and(...where))
      .orderBy(desc(notifications.createdAt))
      .limit(input.limit)
  }

  async unreadCountFor(userId: string) {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    return Number(row?.count ?? 0)
  }

  /** Marks one as read, scoped to its owner (API1). */
  async markRead(input: { id: string; userId: string; now: string }) {
    const [row] = await this.db
      .update(notifications)
      .set({ readAt: input.now, updatedAt: input.now })
      .where(
        and(
          eq(notifications.id, input.id),
          eq(notifications.userId, input.userId),
          isNull(notifications.readAt)
        )
      )
      .returning()
    return row ?? null
  }

  async markAllRead(userId: string, now: string) {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: now, updatedAt: now })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id })
    return rows.length
  }

  /* ----------------------------------------------------------- recipients */

  /**
   * Who at a property should hear about something.
   *
   * The org's ADMIN, because that is the account that can act on it — a
   * message to whoever happens to be on the front desk today is a message
   * nobody owns.
   *
   * This lives in the notifications module rather than in catalog or finance
   * because "who gets told" is one question with one answer, and three modules
   * each writing their own join is three places for it to drift.
   */
  async recipientForProperty(propertyId: string) {
    const [row] = await this.db
      .select({ userId: users.id, email: users.email, orgId: properties.partnerOrgId })
      .from(properties)
      .innerJoin(partnerMembers, eq(partnerMembers.orgId, properties.partnerOrgId))
      .innerJoin(users, eq(users.id, partnerMembers.userId))
      .where(
        and(
          eq(properties.id, propertyId),
          eq(partnerMembers.role, "admin"),
          eq(partnerMembers.status, "active")
        )
      )
      .limit(1)
    return row ?? null
  }

  /** The same, addressed by the org — for a payout, which has no property. */
  async recipientForOrg(orgId: string) {
    const [row] = await this.db
      .select({ userId: users.id, email: users.email })
      .from(partnerMembers)
      .innerJoin(users, eq(users.id, partnerMembers.userId))
      .where(
        and(
          eq(partnerMembers.orgId, orgId),
          eq(partnerMembers.role, "admin"),
          eq(partnerMembers.status, "active")
        )
      )
      .limit(1)
    return row ?? null
  }

  /* ------------------------------------------------------------- settings */

  async settingsFor(userId: string) {
    const [row] = await this.db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId))
      .limit(1)
    return row ?? null
  }

  /* ------------------------------------------ per-message switches (#105) */

  async overridesFor(userId: string) {
    return this.db
      .select({
        template: notificationPreferences.template,
        channel: notificationPreferences.channel,
        enabled: notificationPreferences.enabled,
      })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
  }

  /**
   * Writes a set of switches in one statement.
   *
   * Upsert on the triple, so flipping the same switch twice cannot produce two
   * rows and a retry after a dropped response lands on the same state.
   */
  async saveOverrides(input: {
    userId: string
    rows: readonly { template: string; channel: string; enabled: boolean }[]
  }) {
    if (input.rows.length === 0) return

    await this.db
      .insert(notificationPreferences)
      .values(input.rows.map((row) => ({ userId: input.userId, ...row })))
      .onConflictDoUpdate({
        target: [
          notificationPreferences.userId,
          notificationPreferences.template,
          notificationPreferences.channel,
        ],
        set: {
          enabled: sql`excluded.enabled`,
          updatedAt: new Date().toISOString(),
        },
      })
  }

  async saveSettings(input: {
    userId: string
    patch: Partial<typeof notificationSettings.$inferInsert>
  }) {
    const [row] = await this.db
      .insert(notificationSettings)
      .values({ userId: input.userId, ...input.patch })
      .onConflictDoUpdate({
        target: notificationSettings.userId,
        set: { ...input.patch, updatedAt: new Date().toISOString() },
      })
      .returning()
    return row!
  }

  /**
   * Whether the outbox is actually draining.
   *
   * Every failure mode of email delivery is SILENT. A key that was never set,
   * a sending domain nobody verified, a provider refusing every message: the
   * API stays up, the endpoints stay green, and each notification is marked
   * failed one at a time. Nobody finds out until a partner asks why they were
   * never told their property was approved.
   *
   * One query, four numbers, so a screen can say "this is fine" or "this has
   * not moved in an hour".
   */
  async deliveryHealth(input: { now: string; stuckAfterMinutes: number }) {
    /*
     * `db.execute` answers with the driver's `QueryResult` — an object with a
     * `rows` array, not an array. Destructuring it directly throws, and it
     * throws at runtime rather than at compile time because the generic makes
     * it look like a list.
     */
    const result = (await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,

        /*
         * Due to be sent, and still here. next_attempt_at rather than
         * created_at: a message backing off after two failures is not stuck,
         * it is waiting, and counting it would make the number cry wolf.
         */
        COUNT(*) FILTER (
          WHERE status = 'pending'
            AND next_attempt_at < ${input.now}::timestamptz
                                  - make_interval(mins => ${input.stuckAfterMinutes})
        )::int AS stuck,

        COUNT(*) FILTER (
          WHERE status = 'failed'
            AND updated_at > ${input.now}::timestamptz - interval '1 hour'
        )::int AS failed_last_hour,

        COUNT(*) FILTER (
          WHERE status = 'sent'
            AND updated_at > ${input.now}::timestamptz - interval '1 hour'
        )::int AS sent_last_hour,

        /* How long the oldest waiting message has been waiting, in minutes. */
        COALESCE(
          EXTRACT(EPOCH FROM (
            ${input.now}::timestamptz - MIN(created_at) FILTER (WHERE status = 'pending')
          )) / 60,
          0
        )::int AS oldest_pending_minutes
      FROM notification_outbox
    `)) as unknown as
      | { rows?: Record<string, number>[] }
      | Record<string, number>[]

    const rows = Array.isArray(result) ? result : (result.rows ?? [])
    const counts = rows[0]
    return {
      pending: Number(counts?.pending ?? 0),
      stuck: Number(counts?.stuck ?? 0),
      failedLastHour: Number(counts?.failed_last_hour ?? 0),
      sentLastHour: Number(counts?.sent_last_hour ?? 0),
      oldestPendingMinutes: Number(counts?.oldest_pending_minutes ?? 0),
    }
  }

  /** Old delivered messages. The outbox is a queue, not an archive. */
  async purgeSent(before: string) {
    const rows = await this.db
      .delete(notificationOutbox)
      .where(
        and(eq(notificationOutbox.status, "sent"), lte(notificationOutbox.sentAt, before))
      )
      .returning({ id: notificationOutbox.id })
    return rows.length
  }
}
