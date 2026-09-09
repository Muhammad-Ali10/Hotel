import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { enumColumn, primaryId, timestamps } from "./_shared"

/* ============================================================================
 * Module 1 — identity, sessions and partner membership.
 * ========================================================================== */

export const USER_ROLES = ["customer", "partner", "admin"] as const
export const USER_TIERS = ["standard", "genius"] as const
export const USER_STATUSES = ["active", "suspended", "blocked"] as const

export const users = pgTable(
  "users",
  {
    id: primaryId(),

    /**
     * Stored lower-cased and trimmed by the contract, so `John@X.com` and
     * `john@x.com` cannot become two accounts. The unique index is what
     * actually enforces it.
     */
    email: varchar("email", { length: 254 }).notNull(),

    role: enumColumn("role").notNull().default("customer"),

    /**
     * The GRADE of an administrator, meaningful only when `role = 'admin'`.
     *
     * `role` answers which product surface an account belongs to — customer,
     * partner, platform. It cannot also answer what an administrator may do,
     * and the attempt showed: the admin panel shipped with four grades and a
     * whole permission matrix that existed only in the browser. Every real
     * administrator was a super admin, so a finance account could suspend a
     * property by typing the URL.
     *
     * NULL for everybody who is not an administrator — the column has no
     * meaning for them, and a default of `super_admin` on every customer row
     * would be one migration away from a catastrophe.
     */
    platformRole: enumColumn("platform_role"),

    status: enumColumn("status").notNull().default("active"),

    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),

    phone: varchar("phone", { length: 32 }).notNull().default(""),
    country: varchar("country", { length: 80 }).notNull().default(""),
    city: varchar("city", { length: 80 }).notNull().default(""),
    avatarSeed: varchar("avatar_seed", { length: 64 }).notNull().default(""),

    /** The only field that affects pricing — `genius` promotions match on it. */
    tier: enumColumn("tier").notNull().default("standard"),

    /**
     * Display label ("Gold Member") and a points balance with no earn or spend
     * logic anywhere yet. Both are carried so the prototype's data is not lost,
     * but neither means anything until a loyalty module defines them.
     */
    membership: varchar("membership", { length: 40 }).notNull().default(""),
    points: integer("points").notNull().default(0),

    preferences: jsonb("preferences").$type<string[]>().notNull().default([]),

    /**
     * Not required before booking (rule #30). Required for dashboard-wide
     * access, for changing the email, and for partner onboarding — where a
     * payout account is attached.
     */
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "string" }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "string" }),

    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),

    ...timestamps,
  },
  (t) => [
    // Case-insensitive uniqueness. The contract lower-cases on the way in, but
    // a seed script or a manual INSERT would not, and two accounts for one
    // person is not a state worth recovering from.
    unique("users_email_unique").on(t.email),
    check("users_role_check", sql`${t.role} IN ('customer', 'partner', 'admin')`),
    /*
     * Set for administrators, NULL for everyone else — enforced, not assumed.
     *
     * A customer row carrying `platform_role = 'super_admin'` would be
     * invisible in every screen and decisive in every permission check.
     */
    check(
      "users_platform_role_check",
      sql`(${t.role} = 'admin' AND ${t.platformRole} IN ('super_admin', 'ops', 'finance', 'support'))
          OR (${t.role} <> 'admin' AND ${t.platformRole} IS NULL)`
    ),
    check("users_status_check", sql`${t.status} IN ('active', 'suspended', 'blocked')`),
    check("users_tier_check", sql`${t.tier} IN ('standard', 'genius')`),
    check("users_points_check", sql`${t.points} >= 0`),
  ]
)

/**
 * Credentials live in their own table.
 *
 * Nothing that reads a user profile should be able to read a password hash by
 * accident — a `SELECT *` on `users` is a normal thing to write, and it must
 * not return one. Separating them makes the leak impossible rather than
 * merely unlikely.
 */
export const userCredentials = pgTable("user_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  /** argon2id, OWASP parameters. The encoded string carries its own params. */
  passwordHash: text("password_hash").notNull(),

  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),

  ...timestamps,
})

