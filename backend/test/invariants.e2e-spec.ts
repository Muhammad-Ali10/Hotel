import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { eq } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module"
import { basePriceDrift } from "./support/invariants"
import { resetDb } from "./support/reset-db"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { env } from "../src/config/env"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"
import { partnerMembers, partnerOrgs, properties, users } from "../src/db/schema"

/* ============================================================================
 * The "from" price is derived, and stays derived.
 *
 * `properties.base_price` is the number search FILTERS on and the card shows
 * as "from $X". It is not a fact about a property — it is a fact about that
 * property's rate plans, and `recomputeBasePrice` is the only thing allowed to
 * write it (rule #138).
 *
 * Registration approval used to write it by hand anyway, from the price the
 * applicant typed, while the same transaction created a cheaper plan
 * underneath it. Every screen agreed with every other screen; only the world
 * disagreed. A path test would not have caught it, because the path nobody
 * remembered had no test.
 *
 * So this file asks the other question. After each mutation that can move the
 * derivation, it scans EVERY property and asks whether any row is wrong.
 * ========================================================================== */

const strong = "correct horse battery staple"

const PROPERTY = {
  name: "Aurora House",
  city: "New York",
  country: "USA",
  timezone: "America/New_York",
}

const PLAN = {
  name: "Flexible",
  basePrice: 72_500,
  cancelFreeUntil: "48h",
  cancelCharge: "percent",
  cancelChargeValue: 50,
}

const ROOM = { name: "Garden Suite", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, units: 4 }

