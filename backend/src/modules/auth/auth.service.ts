import { randomBytes } from "node:crypto"

import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import {
  INVALID_CREDENTIALS_MESSAGE,
  tierUpgradeFor,
  type LoginInput,
  type ProfileUpdateInput,
  type ProfileView,
  type SessionUser,
  type SignupInput,
} from "@stayora/shared"

import { NotificationsService } from "../notifications/notifications.service"
import { SupportService } from "../support/support.service"
import { AuthRepository } from "./auth.repository"
import { PasswordService } from "./password.service"
import { SessionService, hashToken } from "./session.service"

/**
 * The caller, as the guards see them.
 *
 * `sessionId` is an INTERNAL handle and must never be serialised — so it lives
 * only on this type, and every method that builds an API response returns the
 * narrower `SessionUser` instead. Signup and login originally reused this one
 * and shipped `sessionId: ""` in their bodies; making the wide type
 * unreachable from those paths is what stops that recurring.
 */
export type AuthenticatedUser = SessionUser & { sessionId: string }

type RequestMeta = { userAgent: string; ip: string }

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly repo: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly notifications: NotificationsService,
    // Only for `claimAnonymous` on sign-in (rule #86). `forwardRef` because
    // support reaches bookings, and bookings will one day reach back here.
    @Inject(forwardRef(() => SupportService))
    private readonly support: SupportService
  ) {}

  /**
   * Signing up, without saying whether the address is already taken (#58).
   *
   * The answer is IDENTICAL either way, and the truth goes to the address
   * itself: a new account gets a welcome and a verification link, an existing
   * one gets "you already have an account". Only the person holding the
   * mailbox learns anything.
   *
   * ⚠️ THE TRADE, made deliberately: this cannot also sign the caller straight
   * in. A session cookie coming back for a new account and not for an existing
   * one IS the leak, restated — so signup returns no session at all. The cost
   * is one extra step, and it is smaller than it looks: whoever just signed up
   * knows the password they chose and can log in immediately. The verification
   * link proves the address; it is not the way in.
   */
  async signup(input: SignupInput, meta: RequestMeta) {
    const existing = await this.repo.findByEmail(input.email)

    if (existing) {
      /*
       * Nothing is created and nothing is said. The message goes to the
       * mailbox, which is the one place the truth is safe to put.
       */
      await this.notifications.notify({
        template: "signup_existing_account",
        subjectId: `${existing.id}:${Date.now()}`,
        userId: existing.id,
        toEmail: existing.email,
        payload: {},
      })
      return { pending: true as const }
    }

    const passwordHash = await this.passwords.hash(input.password)
    const user = await this.repo.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    })

    await this.notifications.notify({
      template: "welcome",
      subjectId: user.id,
      userId: user.id,
      toEmail: user.email,
      payload: { firstName: user.firstName },
    })
    await this.sendVerificationEmail(user)

    void meta
    return { pending: true as const }
  }

  /**
   * Issues a verification link.
   *
   * Separate so "resend" is the same code path as "sign up" — a second link
   * retires the first, exactly like a password reset.
   */
  private async sendVerificationEmail(user: { id: string; email: string }) {
    const token = randomBytes(32).toString("base64url")
    await this.repo.createEmailVerification({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + VERIFY_TTL_HOURS * 3_600_000).toISOString(),
    })

    await this.notifications.notify({
      template: "verify_email",
      subjectId: `${user.id}:${Date.now()}`,
      userId: user.id,
      toEmail: user.email,
      payload: { token },
    })
    return token
  }

  /**
   * Proving an address.
   *
   * Idempotent on the account: a second click finds `email_verified_at`
   * already set and changes nothing, rather than erroring at somebody who
   * pressed the link twice.
   */
  async verifyEmail(token: string, now = new Date()) {
    const claim = await this.repo.consumeEmailVerification({
      tokenHash: hashToken(token),
      now: now.toISOString(),
    })
    // Expired, already spent, or never real — one answer for all three.
    if (!claim) throw new BadRequestException("That verification link is no longer valid")

    await this.repo.markEmailVerified(claim.userId, now.toISOString())
    return { verified: true as const }
  }

  /** A fresh link, for somebody who lost the first. */
  async resendVerification(user: AuthenticatedUser) {
    const row = await this.repo.findProfile(user.id)
    if (!row) throw new NotFoundException("Account not found")
    if (row.emailVerifiedAt) return { pending: true as const }

    await this.sendVerificationEmail(row)
    return { pending: true as const }
  }

  /**
   * Login.
   *
   * Every failure returns the SAME message and spends the SAME time, whether
   * the address exists or not (API2). A wrong password and an unknown account
   * must be indistinguishable from the outside.
   */
  async login(input: LoginInput, meta: RequestMeta) {
    const user = await this.repo.findByEmail(input.email)

    if (!user) {
      // Burn the same CPU an argon2 verification would, so the response time
      // does not answer the question the message refuses to.
      await this.passwords.verifyDummy(input.password)
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE)
    }

    const credentials = await this.repo.findCredentials(user.id)
    if (!credentials) {
      await this.passwords.verifyDummy(input.password)
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE)
    }

    const valid = await this.passwords.verify(credentials.passwordHash, input.password)
    if (!valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE)
    }

    // Checked AFTER the password, deliberately: telling an unauthenticated
    // caller that an account is suspended is still telling them it exists.
    if (user.status !== "active") {
      throw new ForbiddenException("This account is not active. Contact support.")
    }

    /*
     * Tickets opened without an account, now that the address is proven
     * (rule #86).
     *
     * This is the moment the owner demonstrates the address is theirs, and the
     * only moment it may happen — support saying "that ticket belongs to you"
     * is exactly the request social engineering is built out of.
     *
     * Failure is swallowed: a sign-in must never fail because a linking query
     * did. The next sign-in tries again, and the guard is `requester_id IS
     * NULL`, so it can only ever fill a gap.
     */
    void this.support.claimAnonymous({ id: user.id, email: user.email }).catch((error: unknown) => {
      this.logger.warn(`Could not link anonymous tickets: ${(error as Error).message}`)
    })

    return this.startSession(user.id, input.remember, meta)
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return
    await this.repo.deleteSession(hashToken(token))
  }

  /**
   * Resolves a session cookie to the caller.
   *
   * Returns `null` rather than throwing: the guard decides what an anonymous
   * request means for the route it is protecting.
   */
  async resolveSession(token: string | undefined, now = new Date()): Promise<AuthenticatedUser | null> {
    if (!token) return null

    const found = await this.repo.findLiveSession(hashToken(token), now)
    if (!found) return null

    // A session that outlived a suspension must not keep working.
    if (found.user.status !== "active") {
      await this.repo.deleteAllSessionsFor(found.user.id)
      return null
    }

    // Slide the idle window. Capped at the absolute expiry in SQL, so an
    // actively used session still expires eventually.
    await this.repo.refreshSession(found.session.id, this.sessions.nextIdleExpiry(false, now), now)

    return { ...(await this.toSessionUser(found.user)), sessionId: found.session.id }
  }

  /**
   * Applies a loyalty upgrade the booking flow has earned (rules #3, #53).
   *
   * Lives here because `users` is this module's table — bookings counts the
   * stays, auth decides what an account is. Silent on failure by design: a
   * completed stay must not be rolled back because a tier update lost a race,
   * and the next completed stay will re-derive the same answer.
   */
  async applyEarnedTier(input: { userId: string; completedStays: number }) {
    const current = await this.repo.findTier(input.userId)
    if (!current) return null

    const next = tierUpgradeFor({
      current: current as SessionUser["tier"],
      completedStays: input.completedStays,
    })
    if (!next) return null

    const raised = await this.repo.raiseTier({
      userId: input.userId,
      fromTier: current,
      toTier: next,
    })
    if (raised) this.logger.log(`Account ${input.userId} reached ${next}`)
    return raised ? next : null
  }

  /* --------------------------------------------------------------- profile */

  async profileFor(userId: string): Promise<ProfileView | null> {
    const row = await this.repo.findProfile(userId)
    return row ? toProfile(row) : null
  }

  /**
   * Changing one's own details (API3).
   *
   * The contract already refuses `role`, `tier`, `points` and the rest, so
   * nothing is stripped here — a body carrying one never gets this far. That
   * is the point of putting the guard in a `.strict()` schema rather than in a
   * list of fields to delete, which is a list somebody eventually forgets to
   * extend.
   */
  async updateProfile(input: { userId: string; patch: ProfileUpdateInput }) {
    const row = await this.repo.updateProfile(input.userId, input.patch)
    if (!row) throw new NotFoundException("Account not found")
    return toProfile(row)
  }

  /* -------------------------------------------------------------- password */

  /**
   * Changing a password the holder still knows.
   *
   * The current password is required even though the caller holds a live
   * session: an unlocked laptop IS a live session, and the entire value of
   * changing a password is that it locks out everyone who had the old one.
   */
  async changePassword(input: {
    user: AuthenticatedUser
    currentPassword: string
    newPassword: string
  }) {
    const credentials = await this.repo.findCredentials(input.user.id)
    if (!credentials) throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE)

    const ok = await this.passwords.verify(credentials.passwordHash, input.currentPassword)
    if (!ok) throw new UnauthorizedException("That is not your current password")

    await this.repo.setPassword({
      userId: input.user.id,
      passwordHash: await this.passwords.hash(input.newPassword),
    })

    /*
     * Every OTHER device is signed out (API2), and this one is not.
     *
     * Signing the caller out too would be defensible, but it means the reward
     * for good security hygiene is being kicked back to a login screen — which
     * is how people learn not to bother. The devices that matter are the ones
     * holding the OLD password, and those are exactly the ones ended here.
     */
    const endedElsewhere = await this.repo.deleteOtherSessionsFor({
      userId: input.user.id,
      keepSessionId: input.user.sessionId,
    })

    // A password change makes every outstanding reset link moot.
    await this.repo.invalidateResetsFor(input.user.id)

    /*
     * Sent AFTER the fact, and worth sending even though it can stop nothing.
     *
     * If the change was not theirs, this is the only way they find out at all.
     */
    await this.notifications.notify({
      template: "password_changed",
      subjectId: `${input.user.id}:${Date.now()}`,
      userId: input.user.id,
      toEmail: input.user.email,
      payload: {},
      inApp: {
        title: "Your password was changed",
        message: "Every other device was signed out.",
        href: "/dashboard/settings",
      },
    })

    return { endedElsewhere }
  }

  /**
   * Asking for a reset link (rule #54).
   *
   * Always answers the same, whether or not the address is registered — the
   * same reasoning as the login failure message. A different reply for an
   * unknown address turns this into a way of asking "does this person have an
   * account here".
   *
   * The link is posted by the notifications outbox, which queues it here and
   * sends it from a worker (rule #57) — so a provider outage cannot fail a
   * reset request, it only delays the email.
   */
  async requestPasswordReset(input: { email: string; ip: string; now?: Date }) {
    const now = input.now ?? new Date()
    const user = await this.repo.findByEmail(input.email)

    // Nothing is created for an unknown address, and nothing is said about it.
    if (!user || user.status !== "active") return { sent: true as const, token: null }

    // One live link at a time: a second request retires the first, so an old
    // email sitting in a mailbox stops working the moment a new one is asked for.
    await this.repo.invalidateResetsFor(user.id)

    const token = randomBytes(32).toString("base64url")
    await this.repo.createPasswordReset({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + RESET_TTL_MINUTES * 60_000).toISOString(),
      requestedIp: input.ip,
    })

    await this.notifications.notify({
      template: "password_reset",
      // Time-stamped: a second request is a second link, and must not be
      // silenced by the first one's dedupe key.
      subjectId: `${user.id}:${Date.now()}`,
      userId: user.id,
      toEmail: user.email,
      payload: { token },
    })

    /*
     * Still returned, so a test can follow the flow without reading a mailbox.
     * It is NEVER part of an HTTP response — see the controller.
     */
    return { sent: true as const, token }
  }

  /**
   * Spending a reset link.
   *
   * Every session is ended, this time including whoever is asking. A reset is
   * what somebody does when they think their account is compromised, and the
   * point is that nothing which was signed in a moment ago still is.
   */
  async resetPassword(input: { token: string; newPassword: string; now?: Date }) {
    const now = (input.now ?? new Date()).toISOString()

    const claim = await this.repo.consumePasswordReset({
      tokenHash: hashToken(input.token),
      now,
    })
    // Expired, already spent, or never real — one answer for all three.
    if (!claim) throw new BadRequestException("That reset link is no longer valid")

    await this.repo.setPassword({
      userId: claim.userId,
      passwordHash: await this.passwords.hash(input.newPassword),
    })
    await this.repo.invalidateResetsFor(claim.userId, claim.id)
    await this.repo.deleteAllSessionsFor(claim.userId)

    return { ok: true as const }
  }

  /* -------------------------------------------------------------- sessions */

  /** The devices signed in to this account. */
  async listSessions(user: AuthenticatedUser, now = new Date()) {
    const rows = await this.repo.listSessionsFor(user.id, now.toISOString())
    return rows.map((row) => ({ ...row, current: row.id === user.sessionId }))
  }

  /** Signing one device out. 404 rather than 403 for somebody else's (API1). */
  async revokeSession(input: { sessionId: string; user: AuthenticatedUser }) {
    const row = await this.repo.deleteSessionById({
      sessionId: input.sessionId,
      userId: input.user.id,
    })
    if (!row) throw new NotFoundException("Session not found")
    return { revoked: 1, wasCurrent: input.sessionId === input.user.sessionId }
  }

  /** "Sign out everywhere else" — what API2 asked for and nothing provided. */
  async revokeOtherSessions(user: AuthenticatedUser) {
    const revoked = await this.repo.deleteOtherSessionsFor({
      userId: user.id,
      keepSessionId: user.sessionId,
    })
    return { revoked }
  }

  private async startSession(userId: string, remember: boolean, meta: RequestMeta) {
    const issued = this.sessions.issue(remember)

    await this.repo.createSession({
      userId,
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
      absoluteExpiresAt: issued.absoluteExpiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    })

    const now = new Date()
    await this.repo.touchLogin(userId, now)

    const user = await this.repo.findById(userId)
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE)

    return {
      token: issued.token,
      expiresAt: issued.expiresAt,
      user: await this.toSessionUser(user),
    }
  }

  /**
   * Builds the public shape of a user.
   *
   * Fields are listed explicitly rather than spread, so a column added to the
   * table later cannot appear in an API response by accident (API3, output).
   */
  private async toSessionUser(
    user: NonNullable<Awaited<ReturnType<AuthRepository["findById"]>>>
  ): Promise<SessionUser> {
    const membership =
      user.role === "partner" ? await this.repo.findPartnerMembership(user.id) : null

    return {
      id: user.id,
      email: user.email,
      role: user.role as SessionUser["role"],
      /*
       * `null` unless this really is an administrator.
       *
       * Read from the row rather than inferred: the whole point of the column
       * is that "is an admin" and "which kind of admin" are different
       * questions, and answering the second from the first is what made the
       * permission matrix decorative.
       */
      platformRole:
        user.role === "admin"
          ? ((user.platformRole ?? "support") as NonNullable<SessionUser["platformRole"]>)
          : null,
      firstName: user.firstName,
      lastName: user.lastName,
      tier: user.tier as SessionUser["tier"],
      emailVerified: user.emailVerifiedAt !== null,
      partner: membership
        ? {
            orgId: membership.org.id,
            orgName: membership.org.name,
            role: membership.member.role as NonNullable<SessionUser["partner"]>["role"],
            propertyIds: membership.member.propertyIds,
          }
        : null,
    }
  }
}

/**
 * How long a reset link lives.
 *
 * An hour: long enough to walk to a computer, short enough that a link
 * forwarded or left in a mailbox has stopped working before anyone finds it.
 */
const RESET_TTL_MINUTES = 60

/** A verification link may sit in a mailbox for a couple of days. */
const VERIFY_TTL_HOURS = 48

/**
 * The profile, field by field (API3, the response side).
 *
 * `passwordHash` is not on this table, but `status` and `role` are, and
 * neither belongs on a profile screen. Listing what goes out means a column
 * added next month cannot arrive here by simply existing.
 */
function toProfile(row: {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string
  country: string
  city: string
  avatarSeed: string
  tier: string
  membership: string
  points: number
  preferences: string[]
  emailVerifiedAt: string | null
  joinedAt: string
}): ProfileView {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    country: row.country,
    city: row.city,
    avatarSeed: row.avatarSeed,
    tier: row.tier as ProfileView["tier"],
    membership: row.membership,
    points: row.points,
    preferences: row.preferences,
    emailVerified: row.emailVerifiedAt !== null,
    joined: row.joinedAt,
  }
}
