import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { env } from "../config/env"
import {
  amenities,
  partnerMembers,
  partnerOrgs,
  photos,
  platformSettings,
  type NewProperty,
  properties,
  propertyAmenities,
  ratePlans,
  roomInventory,
  rooms,
  userCredentials,
  users,
  valueAdds,
} from "./schema"

/* ============================================================================
 * A working marketplace, from nothing.
 *
 * Until now the database has only ever been filled by tests, which build the
 * smallest fixture each one needs and tear it down again. Nothing has ever put
 * a hotel in it that a person could open in a browser — so the frontend has
 * never had anything real to point at.
 *
 * Safe to run twice: it clears what it owns first. Refuses to run against
 * anything but a development database, because "seed" and "wipe" are the same
 * operation from the data's point of view.
 *
 *   npm run db:seed
 * ========================================================================== */

const GUEST_EMAIL = "guest@stayora.test"
const PARTNER_EMAIL = "owner@aurora.test"
const ADMIN_EMAIL = "admin@stayora.test"
/** Long enough for the API's own rules to accept it. */
const PASSWORD = "correct horse battery staple"

const AMENITIES = [
  { slug: "wifi", label: "Free WiFi", category: "general", icon: "wifi" },
  { slug: "pool", label: "Swimming pool", category: "leisure", icon: "waves" },
  { slug: "spa", label: "Spa", category: "leisure", icon: "flower" },
  { slug: "gym", label: "Fitness centre", category: "leisure", icon: "dumbbell" },
  { slug: "parking", label: "Free parking", category: "general", icon: "car" },
  { slug: "restaurant", label: "Restaurant", category: "dining", icon: "utensils" },
  { slug: "bar", label: "Bar", category: "dining", icon: "wine" },
  { slug: "air-conditioning", label: "Air conditioning", category: "room", icon: "wind" },
  { slug: "room-service", label: "Room service", category: "room", icon: "concierge-bell" },
  { slug: "airport-shuttle", label: "Airport shuttle", category: "travel", icon: "plane" },
]

/** Enough properties in one city for the comparables floor to clear (rule #65). */
const PROPERTIES = [
  { slug: "the-ritz-carlton", name: "The Ritz-Carlton", city: "New York", stars: 5, base: 72_500, address: "50 Central Park S, New York, NY 10019" },
  { slug: "the-plaza", name: "The Plaza", city: "New York", stars: 5, base: 68_000, address: "768 5th Ave, New York, NY 10019" },
  { slug: "the-carlyle", name: "The Carlyle", city: "New York", stars: 5, base: 59_000, address: "35 E 76th St, New York, NY 10021" },
  { slug: "hotel-chelsea", name: "Hotel Chelsea", city: "New York", stars: 4, base: 32_000, address: "222 W 23rd St, New York, NY 10011" },
  { slug: "the-bowery", name: "The Bowery Hotel", city: "New York", stars: 4, base: 41_000, address: "335 Bowery, New York, NY 10003" },
  { slug: "the-standard-nyc", name: "The Standard", city: "New York", stars: 4, base: 38_000, address: "848 Washington St, New York, NY 10014" },
  { slug: "four-seasons-paris", name: "Four Seasons George V", city: "Paris", stars: 5, base: 94_000, address: "31 Av. George V, 75008 Paris" },
  { slug: "le-meurice", name: "Le Meurice", city: "Paris", stars: 5, base: 88_000, address: "228 Rue de Rivoli, 75001 Paris" },
]

/** How far ahead the calendar is loaded. A year is enough to book against. */
const CALENDAR_DAYS = 365

