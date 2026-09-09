import { sql } from "drizzle-orm"

import type { Database } from "../../src/db/drizzle.module"

/**
 * Every table the suite may touch, emptied in one statement.
 *
 * Each spec used to delete only the tables it thought it used, in an order it
 * worked out for itself. That is fine in isolation and wrong in a full run:
 * anything a spec did not know about survives into the next file, and the
 * failure surfaces somewhere unrelated — an auth test finding two accounts
 * where it made one, a payments hook failing with no test name attached.
 *
 * `TRUNCATE ... CASCADE` needs no dependency order and no per-spec knowledge,
 * and it is a single statement, so it cannot half-succeed. `RESTART IDENTITY`
 * is harmless here (every key is a UUID) and keeps it honest if that changes.
 *
 * `amenities` is in the list too. It reads like reference data that should
 * survive — but no spec expects it to exist; the catalogue spec seeds its own
 * two rows, and leaving them behind collides on `amenities_slug_unique` the
 * second time that spec runs.
 */
const TABLES = [
  "platform_settings",
  "registration_documents",
  "partner_registrations",
  "favorites",
  "partner_contracts",
  "contract_templates",
  "commission_invoices",
  "commission_invoice_lines",
  "support_threads",
  "support_messages",
  "booking_messages",
  "audit_log",
  "search_events",
  "search_impressions",
  "booking_nights",
  "amenities",
  /*
   * The rate limiter's counters.
   *
   * Left behind, they make a spec's SECOND run behave differently from its
   * first: every sign-in in a file shares a small pool of client addresses, so
   * a re-run starts with the buckets already part-full and logins begin
   * failing partway through. The failures land on whichever test happened to
   * be there, which is the worst possible place to look for the cause.
   */
  "rate_limits",
  "notification_outbox",
  "notifications",
  "notification_preferences",
  "notification_settings",
  "payout_items",
  "payouts",
  "partner_payout_accounts",
  "payment_events",
  "payments",
  "booking_add_ons",
  "booking_events",
  "bookings",
  "idempotency_keys",
  "promotion_rooms",
  "promotion_properties",
  "promotions",
  "rate_plan_occupancy_prices",
  "rate_plan_rates",
  "rate_plans",
  "room_inventory",
  "rooms",
  "value_adds",
  "photos",
  "property_amenities",
  "properties",
  "partner_members",
  "partner_orgs",
  "password_resets",
  "email_verifications",
  "sessions",
  "user_credentials",
  "users",
] as const

/** Empties the database. Safe to call from `beforeEach` and `afterAll`. */
export async function resetDb(db: Database): Promise<void> {
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`)
  )
}