/**
 * Server-side sessions, not JWTs.
 *
 * A JWT cannot be revoked before it expires — "sign out everywhere", a
 * suspension, or a password change would all have to wait out the token. A row
 * can simply be deleted.
 *
 * The token itself is never stored: only a SHA-256 of it, so a database dump
 * does not hand out live sessions.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** SHA-256 of the cookie value, hex. Never the value itself. */
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),

    /** Idle window — extended on use. */
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    /** Hard ceiling — never extended, so a stolen session cannot live forever. */
    absoluteExpiresAt: timestamp("absolute_expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),

    /** For a "your devices" screen. Truncated — this is not analytics. */
    userAgent: varchar("user_agent", { length: 256 }).notNull().default(""),
    ip: varchar("ip", { length: 64 }).notNull().default(""),

    ...timestamps,
  },
  (t) => [
    unique("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_user_id_idx").on(t.userId),
    // The sweep that deletes expired sessions runs on this.
    index("sessions_expires_at_idx").on(t.expiresAt),
  ]
)

/* --------------------------------------------------------------- partner -- */

export const PLAN_TIERS = ["starter", "professional", "enterprise"] as const
export const PARTNER_ORG_STATUSES = ["active", "trial", "past_due", "suspended"] as const

export const partnerOrgs = pgTable(
  "partner_orgs",
  {
    id: primaryId(),
    name: varchar("name", { length: 160 }).notNull(),
    status: enumColumn("status").notNull().default("trial"),
    planTier: enumColumn("plan_tier").notNull().default("starter"),

    /**
     * Commission in BASIS POINTS — 1500 = 15.00% (rule #20).
     *
     * Integer bps, not a decimal fraction: floats do not belong in a ledger,
     * and 12.5% is exactly 1250. Defaults come from the plan tier, but the
     * column is per-org so a rate can be negotiated without a deploy.
     */
    commissionRateBps: integer("commission_rate_bps").notNull().default(1500),

    /**
     * How the platform COLLECTS that commission (rules #91, #92).
     *
     * `deduct` — held back from every payout. The default, and the only mode a
     * new partner gets: the platform never lets go of money it is owed.
     *
     * `invoice` — the partner receives the full amount and is billed monthly.
     * Only a platform admin may grant it, because it means handing over money
     * and then asking for a share back. If the partner does not pay, the
     * platform has already paid.
     *
     * Not a subscription. There is no monthly fee here — it is the same
     * commission, taken later.
     */
    settlementMode: enumColumn("settlement_mode").notNull().default("deduct"),

    /**
     * Payouts are held while an invoice is overdue (rule #95).
     *
     * A flag rather than a derived check: the payout run should not have to
     * ask about invoices, and an operator looking at an org needs to see why
     * its money stopped without reading another table.
     */
    payoutsHeld: boolean("payouts_held").notNull().default(false),

    contactEmail: varchar("contact_email", { length: 254 }).notNull().default(""),
    contactPhone: varchar("contact_phone", { length: 32 }).notNull().default(""),
    country: varchar("country", { length: 80 }).notNull().default(""),

    /**
     * Where the commission invoice is addressed.
     *
     * An invoice needs a bill-to address to be a document anybody's accountant
     * can file, and this org had only a country. The registration wizard asked
     * for it at step 22 — street, city, postcode, the lot — into inputs with no
     * state behind them and nowhere to go afterwards.
     *
     * Empty means "the same as the property", which is the ordinary case and
     * the answer the wizard defaults to.
     */
    billingAddress: varchar("billing_address", { length: 300 }).notNull().default(""),

    ...timestamps,
  },
  (t) => [
    check(
      "partner_orgs_status_check",
      sql`${t.status} IN ('active', 'trial', 'past_due', 'suspended')`
    ),
    check(
      "partner_orgs_plan_tier_check",
      sql`${t.planTier} IN ('starter', 'professional', 'enterprise')`
    ),
    check(
      "partner_orgs_settlement_mode_check",
      sql`${t.settlementMode} IN ('deduct', 'invoice')`
    ),
    // A negative rate would pay the partner extra; above 100% would take more
    // than the booking is worth.
    check(
      "partner_orgs_commission_check",
      sql`${t.commissionRateBps} >= 0 AND ${t.commissionRateBps} <= 10000`
    ),
  ]
)

export const PARTNER_ROLES = ["admin", "manager", "staff"] as const
export const PARTNER_MEMBER_STATUSES = ["active", "invited", "suspended"] as const

