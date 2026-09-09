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
  notificationOutbox,
  partnerOrgs,
  promotionProperties,
  promotionRooms,
  promotions,
  properties,
  ratePlanRates,
  ratePlans,
  rooms,
  users,
  valueAdds,
} from "../src/db/schema"
import { QuoteTokenService } from "../src/modules/pricing/quote-token.service"

const strong = "correct horse battery staple"
const iso = (offsetDays: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

describe("pricing", () => {
  let app: NestExpressApplication
  let db: Database
  let tokens: QuoteTokenService

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
    tokens = moduleRef.get(QuoteTokenService)
  })

  afterAll(async () => {
    await cleanup()
    await app?.close()
  })

  const cleanup = () => resetDb(db)

  const server = () => app.getHttpServer()
  let ipCounter = 0
  const freshIp = () => `198.18.0.${++ipCounter % 250}`

  type Fixture = Awaited<ReturnType<typeof seed>>
  let fx: Fixture

  async function seed() {
    const [ritz] = await db
      .insert(properties)
      .values({
        slug: "the-ritz-carlton",
        name: "The Ritz-Carlton",
        city: "New York",
        country: "USA",
        timezone: "America/New_York",
        checkInTime: "15:00",
        status: "active",
        basePrice: 72_500,
      })
      .returning()

    const [deluxe] = await db
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

    const [flexible] = await db
      .insert(ratePlans)
      .values({
        roomId: deluxe!.id,
        name: "Flexible",
        basePrice: 72_500,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        isDefault: true,
      })
      .returning()

    const [transfer] = await db
      .insert(valueAdds)
      .values({ propertyId: ritz!.id, name: "Airport transfer", price: 6_500, unit: "per_stay" })
      .returning()

    const [breakfast] = await db
      .insert(valueAdds)
      .values({
        propertyId: ritz!.id,
        name: "Daily breakfast",
        price: 3_200,
        unit: "per_person_per_night",
      })
      .returning()

    return { ritz: ritz!, deluxe: deluxe!, flexible: flexible!, transfer: transfer!, breakfast: breakfast! }
  }

  async function addPromotion(over: {
    name: string
    discountType?: "percent" | "amount" | "free_night"
    discountValue?: number
    channel?: "all" | "mobile" | "genius"
    status?: "draft" | "scheduled" | "active" | "paused" | "ended"
    minStay?: number | null
    roomIds?: string[]
  }) {
    const [promo] = await db
      .insert(promotions)
      .values({
        name: over.name,
        discountType: over.discountType ?? "percent",
        discountValue: over.discountValue ?? 10,
        startDate: iso(-30),
        endDate: iso(365),
        channel: over.channel ?? "all",
        status: over.status ?? "active",
        minStay: over.minStay ?? null,
      })
      .returning()
    await db.insert(promotionProperties).values({ promotionId: promo!.id, propertyId: fx.ritz.id })
    if (over.roomIds?.length) {
      await db
        .insert(promotionRooms)
        .values(over.roomIds.map((roomId) => ({ promotionId: promo!.id, roomId })))
    }
    return promo!
  }

  const quote = (body: Record<string, unknown> = {}, cookie?: string[]) => {
    const req = request(server())
      .post("/api/v1/properties/the-ritz-carlton/quote")
      .set("x-forwarded-for", freshIp())
    if (cookie) req.set("Cookie", cookie)
    return req.send({
      roomId: fx.deluxe.id,
      ratePlanId: fx.flexible.id,
      checkIn: iso(10),
      checkOut: iso(13),
      adults: 2,
      children: 0,
      ...body,
    })
  }

  async function geniusSession() {
    const email = `g${ipCounter}@example.com`
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "G", lastName: "M" })
      .expect(201)

    // Signup no longer hands back a session (rule #58).
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    await db.update(users).set({ tier: "genius" }).where(eq(users.id, res.body.user.id))
    return res.headers["set-cookie"] as unknown as string[]
  }

  beforeEach(async () => {
    await cleanup()
    fx = await seed()
  })

  /* ---------------------------------------------------------------- price */

  it("prices the reference stay with no tax layer (rule #11)", async () => {
    const res = await quote().expect(201)

    expect(res.body.pricing).toMatchObject({
      nights: 3,
      nightlyRates: [72_500, 72_500, 72_500],
      roomSubtotal: 217_500,
      addOnsTotal: 0,
      total: 217_500,
    })
    // No taxes, no subtotal — they no longer exist.
    expect(res.body.pricing.taxes).toBeUndefined()
    expect(res.body.pricing.taxTotal).toBeUndefined()
  })

  it("prices add-ons by their unit and qty (rules #10, #23)", async () => {
    const res = await quote({
      addOns: [
        { valueAddId: fx.transfer.id, qty: 1 },
        { valueAddId: fx.breakfast.id, qty: 1 },
      ],
    }).expect(201)

    const amounts = Object.fromEntries(
      res.body.addOns.map((a: { name: string; amount: number }) => [a.name, a.amount])
    )
    expect(amounts["Airport transfer"]).toBe(6_500)
    // 3 nights x 2 guests x $32 — the prototype charged this ONCE.
    expect(amounts["Daily breakfast"]).toBe(19_200)
    expect(res.body.pricing.total).toBe(243_200) // $2,432
  })

  it("multiplies qty AFTER the unit resolves", async () => {
    const res = await quote({ addOns: [{ valueAddId: fx.transfer.id, qty: 3 }] }).expect(201)
    expect(res.body.addOns[0].amount).toBe(19_500)
  })

  it("refuses an extra that belongs to no one", async () => {
    // Silently dropping it would charge a total the guest never agreed to.
    await quote({ addOns: [{ valueAddId: fx.ritz.id, qty: 1 }] }).expect(400)
  })

  it("uses per-date rates, not an average", async () => {
    await db.insert(ratePlanRates).values({
      ratePlanId: fx.flexible.id,
      date: iso(11),
      rate: 140_000,
    })
    const res = await quote().expect(201)
    expect(res.body.pricing.nightlyRates).toEqual([72_500, 140_000, 72_500])
    expect(res.body.pricing.roomSubtotal).toBe(285_000)
  })

  it("never accepts a total from the client", async () => {
    // `.strict()` means an unexpected key is a 400, not a silently ignored one.
    await quote({ total: 1, pricing: { total: 1 } }).expect(400)
  })

  /* ----------------------------------------------------------- promotions */

  it("applies an `all` promotion", async () => {
    await addPromotion({ name: "Early Bird", discountValue: 20 })
    const res = await quote().expect(201)

    expect(res.body.promotion).toMatchObject({ name: "Early Bird", saving: 43_500 })
    expect(res.body.pricing.discount).toMatchObject({ label: "20% OFF", amount: -43_500 })
    expect(res.body.pricing.total).toBe(174_000)
  })

  it("reaches a Genius member and nobody else (rule #3)", async () => {
    await addPromotion({ name: "Genius Level 2", discountValue: 15, channel: "genius" })

    // The exact fixture that sat live on the Ritz and reached no one.
    const anonymous = await quote().expect(201)
    expect(anonymous.body.promotion).toBeNull()
    expect(anonymous.body.pricing.total).toBe(217_500)

    const member = await quote({}, await geniusSession()).expect(201)
    expect(member.body.promotion?.name).toBe("Genius Level 2")
    expect(member.body.pricing.total).toBe(184_875) // 217500 - 32625
  })

  it("reaches a mobile caller by user agent (rule #35)", async () => {
    await addPromotion({ name: "Mobile-Only Rate", discountValue: 25, channel: "mobile" })

    const desktop = await quote().expect(201)
    expect(desktop.body.promotion).toBeNull()

    const mobile = await request(server())
      .post("/api/v1/properties/the-ritz-carlton/quote")
      .set("x-forwarded-for", freshIp())
      .set("user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")
      .send({
        roomId: fx.deluxe.id,
        ratePlanId: fx.flexible.id,
        checkIn: iso(10),
        checkOut: iso(13),
      })
      .expect(201)
    expect(mobile.body.promotion?.name).toBe("Mobile-Only Rate")
  })

  it("ignores paused and draft promotions", async () => {
    await addPromotion({ name: "Last Minute", discountValue: 35, status: "paused" })
    await addPromotion({ name: "Loyalty", discountValue: 10, status: "draft" })
    const res = await quote().expect(201)
    expect(res.body.promotion).toBeNull()
  })

  it("honours a promotion's own minimum stay (rule #22)", async () => {
    await addPromotion({ name: "Stay Longer", discountValue: 20, minStay: 5 })

    expect((await quote().expect(201)).body.promotion).toBeNull()
    const longer = await quote({ checkOut: iso(16) }).expect(201)
    expect(longer.body.promotion?.name).toBe("Stay Longer")
  })

  it("honours room targeting (rule #21)", async () => {
    // Targeted at a different room, so this one gets nothing — which free text
    // could never enforce.
    const [other] = await db
      .insert(rooms)
      .values({ propertyId: fx.ritz.id, name: "Standard", maxAdults: 2, maxOccupancy: 2, units: 5 })
      .returning()
    await addPromotion({ name: "Standard Only", discountValue: 30, roomIds: [other!.id] })

    expect((await quote().expect(201)).body.promotion).toBeNull()
  })

  it("picks the offer that saves the most, not the biggest headline (rule #4)", async () => {
    await addPromotion({ name: "Five Percent", discountValue: 5 }) // $108.75
    await addPromotion({ name: "Flat 500", discountType: "amount", discountValue: 50_000 }) // $500

    const res = await quote().expect(201)
    expect(res.body.promotion?.name).toBe("Flat 500")
    expect(res.body.promotion?.saving).toBe(50_000)
  })

  it("gives away the cheapest night on a free-night offer (rule #19)", async () => {
    await db.insert(ratePlanRates).values([
      { ratePlanId: fx.flexible.id, date: iso(10), rate: 40_000 },
      { ratePlanId: fx.flexible.id, date: iso(11), rate: 90_000 },
      { ratePlanId: fx.flexible.id, date: iso(12), rate: 40_000 },
    ])
    await addPromotion({ name: "3rd Night Free", discountType: "free_night", discountValue: 3 })

    const res = await quote().expect(201)
    // The cheapest night, not the average and not the dearest.
    expect(res.body.promotion?.saving).toBe(40_000)
    expect(res.body.pricing.total).toBe(130_000)
  })

  /* --------------------------------------------------------- quote token */

  it("issues a signed token that carries the price", async () => {
    const res = await quote().expect(201)
    expect(res.body.quoteToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)

    const payload = tokens.verify(res.body.quoteToken)
    expect(payload.pricing.total).toBe(217_500)
    expect(payload.roomId).toBe(fx.deluxe.id)
  })

  it("rejects a tampered token", async () => {
    const res = await quote().expect(201)
    const [body] = (res.body.quoteToken as string).split(".")

    // Re-sign a doubled price with a guessed key — the signature will not match.
    const forged = `${body}.aGFja2VkLXNpZ25hdHVyZQ`
    expect(() => tokens.verify(forged)).toThrow()
  })

  it("rejects an edited payload even with the original signature", async () => {
    const res = await quote().expect(201)
    const [, signature] = (res.body.quoteToken as string).split(".")
    const cheap = Buffer.from(JSON.stringify({ pricing: { total: 1 } }), "utf8").toString("base64url")
    expect(() => tokens.verify(`${cheap}.${signature}`)).toThrow()
  })

  it("expires after 15 minutes with a code the client can act on", async () => {
    const res = await quote().expect(201)
    const later = new Date(Date.now() + 16 * 60_000)
    expect(() => tokens.verify(res.body.quoteToken, later)).toThrow(/expired/i)
  })

  it("refuses a token that describes a different booking", async () => {
    const res = await quote().expect(201)
    const payload = tokens.verify(res.body.quoteToken)

    expect(() =>
      tokens.assertMatches(payload, {
        roomId: fx.deluxe.id,
        ratePlanId: fx.flexible.id,
        checkIn: iso(10),
        // A cheap quote presented against a longer, dearer stay.
        checkOut: iso(20),
        occupancy: { adults: 2, children: 0 },
      })
    ).toThrow()
  })

  /* -------------------------------------------------------------- guards */

  it("refuses to quote a stay it cannot sell", async () => {
    await db.insert(ratePlanRates).values({
      ratePlanId: fx.flexible.id,
      date: iso(10),
      minStay: 7,
    })
    const res = await quote()
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/minimum stay/i)
  })

  it("refuses a room and plan that do not belong together", async () => {
    const [other] = await db
      .insert(properties)
      .values({ slug: "other", name: "Other", city: "X", country: "Y", status: "active" })
      .returning()
    const [otherRoom] = await db
      .insert(rooms)
      .values({ propertyId: other!.id, name: "R", maxAdults: 2, maxOccupancy: 2, units: 1 })
      .returning()

    // Another property's room against this property's plan.
    await quote({ roomId: otherRoom!.id }).expect(404)
  })

  it("rate-limits quotes to the expensive-read bucket (API4)", async () => {
    const ip = freshIp()
    const statuses: number[] = []
    for (let i = 0; i < 32; i++) {
      const res = await request(server())
        .post("/api/v1/properties/the-ritz-carlton/quote")
        .set("x-forwarded-for", ip)
        .send({
          roomId: fx.deluxe.id,
          ratePlanId: fx.flexible.id,
          checkIn: iso(10),
          checkOut: iso(13),
        })
      statuses.push(res.status)
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0)
  })
})