async function main() {
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database.")
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL })
  const db = drizzle(pool)

  console.log("Clearing…")
  /*
   * Only what this script owns. `TRUNCATE … CASCADE` from `users` and
   * `partner_orgs` reaches every dependent row, so a re-run starts clean
   * without listing thirty tables in dependency order.
   */
  await db.execute(
    sql`TRUNCATE TABLE "users", "partner_orgs", "amenities" RESTART IDENTITY CASCADE`
  )

  /* --------------------------------------------------------------- people */

  // Imported lazily: `@node-rs/argon2` is a native module, and loading it at
  // the top would make even `--help` pay for it.
  const { hash, Algorithm } = await import("@node-rs/argon2")
  const passwordHash = await hash(PASSWORD, { algorithm: Algorithm.Argon2id })

  /*
   * The hash goes in its own table, never on `users` (see `userCredentials`).
   * A `SELECT *` on a profile is an ordinary thing to write, and it must not
   * be able to return a password hash by accident.
   */
  const verifiedNow = new Date().toISOString()
  const people = await db
    .insert(users)
    .values([
      { email: GUEST_EMAIL, firstName: "Amelia", lastName: "Hart", role: "customer", emailVerifiedAt: verifiedNow },
      { email: ADMIN_EMAIL, firstName: "Root", lastName: "Admin", role: "admin", platformRole: "super_admin", emailVerifiedAt: verifiedNow },
      { email: PARTNER_EMAIL, firstName: "Daniel", lastName: "Okafor", role: "partner", emailVerifiedAt: verifiedNow },
    ])
    .returning()

  await db
    .insert(userCredentials)
    .values(people.map((person) => ({ userId: person.id, passwordHash })))

  const owner = people.find((p) => p.email === PARTNER_EMAIL)!

  /* ------------------------------------------------------------ the org */

  const [org] = await db
    .insert(partnerOrgs)
    .values({
      name: "Aurora Hospitality",
      contactEmail: "hello@aurora.test",
      contactPhone: "+1 212 555 0100",
      country: "USA",
      status: "active",
      planTier: "professional",
      commissionRateBps: 1500,
    })
    .returning()

  await db.insert(partnerMembers).values({
    orgId: org!.id,
    userId: owner.id,
    role: "admin",
    status: "active",
    // Empty = every property the org owns.
    propertyIds: [],
  })

  /* ------------------------------------------------------- the catalogue */

  /*
   * The platform's own singleton.
   *
   * Created on demand by the admin settings screen, which means a freshly
   * seeded database has no row until somebody opens it — and until then every
   * reader falls back. The registration wizard quotes this rate to applicants,
   * so a seeded platform should have a real one from the start.
   */
  await db
    .insert(platformSettings)
    .values({ id: 1, supportEmail: "support@stayora.test" })
    .onConflictDoNothing()

  const amenityRows = await db.insert(amenities).values(AMENITIES).returning()

  console.log(`Seeding ${PROPERTIES.length} properties…`)
  for (const [index, spec] of PROPERTIES.entries()) {
    /*
     * `NewProperty`, so `basePrice` cannot be named here (rule #138a).
     *
     * It used to be `spec.base` — which is the FLEXIBLE plan's price. Every
     * room below also gets a non-refundable plan at 15% off it, and that is
     * the cheapest thing a guest can actually book. So the seed reproduced
     * the exact bug rule #138 describes: eight listings each advertising more
     * than their own cheapest rate, and missing from the search band they
     * belonged in. Derived at the end of the run instead.
     */
    const propertyRow: NewProperty = {
      slug: spec.slug,
      name: spec.name,
      city: spec.city,
      country: spec.city === "Paris" ? "France" : "USA",
      type: "hotel",
      stars: spec.stars,
      timezone: spec.city === "Paris" ? "Europe/Paris" : "America/New_York",
      checkInTime: "15:00",
      status: "active",
      address: spec.address,
      description:
        `${spec.name} sits in the heart of ${spec.city}, a short walk from the ` +
        `landmarks most guests come for. Rooms are quiet, generously sized and ` +
        `serviced twice daily, with a restaurant and bar on site.`,
      partnerOrgId: org!.id,
      // Drives the placeholder photography until real uploads land. The
      // frontend's `hotelImage(seed)` resolves it to a stable image, so the
      // same hotel keeps the same picture across renders.
      seed: spec.slug,
    }

    const [property] = await db.insert(properties).values(propertyRow).returning()

    // Six or seven amenities each, varied enough that filtering does something.
    await db.insert(propertyAmenities).values(
      amenityRows.slice(0, 6 + (index % 4)).map((a) => ({
        propertyId: property!.id,
        amenityId: a.id,
      }))
    )

    await db.insert(photos).values(
      ["exterior", "interior", "rooms", "amenities", "dining"].map((category, i) => ({
        propertyId: property!.id,
        category,
        caption: `${spec.name} — ${category}`,
        position: i,
        seed: `${spec.slug}-${i}`,
        // Seeded photos stand in for approved ones — a seeded catalogue whose
        // every gallery was empty would be no catalogue at all (rule #73).
        status: "approved",
      }))
    )

    await db.insert(valueAdds).values([
      {
        propertyId: property!.id,
        name: "Breakfast",
        price: 4_500,
        unit: "per_person_per_night",
      },
      { propertyId: property!.id, name: "Airport transfer", price: 6_500, unit: "per_stay" },
    ])

    /* ----------------------------------------------------------- rooms */

    const roomSpecs = [
      { name: "Deluxe King Room", units: 8, multiplier: 1 },
      { name: "Executive Suite", units: 4, multiplier: 1.6 },
    ]

    for (const roomSpec of roomSpecs) {
      const price = Math.round(spec.base * roomSpec.multiplier)
      const [room] = await db
        .insert(rooms)
        .values({
          propertyId: property!.id,
          name: roomSpec.name,
          maxAdults: 2,
          maxChildren: 2,
          maxOccupancy: 3,
          units: roomSpec.units,
          seed: `${spec.slug}-${roomSpec.name}`,
        })
        .returning()

      /*
       * Two rate plans, so the payment-mode split is visible from the first
       * click: a flexible one that takes the card as a guarantee, and a
       * cheaper non-refundable one that must be prepaid (rule #42 — the
       * database refuses any other combination).
       */
      await db.insert(ratePlans).values([
        {
          roomId: room!.id,
          name: "Flexible",
          basePrice: price,
          cancelFreeUntil: "48h",
          cancelCharge: "percent",
          cancelChargeValue: 50,
          paymentMode: "guarantee",
          isDefault: true,
          status: "active",
        },
        {
          roomId: room!.id,
          name: "Non-refundable",
          basePrice: Math.round(price * 0.85),
          cancelFreeUntil: "non_refundable",
          cancelCharge: "full",
          cancelChargeValue: null,
          paymentMode: "prepay",
          isDefault: false,
          status: "active",
        },
      ])

      /*
       * The calendar.
       *
       * Materialised here rather than left sparse: an empty calendar is not
       * "no rooms", it is "never loaded", and the booking transaction would
       * create the rows on demand anyway. Loading them up front is what makes
       * availability answerable before anybody books.
       */
      await db.execute(sql`
        INSERT INTO ${roomInventory} (room_id, date, total_units, sellable_units, booked_units)
        SELECT ${room!.id}::uuid, d::date, ${roomSpec.units}, ${roomSpec.units}, 0
        FROM generate_series(CURRENT_DATE, CURRENT_DATE + ${CALENDAR_DAYS}::int, '1 day') AS d
        ON CONFLICT (room_id, date) DO NOTHING
      `)
    }
  }

  /* --------------------------------------------------------- the from-price */

  /*
   * Derived once, at the end, for every property at the same time.
   *
   * This is `recomputeBasePrice` restated as one set-based statement — the
   * seed has no Nest container to inject the repository from. It runs LAST
   * because it can only be right after the rate plans exist.
   *
   * The column is what search FILTERS on, so a seeded database that had the
   * wrong number here was a database where "under $600" quietly omitted a
   * hotel bookable at $578 (rule #138).
   */
  await db.execute(sql`
    UPDATE properties p
    SET base_price = COALESCE((
      SELECT MIN(rp.base_price)
      FROM rate_plans rp
      JOIN rooms r ON r.id = rp.room_id
      WHERE r.property_id = p.id
        AND rp.status = 'active'
        AND r.status = 'active'
    ), 0)
  `)

  await pool.end()

  console.log(`
Done.

  ${PROPERTIES.length} properties · ${PROPERTIES.filter((p) => p.city === "New York").length} in New York
  ${CALENDAR_DAYS} days of calendar, per room

Sign in with:

  guest     ${GUEST_EMAIL}
  partner   ${PARTNER_EMAIL}
  admin     ${ADMIN_EMAIL}
  password  ${PASSWORD}
`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
