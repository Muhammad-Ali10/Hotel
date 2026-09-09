import { sql } from "drizzle-orm"
import { check, integer, pgTable, smallint, timestamp, varchar } from "drizzle-orm/pg-core"

/* ============================================================================
 * Platform settings (rule #106).
 *
 * ONE row, and a CHECK that keeps it that way.
 *
 * Two fields, not the fifteen the screen used to offer. Everything else on it
 * either belonged to deploy configuration (`platformName`, `timezone`,
 * `defaultLanguage`), described a product that does not exist (`trialPeriodDays`,
 * `maxPropertiesFreePlan`), or was a switch for something a runtime toggle
 * cannot do (`integrations` — connecting Stripe is `env.ts`, not a button).
 *
 * A settings screen full of controls that change nothing is worse than a short
 * one: somebody sets a value, believes it, and finds out much later.
 * ========================================================================== */

export const platformSettings = pgTable(
  "platform_settings",
  {
    /** Always 1. The CHECK is what makes this a singleton. */
    id: smallint("id").primaryKey().default(1),

    /**
     * Where "reply to this email" reaches a person.
     *
     * Genuinely runtime: support addresses move between providers and teams,
     * and needing a deploy to change one is how a dead address stays on every
     * email for a month.
     */
    supportEmail: varchar("support_email", { length: 254 }).notNull().default(""),

    /**
     * What a NEW partner organisation starts on, in basis points.
     *
     * Existing agreements are never touched by this — a partner's rate is on
     * their own row, it is what their invoices were calculated from, and a
     * platform that could reprice history by editing one field would be a
     * platform nobody could reconcile against.
     */
    defaultCommissionRateBps: integer("default_commission_rate_bps").notNull().default(1500),

    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("platform_settings_singleton_check", sql`${t.id} = 1`),
    check(
      "platform_settings_commission_check",
      sql`${t.defaultCommissionRateBps} >= 0 AND ${t.defaultCommissionRateBps} <= 10000`
    ),
  ]
)
