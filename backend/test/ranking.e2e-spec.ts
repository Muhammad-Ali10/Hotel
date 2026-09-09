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
import { RankingService } from "../src/modules/analytics/ranking.service"
import {
  partnerMembers,
  partnerOrgs,
  properties,
  ratePlans,
  reviews,
  rooms,
  searchEvents,
  searchImpressions,
  users,
} from "../src/db/schema"

const strong = "correct horse battery staple"

/** Every category the table insists on. */
const CATEGORIES = { cleanliness: 5, comfort: 5, location: 5, facilities: 5, staff: 5 }

const iso = (offset: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

describe("search ranking (rule #104)", () => {
  let app: NestExpressApplication
  let db: Database
  let ranking: RankingService

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
    ranking = moduleRef.get(RankingService)
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
  const freshIp = () => `198.51.100.${++n % 250}`

  async function property(input: {
    slug: string
    name: string
    price: number
    orgId: string
    description?: string
  }) {
    const [row] = await db
      .insert(properties)
      .values({
        slug: input.slug,
        name: input.name,
        city: "New York",
        country: "USA",
        timezone: "America/New_York",
        status: "active",
        basePrice: input.price,
        description: input.description ?? "",
        partnerOrgId: input.orgId,
      })
      .returning()

    const [room] = await db
      .insert(rooms)
      .values({
        propertyId: row!.id,
        name: "Deluxe King Room",
        maxAdults: 2,
        maxChildren: 1,
        maxOccupancy: 2,
        units: 5,
        status: "active",
      })
      .returning()

    await db.insert(ratePlans).values({
      roomId: room!.id,
      name: "Flexible",
      basePrice: input.price,
      cancelFreeUntil: "48h",
      cancelCharge: "percent",
      cancelChargeValue: 50,
      isDefault: true,
      status: "active",
    })

    return row!
  }

  async function seed() {
    const [org] = await db
      .insert(partnerOrgs)
      .values({ name: "Aurora", status: "active" })
      .returning()
    const [rival] = await db
      .insert(partnerOrgs)
      .values({ name: "Rival Group", status: "active" })
      .returning()

    const strong_ = await property({
      slug: "the-plaza",
      name: "The Plaza",
      price: 50_000,
      orgId: org!.id,
      description: "x".repeat(500),
    })
    const weak = await property({
      slug: "thin-listing",
      name: "Thin Listing",
      price: 50_000,
      orgId: org!.id,
      description: "",
    })
    const other = await property({
      slug: "rival-hotel",
      name: "Rival Hotel",
      price: 50_000,
      orgId: rival!.id,
    })

    return { org: org!, rival: rival!, strong: strong_, weak, other }
  }

  async function partner(role: "admin" | "manager" | "staff", orgId = fx.org.id) {
    const email = `p${++n}@partner.test`
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "Amelia", lastName: "Hart" })
      .expect(201)
    const first = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)

    await db
      .update(users)
      .set({ role: "partner" })
      .where(eq(users.id, first.body.user.id))
    await db.insert(partnerMembers).values({
      orgId,
      userId: first.body.user.id,
      role,
      status: "active",
      propertyIds: [],
    })

    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    return res.headers["set-cookie"] as unknown as string[]
  }

  async function admin() {
    const email = `root${++n}@stayora.test`
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "Root", lastName: "User" })
      .expect(201)
    const first = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    await db.update(users).set({ role: "admin", platformRole: "super_admin" }).where(eq(users.id, first.body.user.id))
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    return res.headers["set-cookie"] as unknown as string[]
  }

  /**
   * Impressions and clicks, straight into the table the search writes.
   *
   * One search event per impression, because the primary key is
   * `(search_event_id, property_id)` — a property appears at most once in one
   * search, which is exactly right and is what the first version of this
   * helper got wrong.
   */
  async function impressions(propertyId: string, shown: number, clicked: number) {
    const events = await db
      .insert(searchEvents)
      .values(
        Array.from({ length: shown }, () => ({ destination: "new york", resultCount: 1 }))
      )
      .returning({ id: searchEvents.id })

    await db.insert(searchImpressions).values(
      events.map((event, i) => ({
        searchEventId: event.id,
        propertyId,
        position: 1,
        clickedAt: i < clicked ? new Date().toISOString() : null,
      }))
    )
  }

  const scoreOf = async (id: string) => {
    const [row] = await db.select().from(properties).where(eq(properties.id, id))
    return row!.rankingScore
  }

  /* =============================================================== the job == */

  it("starts every listing unranked, and the job fills them in", async () => {
    expect(await scoreOf(fx.strong.id)).toBe(0)

    const result = await ranking.refreshAll()
    expect(result.ranked).toBe(3)
    expect(await scoreOf(fx.strong.id)).toBeGreaterThan(0)
  })

  it("ranks a well-built listing above a thin one", async () => {
    await ranking.refreshAll()

    // Same price, same city, same everything except the page itself.
    expect(await scoreOf(fx.strong.id)).toBeGreaterThan(await scoreOf(fx.weak.id))
  })

  it("rewards a listing people actually click", async () => {
    await impressions(fx.strong.id, 400, 80)
    await impressions(fx.weak.id, 400, 2)
    await ranking.refreshAll()

    expect(await scoreOf(fx.strong.id)).toBeGreaterThan(await scoreOf(fx.weak.id))
  })

  it("does not let a lucky handful of clicks beat a proven listing", async () => {
    // 2 of 3 is 67%; 80 of 400 is 20%. Unsmoothed, the noise would win.
    await impressions(fx.weak.id, 3, 2)
    await impressions(fx.strong.id, 400, 80)
    await ranking.refreshAll()

    expect(await scoreOf(fx.strong.id)).toBeGreaterThan(await scoreOf(fx.weak.id))
  })

  it("does not let one glowing review beat many good ones", async () => {
    await db.insert(reviews).values({
      propertyId: fx.weak.id,
      rating: 5,
      categories: CATEGORIES,
      title: "Perfect",
      body: "Everything was flawless from start to finish.",
      status: "published",
      date: "2026-01-01",
      author: "Amelia Hart",
    })
    for (let i = 0; i < 60; i += 1) {
      await db.insert(reviews).values({
        propertyId: fx.strong.id,
        rating: 5,
        categories: CATEGORIES,
        title: "Wonderful",
        body: "A very good stay indeed, we would happily come back again.",
        status: "published",
        date: "2026-01-01",
        author: `Guest ${i}`,
      })
    }
    await ranking.refreshAll()

    expect(await scoreOf(fx.strong.id)).toBeGreaterThan(await scoreOf(fx.weak.id))
  })

  it("ignores a review the platform has not published (rule #40)", async () => {
    await db.insert(reviews).values({
      propertyId: fx.weak.id,
      rating: 5,
      categories: CATEGORIES,
      title: "Suspicious",
      body: "This review is waiting for moderation and must not move anything.",
      status: "pending",
      date: "2026-01-01",
      author: "Amelia Hart",
    })
    await ranking.refreshAll()
    const withPending = await scoreOf(fx.weak.id)

    await db.update(reviews).set({ status: "published" }).where(eq(reviews.propertyId, fx.weak.id))
    await ranking.refreshAll()

    expect(await scoreOf(fx.weak.id)).toBeGreaterThan(withPending)
  })

  /* ============================================================== the sort == */

  it("orders search by the ranking, and that is now the default", async () => {
    await impressions(fx.strong.id, 400, 120)
    await ranking.refreshAll()

    const res = await request(server()).get("/api/v1/properties").expect(200)
    const ids = res.body.items.map((i: { id: string }) => i.id)

    /*
     * `recommended` used to fall back to `price_asc` — a marketplace whose
     * default order was "cheapest" while the label said something else.
     */
    expect(ids[0]).toBe(fx.strong.id)
    expect(ids.indexOf(fx.strong.id)).toBeLessThan(ids.indexOf(fx.weak.id))
  })

  it("still sorts by price when asked to", async () => {
    await db
      .update(properties)
      .set({ basePrice: 10_000 })
      .where(eq(properties.id, fx.weak.id))
    await ranking.refreshAll()

    const res = await request(server())
      .get("/api/v1/properties")
      .query({ sort: "price_asc" })
      .expect(200)
    expect(res.body.items[0].id).toBe(fx.weak.id)
  })

  it("pages the recommended sort without repeating or skipping a listing", async () => {
    await ranking.refreshAll()

    const first = await request(server())
      .get("/api/v1/properties")
      .query({ limit: 2 })
      .expect(200)
    expect(first.body.items).toHaveLength(2)
    expect(first.body.nextCursor).toBeTruthy()

    const second = await request(server())
      .get("/api/v1/properties")
      .query({ limit: 2, cursor: first.body.nextCursor })
      .expect(200)

    const seen = [...first.body.items, ...second.body.items].map((i: { id: string }) => i.id)
    // Three properties, two pages, each seen exactly once.
    expect(seen).toHaveLength(3)
    expect(new Set(seen).size).toBe(3)
  })

  it("never puts a suspended listing back into search", async () => {
    await ranking.refreshAll()
    await db
      .update(properties)
      .set({ status: "suspended" })
      .where(eq(properties.id, fx.strong.id))

    const res = await request(server()).get("/api/v1/properties").expect(200)
    expect(res.body.items.map((i: { id: string }) => i.id)).not.toContain(fx.strong.id)
  })

  /* ========================================================== the screen == */

  it("shows a partner where they rank and why", async () => {
    await impressions(fx.strong.id, 400, 80)
    await ranking.refreshAll()
    const cookie = await partner("admin")

    const res = await request(server())
      .get(`/api/v1/partner/analytics/ranking/${fx.strong.id}`)
      .set("Cookie", cookie)
      .expect(200)

    expect(res.body).toMatchObject({ propertyId: fx.strong.id, city: "New York" })
    // "3rd of 24 in New York" is the only form of this a partner can act on.
    expect(res.body.position).toBeGreaterThanOrEqual(1)
    expect(res.body.total).toBe(3)

    expect(res.body.factors).toHaveLength(5)
    for (const f of res.body.factors) {
      expect(f.detail.length).toBeGreaterThan(10)
      expect(f.weight).toBeGreaterThan(0)
    }
    // And the one worth fixing, weighted.
    expect(res.body.weakest).toBeTruthy()
  })

  it("will not show another organisation's ranking - 404, not 403", async () => {
    await ranking.refreshAll()
    const cookie = await partner("admin")

    await request(server())
      .get(`/api/v1/partner/analytics/ranking/${fx.other.id}`)
      .set("Cookie", cookie)
      .expect(404)
  })

  it("needs a session", async () => {
    await request(server())
      .get(`/api/v1/partner/analytics/ranking/${fx.strong.id}`)
      .expect(401)
  })

  /* ============================================================== demand == */

  it("shows what travellers searched for, including what came back empty", async () => {
    await db.insert(searchEvents).values([
      { destination: "new york", resultCount: 12 },
      { destination: "new york", resultCount: 12 },
      { destination: "reykjavik", resultCount: 0 },
    ])

    const root = await admin()
    const res = await request(server())
      .get("/api/v1/admin/analytics/demand")
      .set("Cookie", root)
      .query({ from: iso(-30), to: iso(1), limit: 10 })
      .expect(200)

    const ny = res.body.destinations.find((d: { destination: string }) => d.destination === "new york")
    expect(ny).toMatchObject({ searches: 2, emptyResults: 0 })

    /*
     * The zero-result rows are the point of this screen. A destination people
     * keep asking for and nobody serves is the clearest signal a marketplace
     * gets — and it is invisible in booking data.
     */
    const rk = res.body.destinations.find(
      (d: { destination: string }) => d.destination === "reykjavik"
    )
    expect(rk).toMatchObject({ searches: 1, emptyResults: 1 })
    expect(res.body.trend.length).toBeGreaterThan(0)
  })

  it("shows a partner only the cities they actually sell in", async () => {
    await db.insert(searchEvents).values([
      { destination: "new york", resultCount: 3 },
      { destination: "tokyo", resultCount: 9 },
    ])
    const cookie = await partner("admin")

    const res = await request(server())
      .get("/api/v1/partner/analytics/demand")
      .set("Cookie", cookie)
      .query({ from: iso(-30), to: iso(1) })
      .expect(200)

    // The whole market's demand map is the platform's own asset.
    expect(res.body.cities).toEqual(["New York"])
    expect(
      res.body.destinations.some((d: { destination: string }) => d.destination === "tokyo")
    ).toBe(false)
  })

  it("keeps the demand map closed to partners", async () => {
    const cookie = await partner("admin")
    await request(server())
      .get("/api/v1/admin/analytics/demand")
      .set("Cookie", cookie)
      .query({ from: iso(-30), to: iso(1) })
      .expect(403)
  })
})