describe("invariants — the derived from-price", () => {
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

  const server = () => app.getHttpServer()
  let n = 0
  const freshIp = () => `203.0.113.${++n % 250}`

  /** Nothing anywhere has drifted. The message names the row when it has. */
  const expectConsistent = async () => {
    expect(await basePriceDrift(db)).toEqual([])
  }

  const stored = async (propertyId: string) => {
    const [row] = await db
      .select({ basePrice: properties.basePrice })
      .from(properties)
      .where(eq(properties.id, propertyId))
    return row!.basePrice
  }

  async function partnerAdmin() {
    const email = `inv${++n}@partner.test`
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "Dana", lastName: "Okafor" })
      .expect(201)
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)

    const [org] = await db
      .insert(partnerOrgs)
      .values({ name: "Aurora Hospitality", status: "active", commissionRateBps: 1500 })
      .returning()
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, res.body.user.id))
    await db
      .insert(partnerMembers)
      .values({ orgId: org!.id, userId: res.body.user.id, role: "admin", status: "active" })

    return res.headers["set-cookie"] as unknown as string[]
  }

  const createProperty = (cookie: string[]) =>
    request(server()).post("/api/v1/partner/listings").set("Cookie", cookie).send(PROPERTY)

  const createRoom = (cookie: string[], propertyId: string) =>
    request(server())
      .post(`/api/v1/partner/properties/${propertyId}/rooms`)
      .set("Cookie", cookie)
      .send(ROOM)

  const createPlan = (cookie: string[], roomId: string, body: Record<string, unknown> = {}) =>
    request(server())
      .post(`/api/v1/partner/rooms/${roomId}/rate-plans`)
      .set("Cookie", cookie)
      .send({ ...PLAN, ...body })

  const patchPlan = (cookie: string[], planId: string, body: Record<string, unknown>) =>
    request(server()).patch(`/api/v1/partner/rate-plans/${planId}`).set("Cookie", cookie).send(body)

  const patchRoom = (cookie: string[], roomId: string, body: Record<string, unknown>) =>
    request(server()).patch(`/api/v1/partner/rooms/${roomId}`).set("Cookie", cookie).send(body)

  beforeEach(async () => {
    await resetDb(db)
  })

  it("a new listing has no price to advertise, and says so", async () => {
    const cookie = await partnerAdmin()
    const property = await createProperty(cookie).expect(201)

    /*
     * Zero, not the number a partner typed — `NewProperty` does not have a
     * `basePrice` field at all, so there is nothing to type. A listing with no
     * rate plans genuinely has no price, and search reads exactly that.
     */
    expect(await stored(property.body.id)).toBe(0)
    await expectConsistent()
  })

  it("follows the cheapest plan as plans arrive", async () => {
    const cookie = await partnerAdmin()
    const property = await createProperty(cookie).expect(201)
    const room = await createRoom(cookie, property.body.id).expect(201)

    await createPlan(cookie, room.body.id, { isDefault: true }).expect(201)
    expect(await stored(property.body.id)).toBe(72_500)
    await expectConsistent()

    // The one that matters: a cheaper plan added later must pull it down, or
    // the listing sits above a band it can honour and never appears in it.
    await createPlan(cookie, room.body.id, { name: "Non-refundable", basePrice: 61_625 }).expect(201)
    expect(await stored(property.body.id)).toBe(61_625)
    await expectConsistent()
  })

  it("follows a repricing in both directions", async () => {
    const cookie = await partnerAdmin()
    const property = await createProperty(cookie).expect(201)
    const room = await createRoom(cookie, property.body.id).expect(201)
    await createPlan(cookie, room.body.id, { isDefault: true }).expect(201)
    const cheap = await createPlan(cookie, room.body.id, {
      name: "Non-refundable",
      basePrice: 61_625,
    }).expect(201)

    await patchPlan(cookie, cheap.body.id, { basePrice: 40_000 }).expect(200)
    expect(await stored(property.body.id)).toBe(40_000)
    await expectConsistent()

    // Raising the cheapest one above its neighbour hands the floor over.
    await patchPlan(cookie, cheap.body.id, { basePrice: 90_000 }).expect(200)
    expect(await stored(property.body.id)).toBe(72_500)
    await expectConsistent()
  })

  it("stops counting a room nobody can book", async () => {
    const cookie = await partnerAdmin()
    const property = await createProperty(cookie).expect(201)

    const cheapRoom = await createRoom(cookie, property.body.id).expect(201)
    await createPlan(cookie, cheapRoom.body.id, { isDefault: true, basePrice: 30_000 }).expect(201)

    const room = await createRoom(cookie, property.body.id).expect(201)
    await createPlan(cookie, room.body.id, { isDefault: true }).expect(201)

    expect(await stored(property.body.id)).toBe(30_000)

    // Archiving retires the room's plans with it, so the floor moves up. A
    // live price on a room nobody can book is one the search still reads.
    await patchRoom(cookie, cheapRoom.body.id, { status: "archived" }).expect(200)
    expect(await stored(property.body.id)).toBe(72_500)
    await expectConsistent()

    await patchRoom(cookie, room.body.id, { status: "archived" }).expect(200)
    expect(await stored(property.body.id)).toBe(0)
    await expectConsistent()
  })

  it("survives a change that should move nothing", async () => {
    const cookie = await partnerAdmin()
    const property = await createProperty(cookie).expect(201)
    const room = await createRoom(cookie, property.body.id).expect(201)
    await createPlan(cookie, room.body.id, { isDefault: true }).expect(201)

    // Units recompute too. This asserts the recompute does not CORRUPT what it
    // touches — a derivation that fires more often than it needs to is fine,
    // one that returns a different answer each time is not.
    await patchRoom(cookie, room.body.id, { units: 9 }).expect(200)
    expect(await stored(property.body.id)).toBe(72_500)
    await expectConsistent()
  })

  /**
   * What the headline price is NOT (rule #139).
   *
   * A single-occupancy discount prices a lone traveller below the base
   * occupancy, so a real booking can cost less than the advertised "from".
   * That is a decision, not an oversight: search takes neither dates nor guest
   * count, so a number true only for one party size would be advertising a
   * price nothing can be matched against.
   *
   * Pinned here because the alternative reading is reasonable, and a
   * reasonable alternative reading is exactly what gets implemented by
   * accident six months later.
   */
  it("does not follow an occupancy discount below the advertised rate", async () => {
    const cookie = await partnerAdmin()
    const property = await createProperty(cookie).expect(201)
    const room = await createRoom(cookie, property.body.id).expect(201)
    const plan = await createPlan(cookie, room.body.id, { isDefault: true }).expect(201)

    expect(await stored(property.body.id)).toBe(72_500)

    // Two adults is the base; one adult pays less.
    await request(server())
      .put(`/api/v1/partner/rate-plans/${plan.body.id}/occupancy-prices`)
      .set("Cookie", cookie)
      .send({
        baseOccupancy: 2,
        prices: [
          { guests: 1, price: 55_000 },
          { guests: 2, price: 72_500 },
        ],
      })
      .expect(200)

    expect(await stored(property.body.id)).toBe(72_500)
    await expectConsistent()
  })

  it("holds across every property at once, not just the one under test", async () => {
    const cookie = await partnerAdmin()

    for (const price of [30_000, 72_500, 125_000]) {
      const property = await createProperty(cookie).expect(201)
      const room = await createRoom(cookie, property.body.id).expect(201)
      await createPlan(cookie, room.body.id, { isDefault: true, basePrice: price }).expect(201)
    }

    /*
     * The scan, over the whole table.
     *
     * This is the part that outlives the endpoints listed above: a path added
     * next year fails here without anyone thinking to add a case, as long as
     * something exercises it.
     */
    await expectConsistent()
  })
})
