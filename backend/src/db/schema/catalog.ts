import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { partnerOrgs, users } from "./auth"
import { enumColumn, primaryId, timestamps } from "./_shared"

/* ============================================================================
 * Module 2 — the catalogue: properties, rooms, rate plans, amenities, photos.
 * ========================================================================== */

export const PROPERTY_TYPES = [
  "hotel",
  "resort",
  "guesthouse",
  "hostel",
  "apartment",
  "villa",
  "bnb",
  "motel",
] as const
export const PROPERTY_STATUSES = [
  "draft",
  "pending_review",
  "changes_requested",
  "active",
  "rejected",
  "suspended",
] as const
export const VERIFICATION_STATUSES = ["not_submitted", "submitted", "reviewed"] as const

export const properties = pgTable(
  "properties",
  {
    id: primaryId(),

    /** Guest-facing URL segment. Generated from the name, unique, stable. */
    slug: varchar("slug", { length: 120 }).notNull(),

    name: varchar("name", { length: 160 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    country: varchar("country", { length: 80 }).notNull(),
    address: text("address").notNull().default(""),

    /**
     * IANA zone — `Asia/Tokyo`.
     *
     * Cancellation deadlines are evaluated in the property's own wall clock:
     * "48 hours before a 15:00 check-in in Tokyo" means 15:00 Tokyo time, not
     * 48×3600 seconds. Nothing in the prototype had this column, so every
     * property was implicitly UTC.
     */
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),

    type: enumColumn("type").notNull().default("hotel"),

    /**
     * Official classification, 1–5 (rule #15). NOT the guest review score —
     * that is always derived from published reviews and never stored.
     */
    stars: smallint("stars"),

    description: text("description").notNull().default(""),

    /**
     * Cheapest active rate plan across all rooms, in CENTS. Derived and stored
     * only so listings can sort and filter without joining every plan.
     * Recomputed whenever a rate plan changes; never hand-written.
     */
    basePrice: integer("base_price").notNull().default(0),

    partnerOrgId: uuid("partner_org_id").references(() => partnerOrgs.id, {
      onDelete: "restrict",
    }),

    status: enumColumn("status").notNull().default("draft"),

    /**
     * Material edits waiting for a human, while the listing stays live
     * (rules #71, #72).
     *
     * Only the fields in `MATERIAL_FIELDS`, and only the ones that actually
     * changed. The columns keep the APPROVED values, so search and the public
     * detail go on serving what was signed off — moving `status` to
     * `pending_review` instead would drop a live hotel out of search for a
     * typo fix, and the guests would pay for that, not the partner.
     *
     * `NULL` when there is nothing outstanding, which is also what the admin
     * queue filters on.
     */
    pendingChanges: jsonb("pending_changes"),
    verification: enumColumn("verification").notNull().default("not_submitted"),

    /** House rules. Cancellation is NOT here — it belongs to a rate plan. */
    checkInTime: varchar("check_in_time", { length: 5 }).notNull().default("15:00"),
    checkOutTime: varchar("check_out_time", { length: 5 }).notNull().default("12:00"),
    policyPayment: text("policy_payment").notNull().default(""),
    policyPets: text("policy_pets").notNull().default(""),
    policySmoking: text("policy_smoking").notNull().default(""),
    policyChildren: text("policy_children").notNull().default(""),

    /**
     * Latest local time a same-day booking is accepted, `HH:mm`. `null` → no
     * cutoff. Evaluated in the property's own `timezone` (rule #33).
     */
    sameDayCutoff: varchar("same_day_cutoff", { length: 5 }),

    /**
     * Where this listing sits in `recommended` search (rule #104).
     *
     * 0–10000, materialised by a nightly job rather than computed per request.
     * Sorting by a score requires ranking EVERY match before paging, and
     * recomputing five factors for a whole city on each keystroke is not a
     * search, it is a report.
     *
     * Starts at 0 and the job fills it in. A listing that has never been
     * ranked sorts last within `recommended` — the safe direction: it still
     * appears, just not above listings the platform knows something about.
     */
    rankingScore: integer("ranking_score").notNull().default(0),
    rankedAt: timestamp("ranked_at", { withTimezone: true, mode: "string" }),

    seed: varchar("seed", { length: 64 }).notNull().default(""),

    ...timestamps,
  },
  (t) => [
    unique("properties_slug_unique").on(t.slug),
    // The listing's primary filter — city plus "is it even live".
    index("properties_city_status_idx").on(t.city, t.status),
    index("properties_partner_org_idx").on(t.partnerOrgId),
    check(
      "properties_type_check",
      sql`${t.type} IN (
        'hotel', 'resort', 'guesthouse', 'hostel', 'apartment', 'villa', 'bnb', 'motel'
      )`
    ),
    check(
      "properties_status_check",
      sql`${t.status} IN ('draft', 'pending_review', 'changes_requested', 'active', 'rejected', 'suspended')`
    ),
    check(
      "properties_verification_check",
      sql`${t.verification} IN ('not_submitted', 'submitted', 'reviewed')`
    ),
    check("properties_stars_check", sql`${t.stars} IS NULL OR (${t.stars} >= 1 AND ${t.stars} <= 5)`),
    check("properties_base_price_check", sql`${t.basePrice} >= 0`),
    check(
      "properties_ranking_check",
      sql`${t.rankingScore} >= 0 AND ${t.rankingScore} <= 10000`
    ),
    // The `recommended` sort's own index: live listings, best first.
    index("properties_ranking_idx").on(t.status, t.rankingScore),
  ]
)

/**
 * A property row as it is CREATED — everything except the columns that are
 * derived from something else.
 *
 * `base_price` is not a fact about a property. It is a fact about its rate
 * plans, and `recomputeBasePrice` is the one place that says so. Leaving it in
 * the insert type is what let registration approval fill it by hand from the
 * price the applicant typed — while the same transaction created a cheaper
 * non-refundable plan underneath it. The listing went live advertising more
 * than its own cheapest bookable rate, and search, which FILTERS on this
 * column, left it out of the band it belonged in (rule #138).
 *
 * Omitting it here turns that into a compile error instead of something a
 * person has to notice. `ranking_score` / `ranked_at` are derived the same
 * way, by the ranking job, and are omitted for the same reason.
 *
 * Annotate the object literal with this type at every insert site — excess
 * property checking is what does the work.
 */
export type NewProperty = Omit<
  typeof properties.$inferInsert,
  "basePrice" | "rankingScore" | "rankedAt"
>

/* ------------------------------------------------------------- amenities -- */

/**
 * A controlled vocabulary, platform-managed (rule #31).
 *
 * Free text breaks the listing filter silently: a guest filtering for "WiFi"
 * never sees the property that typed "Free Wi-Fi", and nobody finds out. A
 * table also gives the extranet's grouped amenity UI the categories and icons
 * it already assumes exist.
 */
export const amenities = pgTable(
  "amenities",
  {
    id: primaryId(),
    /** Stable machine name — `wifi`. What the filter actually matches on. */
    slug: varchar("slug", { length: 64 }).notNull(),
    label: varchar("label", { length: 80 }).notNull(),
    /** Groups the extranet checklist — "Internet", "Wellness", "Dining". */
    category: varchar("category", { length: 64 }).notNull().default("general"),
    /** lucide icon name. Resolved by the UI, never rendered from the DB. */
    icon: varchar("icon", { length: 64 }).notNull().default("check"),
    position: smallint("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [unique("amenities_slug_unique").on(t.slug)]
)

export const propertyAmenities = pgTable(
  "property_amenities",
  {
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    amenityId: uuid("amenity_id")
      .notNull()
      .references(() => amenities.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.propertyId, t.amenityId] }),
    // "Which properties have a pool" — the listing filter runs this way round.
    index("property_amenities_amenity_idx").on(t.amenityId),
  ]
)

/* ------------------------------------------------------------------ room -- */

/**
 * A room TYPE, not a physical room. `units` is how many the property has.
 *
 * Carries no price: a room is sold through one or more rate plans, and the
 * price belongs to the plan (rule #27).
 */
export const rooms = pgTable(
  "rooms",
  {
    id: primaryId(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),

    /**
     * Capacity, split by rule #28. `maxOccupancy` is the hard ceiling and can
     * be lower than `maxAdults + maxChildren` — a room that sleeps 2 adults or
     * 1 adult + 2 children still only sleeps three people in total.
     */
    maxAdults: smallint("max_adults").notNull().default(2),
    maxChildren: smallint("max_children").notNull().default(0),
    maxOccupancy: smallint("max_occupancy").notNull().default(2),

    bed: varchar("bed", { length: 80 }).notNull().default(""),
    /** square metres */
    size: smallint("size").notNull().default(0),
    features: jsonb("features").$type<string[]>().notNull().default([]),

    /** How many of this room type exist. The ceiling on everything sellable. */
    units: smallint("units").notNull().default(1),

    seed: varchar("seed", { length: 64 }).notNull().default(""),

    /**
     * `archived` retires a room type without deleting it.
     *
     * Deleting is not available and should not be: bookings, inventory rows
     * and payout lines all point here, and a property that stops selling a
     * room still has to be able to read last year's stays of it.
     */
    status: enumColumn("status").notNull().default("active"),

    ...timestamps,
  },
  (t) => [
    index("rooms_property_idx").on(t.propertyId),
    check("rooms_max_adults_check", sql`${t.maxAdults} >= 1`),
    check("rooms_max_children_check", sql`${t.maxChildren} >= 0`),
    // A ceiling below the adult limit would make the room unbookable by its
    // own definition.
    check(
      "rooms_max_occupancy_check",
      sql`${t.maxOccupancy} >= ${t.maxAdults} AND ${t.maxOccupancy} <= ${t.maxAdults} + ${t.maxChildren}`
    ),
    check("rooms_units_check", sql`${t.units} >= 0`),
    check("rooms_status_check", sql`${t.status} IN ('active', 'archived')`),
  ]
)

/* ------------------------------------------------------------ rate plans -- */

export const CANCEL_FREE_UNTIL = [
  "6pm_arrival",
  "24h",
  "48h",
  "7d",
  "14d",
  "non_refundable",
] as const
export const CANCEL_CHARGES = ["first_night", "percent", "full"] as const
export const RATE_PLAN_STATUSES = ["active", "draft"] as const

/**
 * How a room is sold (rule #27).
 *
 * The same room becomes several products — "Flexible" at $725 with free
 * cancellation, "Non-refundable" at $620 with none. The prototype could not
 * express this: cancellation sat on the property, so one room had one policy
 * and one price.
 *
 * v1 seeds exactly one `is_default` plan per room, so nothing changes for a
 * guest until a partner creates a second.
 */
export const ratePlans = pgTable(
  "rate_plans",
  {
    id: primaryId(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 120 }).notNull(),

    /** Nightly rate in CENTS, before any calendar override. */
    basePrice: integer("base_price").notNull(),

    /**
     * How many adults `basePrice` is quoted for (rule #101).
     *
     * Not `maxAdults` — that is the ceiling the room can physically take. This
     * is the number the price assumes, and it is what the occupancy matrix
     * measures its differences FROM.
     */
    baseOccupancy: smallint("base_occupancy").notNull().default(2),

    /** Structured, never prose (rule #1). The guest-facing sentence is generated. */
    cancelFreeUntil: enumColumn("cancel_free_until").notNull().default("48h"),
    cancelCharge: enumColumn("cancel_charge").notNull().default("percent"),
    /** 1–100, required when and only when the charge is a percentage. */
    cancelChargeValue: smallint("cancel_charge_value"),

    /**
     * What a guest who never arrives is charged (rule #47).
     *
     * `NULL` means "the same as a cancellation" — the behaviour before these
     * columns existed, so nothing has to opt out.
     *
     * They exist because the two events are not the same and every hotel
     * prices them apart. A guest cancelling at 47 hours leaves the property a
     * night to re-sell the room; a guest who says nothing leaves it holding a
     * room for someone who never comes. "Free cancellation until 48 hours, but
     * a no-show is charged in full" is an ordinary policy — and with only one
     * charge column, the only way to write it was to drop free cancellation
     * altogether, which is not what the property was asking for.
     */
    noShowCharge: enumColumn("no_show_charge"),
    noShowChargeValue: smallint("no_show_charge_value"),

    /**
     * When this rate takes money (rule #42).
     *
     * `prepay`    — captured the moment the booking confirms.
     * `guarantee` — the card is verified and saved, nothing captured; the
     *               guest settles the room at the property.
     *
     * There is no "no card" mode. The prototype had one, and it left every
     * cancellation charge and no-show fee with nothing to charge.
     */
    paymentMode: enumColumn("payment_mode").notNull().default("prepay"),

    /** What the rate includes beyond the room — "Breakfast for two". */
    inclusions: jsonb("inclusions").$type<string[]>().notNull().default([]),

    defaultMinStay: smallint("default_min_stay").notNull().default(1),
    /** Longest stay this plan allows. `null` → unlimited. */
    defaultMaxStay: smallint("default_max_stay"),

    status: enumColumn("status").notNull().default("active"),
    isDefault: boolean("is_default").notNull().default(false),

    ...timestamps,
  },
  (t) => [
    index("rate_plans_room_idx").on(t.roomId),
    check("rate_plans_base_price_check", sql`${t.basePrice} >= 0`),
    check("rate_plans_min_stay_check", sql`${t.defaultMinStay} >= 1`),
    check(
      "rate_plans_max_stay_check",
      sql`${t.defaultMaxStay} IS NULL OR ${t.defaultMaxStay} >= ${t.defaultMinStay}`
    ),
    check("rate_plans_status_check", sql`${t.status} IN ('active', 'draft', 'archived')`),

    /**
     * At most ONE default rate plan per room.
     *
     * Partial, so archived and draft plans do not compete for the slot. Without
     * it a room can carry two defaults — and every screen that reaches for "the
     * default" then picks whichever the database happened to return first,
     * which is a different rate on different days.
     */
    uniqueIndex("rate_plans_one_default")
      .on(t.roomId)
      .where(sql`is_default = true AND status = 'active'`),
    check(
      "rate_plans_free_until_check",
      sql`${t.cancelFreeUntil} IN ('6pm_arrival', '24h', '48h', '7d', '14d', 'non_refundable')`
    ),
    check(
      "rate_plans_charge_check",
      sql`${t.cancelCharge} IN ('first_night', 'percent', 'full')`
    ),
    // The policy must be internally consistent: a percentage charge needs a
    // value, and anything else must not carry one. Enforced here rather than
    // only in zod, because a seed script does not go through zod.
    //
    // `IS NOT NULL` is load-bearing, not belt-and-braces. Without it the
    // percent branch evaluates to `TRUE AND NULL` = NULL, and a CHECK PASSES on
    // NULL — only an explicit FALSE rejects. The first version of this
    // constraint therefore accepted `charge = 'percent'` with no value, which
    // makes `refundFor` charge percentOf(room, 0) = nothing: a partner's
    // non-refundable protection silently becomes free cancellation.
    check(
      "rate_plans_charge_value_check",
      sql`(${t.cancelCharge} = 'percent'
             AND ${t.cancelChargeValue} IS NOT NULL
             AND ${t.cancelChargeValue} BETWEEN 1 AND 100)
          OR (${t.cancelCharge} <> 'percent' AND ${t.cancelChargeValue} IS NULL)`
    ),

    check(
      "rate_plans_no_show_charge_check",
      sql`${t.noShowCharge} IS NULL OR ${t.noShowCharge} IN ('first_night', 'percent', 'full')`
    ),
    /**
     * The no-show percentage exists exactly when it is a percentage.
     *
     * `IS DISTINCT FROM`, not `<>`. A NULL comparison yields NULL, a CHECK
     * that evaluates to NULL PASSES, and the whole constraint would then wave
     * through a `percent` with no number — which charges 0% and reads as a
     * working policy. That exact bug shipped once here already, in the
     * cancellation pair, and cost a migration to undo.
     */
    check(
      "rate_plans_no_show_value_check",
      sql`(${t.noShowCharge} = 'percent'
             AND ${t.noShowChargeValue} IS NOT NULL
             AND ${t.noShowChargeValue} BETWEEN 1 AND 100)
          OR (${t.noShowCharge} IS DISTINCT FROM 'percent' AND ${t.noShowChargeValue} IS NULL)`
    ),

    check("rate_plans_payment_mode_check", sql`${t.paymentMode} IN ('prepay', 'guarantee')`),

    /**
     * A non-refundable rate must be paid up front (rule #42).
     *
     * The rate that gives up the right to cancel is exactly the one that has
     * to be paid for. As a guarantee it would promise the property the money
     * whatever happens, then hold nothing but a verified card — and the
     * platform would be left chasing it. Enforced here as well as in
     * `isModeAllowed()`, because a partner UI is not a constraint.
     */
    check(
      "rate_plans_non_refundable_prepay_check",
      sql`${t.cancelFreeUntil} <> 'non_refundable' OR ${t.paymentMode} = 'prepay'`
    ),
  ]
)

