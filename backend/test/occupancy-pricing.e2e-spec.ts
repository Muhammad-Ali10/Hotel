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
  partnerMembers,
  partnerOrgs,
  properties,
  ratePlans,
  rooms,
  users,
} from "../src/db/schema"

const strong = "correct horse battery staple"

const iso = (offsetDays: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

/** $725 a night for two, three nights. The figure everything below moves from. */
const BASE = 72_500
const NIGHTS = 3

describe("pricing per guest (rule #101)", () => {
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
    await app.listen(0)
    db = moduleRef.get<Database>(DRIZZLE)
  })

  afterAll(async () => {
    await resetDb(db)
    await app?.close()
  })

  type Fixture = Awaited<ReturnType<typeof seed>>
  let fx: Fixture

  beforeEach(async () => {
    await resetDb(db)
    fx = await seed()
  })

  const server = () => app.getHttpServer()
  let n = 0
  const freshIp = () => `203.0.113.${++n % 250}`

  async function seed() {
    const mkOrg = async (name: string, slug: string) => {
      const [org] = await db
        .insert(partnerOrgs)
        .values({ name, status: "active", commissionRateBps: 1500 })
        .returning()
      const [property] = await db
        .insert(properties)
        .values({
          slug,
          name,
          city: "New York",
          country: "USA",
          timezone: "America/New_York",
          checkInTime: "15:00",
          status: "active",
          basePrice: BASE,
          partnerOrgId: org!.id,
        })
        .returning()
      return { org: org!, property: property! }
    }

    const aurora = await mkOrg("Aurora", "the-ritz-carlton")
    const rival = await mkOrg("Rival", "rival-hotel")

    // A family room, so a party of four is something the room can legitimately
    // take — otherwise "priced for four" and "fits four" get tangled together.
    const [suite] = await db
      .insert(rooms)
      .values({
        propertyId: aurora.property.id,
        name: "Family Suite",
        maxAdults: 4,
        maxChildren: 2,
        maxOccupancy: 6,
        units: 10,
      })
      .returning()

    const [flexible] = await db
      .insert(ratePlans)
      .values({
        roomId: suite!.id,
        name: "Flexible",
        basePrice: BASE,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        isDefault: true,
      })
      .returning()

    return { aurora, rival, suite: suite!, flexible: flexible! }
  }

  async function account(email: string) {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "Amelia", lastName: "Hart" })
      .expect(201)
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    return {
      cookie: res.headers["set-cookie"] as unknown as string[],
      id: res.body.user.id as string,
      email,
    }
  }

  async function partner(role: "admin" | "manager" | "staff", orgId = fx.aurora.org.id) {
    const g = await account(`${role}${++n}@partner.test`)
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, g.id))
    await db
      .insert(partnerMembers)
      .values({ orgId, userId: g.id, role, status: "active", propertyIds: [] })
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: g.email, password: strong })
      .expect(200)
    return res.headers["set-cookie"] as unknown as string[]
  }

  const grid = (cookie: string[], ratePlanId = fx.flexible.id) =>
    request(server())
      .get(`/api/v1/partner/rate-plans/${ratePlanId}/occupancy-prices`)
      .set("Cookie", cookie)

  const setGrid = (cookie: string[], body: object, ratePlanId = fx.flexible.id) =>
    request(server())
      .put(`/api/v1/partner/rate-plans/${ratePlanId}/occupancy-prices`)
      .set("Cookie", cookie)
      .send(body)

  const quote = (over: Record<string, unknown> = {}) =>
    request(server())
      .post("/api/v1/properties/the-ritz-carlton/quote")
      .set("x-forwarded-for", freshIp())
      .send({
        roomId: fx.suite.id,
        ratePlanId: fx.flexible.id,
        checkIn: iso(10),
        checkOut: iso(10 + NIGHTS),
        adults: 2,
        children: 0,
        ...over,
      })

  /* ================================================================ grid == */

  it("starts unconfigured, showing the base rate at every party size", async () => {
    const cookie = await partner("manager")

    const res = await grid(cookie).expect(200)

    expect(res.body.baseOccupancy).toBe(2)
    expect(res.body.rows).toHaveLength(4)
    // An empty grid gives nothing to edit; the base rate at every level reads
    // as "not configured" rather than as broken.
    expect(res.body.rows.every((r: { isSet: boolean }) => r.isSet === false)).toBe(true)
    expect(res.body.rows.every((r: { price: number }) => r.price === BASE)).toBe(true)
  })

  it("saves a grid and marks which levels are the partner's own", async () => {
    const cookie = await partner("manager")

    const res = await setGrid(cookie, {
      prices: [
        { guests: 1, price: 60_000 },
        { guests: 2, price: BASE },
      ],
    }).expect(200)

    expect(res.body.rows[0]).toMatchObject({ guests: 1, price: 60_000, isSet: true })
    expect(res.body.rows[1]).toMatchObject({ guests: 2, price: BASE, isSet: true })
    expect(res.body.rows[2]).toMatchObject({ guests: 3, isSet: false })
  })

  it("refuses a grid that never prices the base occupancy", async () => {
    const cookie = await partner("manager")

    /*
     * A difference needs two numbers. Without the base level every other one
     * resolves to no adjustment at all, and the partner would believe they had
     * set prices that were silently doing nothing.
     */
    await setGrid(cookie, { prices: [{ guests: 3, price: 90_000 }] }).expect(400)
  })

  it("refuses two prices for the same party size", async () => {
    const cookie = await partner("manager")
    await setGrid(cookie, {
      prices: [
        { guests: 2, price: BASE },
        { guests: 2, price: 80_000 },
      ],
    }).expect(400)
  })

  /* =============================================================== quote == */

  it("charged everybody the same before a grid existed", async () => {
    const solo = await quote({ adults: 1 }).expect(201)
    const couple = await quote({ adults: 2 }).expect(201)

    // The gap this closes: a solo traveller paid a family's price.
    expect(solo.body.pricing.roomSubtotal).toBe(BASE * NIGHTS)
    expect(couple.body.pricing.roomSubtotal).toBe(BASE * NIGHTS)
  })

  it("charges a solo traveller less once a single rate exists", async () => {
    const cookie = await partner("manager")
    await setGrid(cookie, {
      prices: [
        { guests: 1, price: 60_000 },
        { guests: 2, price: BASE },
      ],
    }).expect(200)

    const solo = await quote({ adults: 1 }).expect(201)
    const couple = await quote({ adults: 2 }).expect(201)

    expect(solo.body.pricing.roomSubtotal).toBe(60_000 * NIGHTS)
    expect(couple.body.pricing.roomSubtotal).toBe(BASE * NIGHTS)
  })

  it("carries a seasonal rate change through to every party size", async () => {
    const cookie = await partner("manager")
    await setGrid(cookie, {
      prices: [
        { guests: 1, price: 60_000 },
        { guests: 2, price: BASE },
      ],
    }).expect(200)

    // The calendar lifts the whole stay to 90,000 for a busy week.
    await request(server())
      .post("/api/v1/partner/inventory/rates")
      .set("Cookie", cookie)
      .send({ ratePlanId: fx.flexible.id, from: iso(10), to: iso(12), rate: 90_000 })
      .expect(201)

    const solo = await quote({ adults: 1 }).expect(201)

    /*
     * 90,000 less the 12,500 the single rate sits below the double, per night.
     *
     * This is why the matrix is applied as a DIFFERENCE. Used as stored
     * absolutes it would have charged 60,000 — the partner would have raised
     * the June rate and the solo traveller would still be paying May's.
     */
    expect(solo.body.pricing.roomSubtotal).toBe(77_500 * NIGHTS)
  })

  it("charges a bigger party at the largest level actually set", async () => {
    const cookie = await partner("manager")
    await setGrid(cookie, {
      prices: [
        { guests: 2, price: BASE },
        { guests: 3, price: 82_500 },
      ],
    }).expect(200)

    // The suite takes four adults but only three were priced. Extrapolating
    // would quote a number nobody entered; refusing would make a room the
    // guest may legitimately occupy unbookable.
    const four = await quote({ adults: 4 }).expect(201)
    expect(four.body.pricing.roomSubtotal).toBe(82_500 * NIGHTS)
  })

  it("never invents a discount for a level the partner did not price", async () => {
    const cookie = await partner("manager")
    await setGrid(cookie, {
      prices: [
        { guests: 2, price: BASE },
        { guests: 3, price: 82_500 },
      ],
    }).expect(200)

    // No single rate was set, so one guest pays the base. Discounting on the
    // partner's behalf gives away money they never agreed to give away.
    const solo = await quote({ adults: 1 }).expect(201)
    expect(solo.body.pricing.roomSubtotal).toBe(BASE * NIGHTS)
  })

  it("clears the grid back to one price for everybody", async () => {
    const cookie = await partner("manager")
    await setGrid(cookie, {
      prices: [
        { guests: 1, price: 60_000 },
        { guests: 2, price: BASE },
      ],
    }).expect(200)

    await setGrid(cookie, { prices: [] }).expect(200)

    const solo = await quote({ adults: 1 }).expect(201)
    expect(solo.body.pricing.roomSubtotal).toBe(BASE * NIGHTS)
  })

  it("prices on adults, not on children", async () => {
    const cookie = await partner("manager")
    await setGrid(cookie, {
      prices: [
        { guests: 2, price: BASE },
        { guests: 3, price: 82_500 },
      ],
    }).expect(200)

    // Two adults and a child is still a two-adult rate: children have their
    // own allowance on the room and are not charged per head.
    const withChild = await quote({ adults: 2, children: 1 }).expect(201)
    expect(withChild.body.pricing.roomSubtotal).toBe(BASE * NIGHTS)
  })

  /* ============================================================== access == */

  it("refuses front-desk staff", async () => {
    const staff = await partner("staff")
    await setGrid(staff, { prices: [{ guests: 2, price: 10_000 }] }).expect(403)
  })

  it("refuses another organisation entirely — 404, not 403", async () => {
    const outsider = await partner("admin", fx.rival.org.id)

    // A 403 would confirm the rate plan id belongs to somebody (API1).
    await grid(outsider).expect(404)
    await setGrid(outsider, { prices: [{ guests: 2, price: 10_000 }] }).expect(404)
  })

  it("needs a session", async () => {
    await request(server())
      .get(`/api/v1/partner/rate-plans/${fx.flexible.id}/occupancy-prices`)
      .expect(401)
  })
})