export const partnerMembers = pgTable(
  "partner_members",
  {
    id: primaryId(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** Permission level, not a job title (rule #14). */
    role: enumColumn("role").notNull().default("staff"),
    status: enumColumn("status").notNull().default("invited"),

    /**
     * What this person does, in their own words — "Revenue Manager", "Front
     * Office". NOT the permission `role`, which is one of three and decides
     * what they may touch. The contacts screen needs the first; nobody wants
     * to ring "the manager" when they mean the night desk.
     */
    jobTitle: varchar("job_title", { length: 80 }).notNull().default(""),

    /**
     * Which properties this member may touch. **Empty = all of the org's.**
     *
     * Two independent checks guard every partner request: `role` decides WHAT
     * they may do, this decides WHICH properties they may do it to.
     */
    propertyIds: jsonb("property_ids").$type<string[]>().notNull().default([]),

    invitedAt: timestamp("invited_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "string" }),

    ...timestamps,
  },
  (t) => [
    // One membership per person per org — otherwise a user could hold both
    // `staff` and `admin` and the permission check would depend on row order.
    unique("partner_members_org_user_unique").on(t.orgId, t.userId),
    index("partner_members_user_id_idx").on(t.userId),
    check("partner_members_role_check", sql`${t.role} IN ('admin', 'manager', 'staff')`),
    check(
      "partner_members_status_check",
      sql`${t.status} IN ('active', 'invited', 'suspended')`
    ),
  ]
)

/**
 * Password reset tokens (rule #54).
 *
 * A separate table rather than a column on the user, for the same reason
 * sessions are: a reset in flight has an expiry, an origin and a moment it was
 * spent, and a single column can hold none of that. It also lets a second
 * request invalidate the first without touching the account.
 *
 * The token is stored HASHED. A leaked database backup of plaintext reset
 * tokens is a leaked database backup of every account in it — anyone holding
 * one could walk in through the front door of the reset flow.
 */
/**
 * Email verification tokens (rule #58).
 *
 * Same shape and same reasoning as `passwordResets`: hashed, expiring, single
 * use. Kept as its own table rather than a shared "tokens" one, because the
 * two have different lifetimes and different consequences, and a single table
 * with a `purpose` column is one `WHERE` away from a reset link that verifies
 * an address or the other way round.
 */
export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "string" }),
    ...timestamps,
  },
  (t) => [
    unique("email_verifications_token_unique").on(t.tokenHash),
    index("email_verifications_user_idx").on(t.userId, t.expiresAt),
  ]
)

export const passwordResets = pgTable(
  "password_resets",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** sha256 of the token that was sent. Never the token itself. */
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    /**
     * When it was spent. Single use, and the guard is on the UPDATE.
     *
     * A reset link that works twice is a reset link that works again after the
     * guest has forwarded the email to somebody, or after it has sat in a
     * mailbox for a month.
     */
    usedAt: timestamp("used_at", { withTimezone: true, mode: "string" }),

    /** Where the request came from, for answering "who asked for this". */
    requestedIp: varchar("requested_ip", { length: 64 }).notNull().default(""),

    ...timestamps,
  },
  (t) => [
    unique("password_resets_token_unique").on(t.tokenHash),
    index("password_resets_user_idx").on(t.userId, t.expiresAt),
  ]
)

/**
 * Pending team invitations (rule #60).
 *
 * A separate table because a `partner_members` row needs a `user_id`, and the
 * person being invited may not have an account yet. Modelling the invite as a
 * half-written membership would put a NOT NULL column in the awkward position
 * of being sometimes null.
 *
 * The same shape as the reset and verification tokens — hashed, expiring,
 * single use — for the same reasons.
 */
export const partnerInvites = pgTable(
  "partner_invites",
  {
    id: primaryId(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: "cascade" }),

    /** Normalised the same way an account's is, so the two can be matched. */
    email: varchar("email", { length: 254 }).notNull(),
    role: enumColumn("role").notNull().default("staff"),
    /** Empty = every property the org owns, same as a membership. */
    propertyIds: jsonb("property_ids").$type<string[]>().notNull().default([]),

    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "string" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),

    /** Who sent it — "who let this person in" has to have an answer. */
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    ...timestamps,
  },
  (t) => [
    unique("partner_invites_token_unique").on(t.tokenHash),
    index("partner_invites_org_idx").on(t.orgId, t.email),
    check("partner_invites_role_check", sql`${t.role} IN ('admin', 'manager', 'staff')`),
  ]
)
