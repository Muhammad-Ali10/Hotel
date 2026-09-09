import { Inject, Injectable } from "@nestjs/common"
import { and, desc, eq, gt, isNull, lt, ne, sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  emailVerifications,
  partnerMembers,
  partnerOrgs,
  passwordResets,
  sessions,
  userCredentials,
  users,
} from "../../db/schema"

/**
 * All database access for auth. No business rules live here — the service owns
 * those, this owns SQL.
 */
@Injectable()
export class AuthRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* ----------------------------------------------------------------- users */

  async findByEmail(email: string) {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1)
    return row ?? null
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1)
    return row ?? null
  }

  /** Only ever called from the login path. Kept off every other query. */
  async findCredentials(userId: string) {
    const [row] = await this.db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId))
      .limit(1)
    return row ?? null
  }

  /**
   * Creates the account and its credentials together.
   *
   * In one transaction because a user row without a password is an account
   * nobody can ever sign into, and it would still occupy the email address.
   */
  async createUser(input: {
    email: string
    passwordHash: string
    firstName: string
    lastName: string
  }) {
    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          // Role is NEVER taken from the request (API3). A partner account is
          // created by the join wizard, an admin by an operator.
          role: "customer",
        })
        .returning()

      if (!user) throw new Error("Failed to create user")

      await tx
        .insert(userCredentials)
        .values({ userId: user.id, passwordHash: input.passwordHash })

      return user
    })
  }

  async touchLogin(userId: string, at: Date) {
    await this.db
      .update(users)
      .set({ lastLoginAt: at.toISOString(), updatedAt: at.toISOString() })
      .where(eq(users.id, userId))
  }

  /* -------------------------------------------------------------- sessions */

  async createSession(input: {
    userId: string
    tokenHash: string
    expiresAt: Date
    absoluteExpiresAt: Date
    userAgent: string
    ip: string
  }) {
    const [row] = await this.db
      .insert(sessions)
      .values({
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt.toISOString(),
        absoluteExpiresAt: input.absoluteExpiresAt.toISOString(),
        userAgent: input.userAgent.slice(0, 256),
        ip: input.ip.slice(0, 64),
      })
      .returning()
    return row ?? null
  }

  /**
   * A live session and its user, in one query.
   *
   * Both expiries are checked in SQL rather than in JavaScript: an expired row
   * must not be returned at all, so there is no window in which a caller
   * forgets to check and treats it as valid.
   */
  async findLiveSession(tokenHash: string, now: Date) {
    const nowIso = now.toISOString()
    const [row] = await this.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, nowIso),
          gt(sessions.absoluteExpiresAt, nowIso)
        )
      )
      .limit(1)
    return row ?? null
  }

  /** Slides the idle window, never past the absolute ceiling. */
  async refreshSession(sessionId: string, expiresAt: Date, now: Date) {
    await this.db
      .update(sessions)
      .set({
        expiresAt: sql`LEAST(${expiresAt.toISOString()}::timestamptz, ${sessions.absoluteExpiresAt})`,
        lastUsedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .where(eq(sessions.id, sessionId))
  }

  async deleteSession(tokenHash: string) {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
  }

  /** "Sign out everywhere" — and what a suspension or password change runs. */
  /**
   * Raises an account's tier, and only ever raises it (rule #53).
   *
   * Guarded on the tier it is moving FROM, so two stays completing at the same
   * moment cannot both claim the upgrade — and so a downgrade cannot slip
   * through by passing a lower tier.
   */
  async raiseTier(input: { userId: string; fromTier: string; toTier: string }) {
    const [row] = await this.db
      .update(users)
      .set({ tier: input.toTier, updatedAt: new Date().toISOString() })
      .where(and(eq(users.id, input.userId), eq(users.tier, input.fromTier)))
      .returning()
    return row ?? null
  }

  async findTier(userId: string) {
    const [row] = await this.db
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return row?.tier ?? null
  }

  /* --------------------------------------------------------------- profile */

  async findProfile(userId: string) {
    const [row] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1)
    return row ?? null
  }

  async updateProfile(userId: string, patch: Partial<typeof users.$inferInsert>) {
    const [row] = await this.db
      .update(users)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId))
      .returning()
    return row ?? null
  }

  /* -------------------------------------------------------------- password */

  async setPassword(input: { userId: string; passwordHash: string }) {
    const now = new Date().toISOString()
    const [row] = await this.db
      .update(userCredentials)
      .set({ passwordHash: input.passwordHash, passwordChangedAt: now, updatedAt: now })
      .where(eq(userCredentials.userId, input.userId))
      .returning()
    return row ?? null
  }

  async createPasswordReset(input: {
    userId: string
    tokenHash: string
    expiresAt: string
    requestedIp: string
  }) {
    const [row] = await this.db.insert(passwordResets).values(input).returning()
    return row!
  }

  /**
   * Spends a reset token, once.
   *
   * The guard is the UPDATE: `used_at IS NULL` and an unexpired row, both in
   * the WHERE. Reading the row and then marking it used leaves the window two
   * requests need to redeem the same link — and the second one would be
   * setting a password on somebody else's behalf.
   */
  async consumePasswordReset(input: { tokenHash: string; now: string }) {
    const [row] = await this.db
      .update(passwordResets)
      .set({ usedAt: input.now, updatedAt: input.now })
      .where(
        and(
          eq(passwordResets.tokenHash, input.tokenHash),
          isNull(passwordResets.usedAt),
          gt(passwordResets.expiresAt, input.now)
        )
      )
      .returning()
    return row ?? null
  }

  /** Retires every other outstanding link for an account. */
  async invalidateResetsFor(userId: string, exceptId?: string) {
    const where = [eq(passwordResets.userId, userId), isNull(passwordResets.usedAt)]
    if (exceptId) where.push(ne(passwordResets.id, exceptId))

    await this.db
      .update(passwordResets)
      .set({ usedAt: new Date().toISOString() })
      .where(and(...where))
  }

  /* ---------------------------------------------------------- verification */

  async createEmailVerification(input: {
    userId: string
    tokenHash: string
    expiresAt: string
  }) {
    const [row] = await this.db.insert(emailVerifications).values(input).returning()
    return row!
  }

  /** Spends a verification token, once — the guard is in the UPDATE. */
  async consumeEmailVerification(input: { tokenHash: string; now: string }) {
    const [row] = await this.db
      .update(emailVerifications)
      .set({ usedAt: input.now, updatedAt: input.now })
      .where(
        and(
          eq(emailVerifications.tokenHash, input.tokenHash),
          isNull(emailVerifications.usedAt),
          gt(emailVerifications.expiresAt, input.now)
        )
      )
      .returning()
    return row ?? null
  }

  async markEmailVerified(userId: string, now: string) {
    const [row] = await this.db
      .update(users)
      .set({ emailVerifiedAt: now, updatedAt: now })
      .where(and(eq(users.id, userId), isNull(users.emailVerifiedAt)))
      .returning()
    return row ?? null
  }

  /* -------------------------------------------------------------- sessions */

  async listSessionsFor(userId: string, now: string) {
    return this.db
      .select({
        id: sessions.id,
        userAgent: sessions.userAgent,
        ip: sessions.ip,
        lastUsedAt: sessions.lastUsedAt,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
      .orderBy(desc(sessions.lastUsedAt))
  }

  /**
   * Ends one session, scoped to its owner.
   *
   * The ownership filter is in the DELETE (API1): a session id is opaque, but
   * "delete by id" without it is a way to sign somebody else out.
   */
  async deleteSessionById(input: { sessionId: string; userId: string }) {
    const [row] = await this.db
      .delete(sessions)
      .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, input.userId)))
      .returning()
    return row ?? null
  }

  /** Ends every session but the one asking. */
  async deleteOtherSessionsFor(input: { userId: string; keepSessionId: string }) {
    const rows = await this.db
      .delete(sessions)
      .where(and(eq(sessions.userId, input.userId), ne(sessions.id, input.keepSessionId)))
      .returning({ id: sessions.id })
    return rows.length
  }

  async deleteAllSessionsFor(userId: string) {
    await this.db.delete(sessions).where(eq(sessions.userId, userId))
  }

  /** Housekeeping sweep. Expired rows are dead weight on the index. */
  async deleteExpiredSessions(now: Date) {
    await this.db.delete(sessions).where(lt(sessions.expiresAt, now.toISOString()))
  }

  /* --------------------------------------------------------------- partner */

  /**
   * The org membership behind a partner account.
   *
   * Only `active` memberships count: an `invited` member has not accepted yet
   * and a `suspended` one must not keep their access simply because their
   * session is still valid.
   */
  async findPartnerMembership(userId: string) {
    const [row] = await this.db
      .select({ member: partnerMembers, org: partnerOrgs })
      .from(partnerMembers)
      .innerJoin(partnerOrgs, eq(partnerOrgs.id, partnerMembers.orgId))
      .where(and(eq(partnerMembers.userId, userId), eq(partnerMembers.status, "active")))
      .limit(1)
    return row ?? null
  }
}