/* ----------------------------------------------------------------- photo -- */

export const PHOTO_CATEGORIES = ["exterior", "interior", "rooms", "amenities", "dining"] as const

export const photos = pgTable(
  "photos",
  {
    id: primaryId(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    category: enumColumn("category").notNull().default("exterior"),
    caption: varchar("caption", { length: 200 }).notNull().default(""),
    position: smallint("position").notNull().default(0),

    /**
     * Where the file actually lives — the object key, not a URL.
     *
     * A key, so the bucket, the region and the CDN in front of it can all
     * change without rewriting a single row. `StorageProvider.publicUrl()`
     * turns it into something a browser can fetch.
     *
     * Empty for a seeded placeholder, which still renders from `seed`.
     */
    storageKey: varchar("storage_key", { length: 512 }).notNull().default(""),
    contentType: varchar("content_type", { length: 64 }).notNull().default(""),
    bytes: integer("bytes").notNull().default(0),
    width: smallint("width"),
    height: smallint("height"),

    /**
     * A new photo is not public until somebody has looked at it (rule #73).
     *
     * This is the reason photos are reviewable at all: a listing approved with
     * tasteful interiors could otherwise have every image swapped the next
     * morning, and nothing would notice.
     */
    status: enumColumn("status").notNull().default("pending"),

    /**
     * Placeholder seed, from before real uploads existed.
     *
     * Kept because the seeded catalogue and the frontend's `hotelImage(seed)`
     * still run on it — a photo with no `storage_key` falls back to this
     * rather than rendering a broken image.
     */
    seed: varchar("seed", { length: 64 }).notNull().default(""),

    ...timestamps,
  },
  (t) => [
    index("photos_property_idx").on(t.propertyId, t.position),
    // The public read: approved photos for one property, in order.
    index("photos_property_status_idx").on(t.propertyId, t.status, t.position),
    check(
      "photos_category_check",
      sql`${t.category} IN ('exterior', 'interior', 'rooms', 'amenities', 'dining')`
    ),
    check(
      "photos_status_check",
      sql`${t.status} IN ('pending', 'approved', 'rejected')`
    ),
    check("photos_bytes_check", sql`${t.bytes} >= 0`),
    /*
     * A real upload has to say where it is and what it is.
     *
     * Written as an equality between two `IS NOT NULL`-style tests rather than
     * an implication, so it can never evaluate to NULL — the trap that let a
     * half-filled date pair into `search_events` until the database was asked
     * about it directly.
     */
    check(
      "photos_storage_consistency",
      sql`(${t.storageKey} = '') = (${t.contentType} = '')`
    ),
  ]
)

/* ------------------------------------------------------------ value-adds -- */

export const VALUE_ADD_UNITS = [
  "per_stay",
  "per_night",
  "per_person",
  "per_person_per_night",
] as const

export const valueAdds = pgTable(
  "value_adds",
  {
    id: primaryId(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    category: varchar("category", { length: 64 }).notNull().default("general"),
    description: text("description").notNull().default(""),
    /** CENTS. */
    price: integer("price").notNull(),
    /**
     * `per_person_per_night` is the unit the prototype lacked (rule #10) —
     * "Daily breakfast" was priced `per_person` and charged $32 once for a
     * three-night stay.
     */
    unit: enumColumn("unit").notNull().default("per_stay"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("value_adds_property_idx").on(t.propertyId),
    check("value_adds_price_check", sql`${t.price} >= 0`),
    check(
      "value_adds_unit_check",
      sql`${t.unit} IN ('per_stay', 'per_night', 'per_person', 'per_person_per_night')`
    ),
  ]
)

/* ============================================================================
 * Module 14 — saved properties.
 * ========================================================================== */

/**
 * A guest's saved list.
 *
 * No surrogate id: the pair IS the row, and a composite primary key is what
 * makes "saved twice" impossible rather than something the service has to
 * remember to check. Tapping the heart again is then genuinely idempotent —
 * `ON CONFLICT DO NOTHING` — instead of a read-then-write two people racing.
 *
 * `ON DELETE CASCADE` both ways on purpose. A saved list is a convenience: it
 * has no meaning once either side is gone, and keeping the row would leave a
 * card pointing at nothing.
 */
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.propertyId] }),
    /*
     * The list reads newest-first per user, which the primary key cannot
     * serve — its leading column is the user but its second is the property,
     * so ordering by date would sort every one of somebody's saves in memory.
     */
    index("favorites_user_recent_idx").on(t.userId, t.createdAt),
  ]
)

