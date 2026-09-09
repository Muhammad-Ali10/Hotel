import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { eq } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module"
import { resetDb } from "./support/reset-db"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { env } from "../src/config/env"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"
import {
  amenities,
  notificationOutbox,
  partnerMembers,
  partnerOrgs,
  properties,
  propertyAmenities,
  ratePlans,
  roomInventory,
  rooms,
  users,
} from "../src/db/schema"

const strong = "correct horse battery staple"

describe("catalog", () => {
  let app: NestExpressApplication
  let db: Database

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false })
    app.setGlobalPrefix("api")
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" })
    app.set("trust proxy", 1)
    app.use(cookieParser(env.SESSION_SECRET))
    applyBodyParsers(app)
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()
    /*
     * Listen ONCE, here.
     *
     * Given a server that is not listening, supertest binds an ephemeral port
     * per request and closes it after. Under the concurrent tests — five
     * simultaneous bookings on one room — that listen/close churn produces an
     * occasional ECONNRESET, which reads as a failure of the thing being
     * tested rather than of the harness testing it. A flaky test on the
     * overbooking guarantee is worse than no test: it teaches people to re-run.
     */
    await app.listen(0)
    db = moduleRef.get<Database>(DRIZZLE)
  })

  afterAll(async () => {
    await cleanup()
    await app?.close()
  })

  const cleanup = () => resetDb(db)

  const server = () => app.getHttpServer()
  let ipCounter = 0
  const freshIp = () => `203.0.113.${++ipCounter % 250}`

  /* ---------------------------------------------------------------- fixtures */

  type Fixture = Awaited<ReturnType<typeof seed>>

  async function seed() {
    const [wifi] = await db
      .insert(amenities)
      .values({ slug: "wifi", label: "WiFi", category: "internet", position: 1 })
      .returning()
    const [pool] = await db
      .insert(amenities)
      .values({ slug: "pool", label: "Pool", category: "wellness", position: 2 })
      .returning()

    const [aurora] = await db
      .insert(partnerOrgs)
      .values({ name: "Aurora Hospitality", status: "active" })
      .returning()
    const [rival] = await db
      .insert(partnerOrgs)
      .values({ name: "Rival Group", status: "active" })
      .returning()

    const [ritz] = await db
      .insert(properties)
      .values({
        slug: "the-ritz-carlton",
        name: "The Ritz-Carlton",
        city: "New York",
        country: "USA",
        timezone: "America/New_York",
        type: "hotel",
        stars: 5,
        status: "active",
        basePrice: 58_000,
        partnerOrgId: aurora!.id,
      })
      .returning()

    const [draft] = await db
      .insert(properties)
      .values({
        slug: "not-live-yet",
        name: "Not Live Yet",
        city: "New York",
        country: "USA",
        status: "pending_review",
        basePrice: 10_000,
        partnerOrgId: aurora!.id,
      })
      .returning()

    const [rivalProperty] = await db
      .insert(properties)
      .values({
        slug: "rival-hotel",
        name: "Rival Hotel",
        city: "Chicago",
        country: "USA",
        status: "active",
        basePrice: 30_000,
        partnerOrgId: rival!.id,
      })
      .returning()

    const [room] = await db
      .insert(rooms)
      .values({
        propertyId: ritz!.id,
        name: "Deluxe King Room",
        maxAdults: 2,
        maxChildren: 1,
        maxOccupancy: 2,
        units: 28,
      })
      .returning()

    await db.insert(ratePlans).values([
      {
        roomId: room!.id,
        name: "Flexible",
        basePrice: 72_500,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        isDefault: true,
      },
      {
        roomId: room!.id,
        name: "Non-refundable",
        basePrice: 62_000,
        cancelFreeUntil: "non_refundable",
        cancelCharge: "full",
      },
    ])

    await db.insert(propertyAmenities).values([
      { propertyId: ritz!.id, amenityId: wifi!.id },
      { propertyId: ritz!.id, amenityId: pool!.id },
      { propertyId: rivalProperty!.id, amenityId: wifi!.id },
    ])

    return { aurora: aurora!, rival: rival!, ritz: ritz!, draft: draft!, rivalProperty: rivalProperty! }
  }

  /** Signs up a user and promotes them to a partner of `orgId`. */
  async function partnerSession(email: string, orgId: string, role: "admin" | "manager" | "staff") {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "P", lastName: "M" })
      .expect(201)

    // Signup no longer hands back a session (rule #58): a cookie for a new
    // account and none for an existing one would be the same leak restated.
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)

    const userId = res.body.user.id as string
    await db.update(users).set({ role: "partner", platformRole: null })
    await db.insert(partnerMembers).values({ orgId, userId, role, status: "active" })

    return res.headers["set-cookie"] as unknown as string[]
  }

  let fx: Fixture

  beforeEach(async () => {
    await cleanup()
    fx = await seed()
  })

  /* ------------------------------------------------------- dated search -- */

  describe("searching for a stay, not just a hotel", () => {
    /*
     * Search used to take no dates at all. It answered a different question
     * from the one people ask: it listed hotels that MATCHED the filters,
     * whether or not a single room was free. A guest narrowed to five stars in
     * New York, chose one, and found out on the property page that it was full
     * for their week — after choosing it.
     */

    const iso = (offset: number) => {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() + offset)
      return d.toISOString().slice(0, 10)
    }

    /** Inventory rows for a range, open unless a night is named otherwise. */
    async function inventory(
      roomId: string,
      from: number,
      to: number,
      over: { booked?: Record<string, number>; closed?: string[] } = {}
    ) {
      const rows = []
      for (let i = from; i < to; i += 1) {
        const date = iso(i)
        rows.push({
          roomId,
          date,
          totalUnits: 2,
          sellableUnits: 2,
          bookedUnits: over.booked?.[date] ?? 0,
          isClosed: over.closed?.includes(date) ?? null,
        })
      }
      await db.insert(roomInventory).values(rows)
    }

    const roomOf = async (propertyId: string) => {
      const [row] = await db.select().from(rooms).where(eq(rooms.propertyId, propertyId))
      return row!
    }

    const search = (query: string) =>
      request(server()).get(`/api/v1/properties?${query}`)

    const slugsIn = (body: { items: { slug: string }[] }) => body.items.map((i) => i.slug)

    it("returns a hotel that is free for every night asked for", async () => {
      const room = await roomOf(fx.ritz.id)
      await inventory(room.id, 10, 20)

      const res = await search(`checkIn=${iso(12)}&checkOut=${iso(15)}&adults=2`).expect(200)

      expect(slugsIn(res.body)).toContain("the-ritz-carlton")
    })

    it("leaves out a hotel that is full on ONE night of the stay", async () => {
      const room = await roomOf(fx.ritz.id)
      // Every night open except the middle one, which is sold out.
      await inventory(room.id, 10, 20, { booked: { [iso(13)]: 2 } })

      const res = await search(`checkIn=${iso(12)}&checkOut=${iso(15)}&adults=2`).expect(200)

      /*
       * THE test. A room free on two nights of a three-night stay is not a
       * room this guest can book, and a filter that asked "any night" rather
       * than "every night" would return it — looking correct, and wrong in the
       * one way that wastes somebody's afternoon.
       */
      expect(slugsIn(res.body)).not.toContain("the-ritz-carlton")

      // And a shorter stay that avoids that night is still offered.
      const shorter = await search(`checkIn=${iso(10)}&checkOut=${iso(12)}&adults=2`).expect(200)
      expect(slugsIn(shorter.body)).toContain("the-ritz-carlton")
    })

    it("leaves out a hotel closed on a night of the stay", async () => {
      const room = await roomOf(fx.ritz.id)
      await inventory(room.id, 10, 20, { closed: [iso(13)] })

      const res = await search(`checkIn=${iso(12)}&checkOut=${iso(15)}&adults=2`).expect(200)
      expect(slugsIn(res.body)).not.toContain("the-ritz-carlton")
    })

    it("leaves out a hotel with no calendar at all", async () => {
      // `rival-hotel` has no rooms and no inventory. It matched every
      // undated search and would have gone on matching dated ones.
      const res = await search(`checkIn=${iso(12)}&checkOut=${iso(15)}&adults=2`).expect(200)
      expect(slugsIn(res.body)).not.toContain("rival-hotel")
    })

    it("leaves out a hotel whose rooms are too small for the party", async () => {
      const room = await roomOf(fx.ritz.id)
      await inventory(room.id, 10, 20)

      // The Deluxe King takes two adults; this is a party of four.
      const res = await search(`checkIn=${iso(12)}&checkOut=${iso(15)}&adults=4`).expect(200)
      expect(slugsIn(res.body)).not.toContain("the-ritz-carlton")
    })

    it("counts children towards the room's occupancy", async () => {
      const room = await roomOf(fx.ritz.id)
      await inventory(room.id, 10, 20)

      // maxOccupancy is 2. Two adults and a child is three people.
      const res = await search(
        `checkIn=${iso(12)}&checkOut=${iso(15)}&adults=2&children=1`
      ).expect(200)
      expect(slugsIn(res.body)).not.toContain("the-ritz-carlton")
    })

    it("browses everything when no dates are given", async () => {
      // Browsing without dates is a real thing to do, and it still works
      // exactly as it did — the filter applies only once somebody says when.
      const res = await search("city=New%20York").expect(200)
      expect(slugsIn(res.body)).toContain("the-ritz-carlton")
    })

    it("refuses half a date range", async () => {
      /*
       * One date alone cannot filter anything, so without this the request
       * would answer like a perfectly successful search over every hotel —
       * which is how somebody books a room that was never free.
       */
      await search(`checkIn=${iso(12)}`).expect(400)
      await search(`checkOut=${iso(15)}`).expect(400)
    })

    it("refuses a stay that ends before it starts", async () => {
      await search(`checkIn=${iso(15)}&checkOut=${iso(12)}`).expect(400)
      await search(`checkIn=${iso(12)}&checkOut=${iso(12)}`).expect(400)
    })
  })

  /* ------------------------------------------------------------ public read */

  it("lists only active properties", async () => {
    const res = await request(server()).get("/api/v1/properties").expect(200)
    const slugs = res.body.items.map((i: { slug: string }) => i.slug)
    expect(slugs).toContain("the-ritz-carlton")
    expect(slugs).toContain("rival-hotel")
    // Never a listing that has not been approved.
    expect(slugs).not.toContain("not-live-yet")
  })

  it("filters by city", async () => {
    const res = await request(server()).get("/api/v1/properties?city=Chicago").expect(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].slug).toBe("rival-hotel")
  })

  it("filters by amenity SLUG, requiring all of them (rule #31)", async () => {
    // Both properties have wifi; only the Ritz has a pool.
    const wifiOnly = await request(server())
      .get("/api/v1/properties?amenities=wifi")
      .expect(200)
    expect(wifiOnly.body.items).toHaveLength(2)

    const both = await request(server())
      .get("/api/v1/properties?amenities=wifi&amenities=pool")
      .expect(200)
    expect(both.body.items).toHaveLength(1)
    expect(both.body.items[0].slug).toBe("the-ritz-carlton")
  })

  it("filters by price and stars", async () => {
    const cheap = await request(server()).get("/api/v1/properties?maxPrice=40000").expect(200)
    expect(cheap.body.items.map((i: { slug: string }) => i.slug)).toEqual(["rival-hotel"])

    const fiveStar = await request(server()).get("/api/v1/properties?minStars=5").expect(200)
    expect(fiveStar.body.items.map((i: { slug: string }) => i.slug)).toEqual([
      "the-ritz-carlton",
    ])
  })

  it("rejects a nonsensical price range instead of returning nothing", async () => {
    await request(server())
      .get("/api/v1/properties?minPrice=50000&maxPrice=1000")
      .expect(400)
  })

  it("caps the page size, so a caller cannot ask for the whole table (API4)", async () => {
    await request(server()).get("/api/v1/properties?limit=5000").expect(400)
  })

  it("paginates by keyset without repeating or dropping rows", async () => {
    const first = await request(server()).get("/api/v1/properties?limit=1").expect(200)
    expect(first.body.items).toHaveLength(1)
    expect(first.body.nextCursor).toBeTruthy()

    const second = await request(server())
      .get(`/api/v1/properties?limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .expect(200)
    expect(second.body.items[0].slug).not.toBe(first.body.items[0].slug)
    // Two active properties, so the second page is the last.
    expect(second.body.nextCursor).toBeNull()
  })

  it("returns the detail page with rooms and both rate plans", async () => {
    const res = await request(server())
      .get("/api/v1/properties/the-ritz-carlton")
      .expect(200)

    expect(res.body).toMatchObject({ name: "The Ritz-Carlton", timezone: "America/New_York" })
    expect(res.body.rooms).toHaveLength(1)

    const plans = res.body.rooms[0].ratePlans
    expect(plans).toHaveLength(2)
    // Same room, two products, and the default first.
    expect(plans[0]).toMatchObject({ name: "Flexible", basePrice: 72_500, isDefault: true })
    expect(plans[1]).toMatchObject({ name: "Non-refundable", basePrice: 62_000 })
  })

  it("generates the cancellation sentence rather than storing it (rule #1)", async () => {
    const res = await request(server())
      .get("/api/v1/properties/the-ritz-carlton")
      .expect(200)
    const [flexible, nonRefundable] = res.body.rooms[0].ratePlans

    expect(flexible.cancellationText).toContain("48 hours before check-in")
    expect(flexible.cancellationText).toContain("50% of the room rate is charged")
    expect(nonRefundable.cancellationText).toContain("non-refundable")
    // ...and extras still come back, on every policy (rule #18).
    expect(nonRefundable.cancellationText).toContain("Extras")
  })

  it("404s an unapproved property even by its exact slug", async () => {
    await request(server()).get("/api/v1/properties/not-live-yet").expect(404)
  })

  /* ------------------------------------------------------- tenant isolation */

  it("lists only the partner's own properties", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    const res = await request(server())
      .get("/api/v1/partner/properties")
      .set("Cookie", cookie)
      .expect(200)

    const slugs = res.body.map((p: { slug: string }) => p.slug)
    expect(slugs).toContain("the-ritz-carlton")
    // Their own draft is theirs to see...
    expect(slugs).toContain("not-live-yet")
    // ...a rival's is not.
    expect(slugs).not.toContain("rival-hotel")
  })

  it("404s another org's property — NOT 403 (API1)", async () => {
    // A 403 would confirm the id is real. The row simply does not exist for
    // this caller, because the org scope is inside the query.
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    await request(server())
      .patch(`/api/v1/partner/properties/${fx.rivalProperty.id}`)
      .set("Cookie", cookie)
      .send({ name: "Hijacked" })
      .expect(404)

    const [row] = await db.select().from(properties).where(eq(properties.id, fx.rivalProperty.id))
    expect(row?.name).toBe("Rival Hotel")
  })

  it("honours a property-scoped membership inside the same org", async () => {
    // Scoped to the draft only — the Ritz is off-limits even though the org
    // owns it (rule #14: role says WHAT, propertyIds says WHICH).
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email: "scoped@aurora.test", password: strong, firstName: "S", lastName: "C" })
      .expect(201)

    // Signup no longer hands back a session (rule #58).
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "scoped@aurora.test", password: strong })
      .expect(200)
    await db.update(users).set({ role: "partner", platformRole: null })
    await db.insert(partnerMembers).values({
      orgId: fx.aurora.id,
      userId: res.body.user.id,
      role: "manager",
      status: "active",
      propertyIds: [fx.draft.id],
    })
    const cookie = res.headers["set-cookie"]

    const list = await request(server())
      .get("/api/v1/partner/properties")
      .set("Cookie", cookie)
      .expect(200)
    expect(list.body.map((p: { slug: string }) => p.slug)).toEqual(["not-live-yet"])

    await request(server())
      .patch(`/api/v1/partner/properties/${fx.ritz.id}`)
      .set("Cookie", cookie)
      .send({ name: "Nope" })
      .expect(404)
  })

  it("refuses a customer on the partner surface (API5)", async () => {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email: "guest@example.com", password: strong, firstName: "G", lastName: "T" })
      .expect(201)

    // Signup no longer hands back a session (rule #58).
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "guest@example.com", password: strong })
      .expect(200)

    await request(server())
      .get("/api/v1/partner/properties")
      .set("Cookie", res.headers["set-cookie"])
      .expect(403)
  })

  it("refuses an anonymous caller on the partner surface", async () => {
    await request(server()).get("/api/v1/partner/properties").expect(401)
  })

  /* ---------------------------------------------------------- partner write */

  it("lets a partner admin edit their own property", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    const res = await request(server())
      .patch(`/api/v1/partner/properties/${fx.ritz.id}`)
      .set("Cookie", cookie)
      .send({ name: "The Ritz-Carlton New York", policyPets: "No pets." })
      .expect(200)

    expect(res.body.name).toBe("The Ritz-Carlton New York")
  })

  it("refuses staff on a property edit (rule #14)", async () => {
    const cookie = await partnerSession("desk@aurora.test", fx.aurora.id, "staff")
    await request(server())
      .patch(`/api/v1/partner/properties/${fx.ritz.id}`)
      .set("Cookie", cookie)
      .send({ name: "Front desk was here" })
      .expect(403)
  })

  it("refuses fields a partner must not control (API3)", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")

    // Self-approval, org transfer, and a "from" price no rate plan backs up.
    for (const body of [
      { status: "active" },
      { partnerOrgId: fx.rival.id },
      { basePrice: 1 },
      { slug: "premium-slug" },
      { verification: "reviewed" },
    ]) {
      await request(server())
        .patch(`/api/v1/partner/properties/${fx.draft.id}`)
        .set("Cookie", cookie)
        .send(body)
        .expect(400)
    }

    const [row] = await db.select().from(properties).where(eq(properties.id, fx.draft.id))
    expect(row?.status).toBe("pending_review")
    expect(row?.slug).toBe("not-live-yet")
  })

  it("refuses an amenity that is not in the platform vocabulary (rule #31)", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    const res = await request(server())
      .patch(`/api/v1/partner/properties/${fx.ritz.id}`)
      .set("Cookie", cookie)
      .send({ amenities: ["wifi", "rooftop-infinity-pool"] })
      .expect(400)

    expect(JSON.stringify(res.body)).toContain("rooftop-infinity-pool")
  })

  it("replaces the amenity set when a valid one is sent", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    await request(server())
      .patch(`/api/v1/partner/properties/${fx.ritz.id}`)
      .set("Cookie", cookie)
      .send({ amenities: ["wifi"] })
      .expect(200)

    const detail = await request(server())
      .get("/api/v1/properties/the-ritz-carlton")
      .expect(200)
    expect(detail.body.amenities.map((a: { slug: string }) => a.slug)).toEqual(["wifi"])
  })
})