/* ============================================================================
 * Per-guest pricing (rule #101).
 * ========================================================================== */

/**
 * What a rate plan charges at each occupancy.
 *
 * Sparse, like both calendars: a level with no row means "no difference from
 * the base occupancy". A plan that charges the same whatever the party size
 * has no rows here at all, which is what every plan starts as.
 *
 * The stored figure is the FULL nightly price at that occupancy, at the rate
 * plan's own base rate — which is how a partner thinks about it and what the
 * screen shows. It is applied as a DIFFERENCE from the base occupancy, so a
 * calendar override for a busy week raises every party size with it. Storing
 * absolutes and using them directly would mean a partner raising the June rate
 * raised only the two-guest price, and a family of four kept paying May's.
 */
export const ratePlanOccupancyPrices = pgTable(
  "rate_plan_occupancy_prices",
  {
    ratePlanId: uuid("rate_plan_id")
      .notNull()
      .references(() => ratePlans.id, { onDelete: "cascade" }),

    /** Adults. Children have their own allowance and are not priced per head. */
    guests: smallint("guests").notNull(),

    /** CENTS, the full nightly price at this occupancy. */
    price: integer("price").notNull(),

    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.ratePlanId, t.guests] }),
    check("rate_plan_occupancy_guests_check", sql`${t.guests} >= 1 AND ${t.guests} <= 30`),
    check("rate_plan_occupancy_price_check", sql`${t.price} >= 0`),
  ]
)

