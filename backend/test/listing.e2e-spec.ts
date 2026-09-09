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
import { amenities, partnerMembers, partnerOrgs, photos, properties, ratePlans, rooms, users } from "../src/db/schema"

const strong = "correct horse battery staple"

describe("listings — create, photos, review", () => {
  let app: NestExpressApplication
  let db: Database
  let n = 0

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
  const freshIp = () => `198.51.100.${++n % 250}`

  let orgId: string

  async function account(email: string) {
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
    return { cookie: res.headers["set-cookie"] as unknown as string[], id: res.body.user.id as string, email }
  }

  async function partner(role: "admin" | "manager" | "staff") {
    const g = await account(`p${++n}@aurora.test`)
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

  async function platformAdmin() {
    const g = await account(`root${++n}@stayora.test`)
    await db.update(users).set({ role: "admin", platformRole: "super_admin" }).where(eq(users.id, g.id))
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: g.email, password: strong })
      .expect(200)
    return res.headers["set-cookie"] as unknown as string[]
  }

  const create = (cookie: string[], over: Record<string, unknown> = {}) =>
    request(server())
      .post("/api/v1/partner/listings")
      .set("Cookie", cookie)
      .send({ name: "The Plaza", city: "New York", country: "USA", ...over })

  /** Everything rule #70 asks for, so `submit` has nothing left to complain about. */
  async function makeComplete(propertyId: string) {
    const [room] = await db
      .insert(rooms)
      .values({
        propertyId,
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
      basePrice: 50_000,
      cancelFreeUntil: "48h",
      cancelCharge: "percent",
      cancelChargeValue: 50,
      isDefault: true,
      status: "active",
    })

    await db.insert(photos).values(
      Array.from({ length: 5 }, (_, i) => ({
        propertyId,
        category: "exterior",
        caption: `Photo ${i}`,
        position: i,
        storageKey: `properties/${propertyId}/p${i}.jpg`,
        contentType: "image/jpeg",
        status: "pending",
      }))
    )

    await db
      .update(properties)
      .set({ description: "A grand hotel on the park. ".repeat(8) })
      .where(eq(properties.id, propertyId))
  }

  beforeEach(async () => {
    await resetDb(db)
    const [org] = await db
      .insert(partnerOrgs)
      .values({ name: "Aurora Hospitality", contactEmail: "hi@aurora.test", status: "active" })
      .returning()
    orgId = org!.id
    await db.insert(amenities).values([
      { slug: "wifi", label: "Free WiFi", category: "general", icon: "wifi" },
      { slug: "pool", label: "Pool", category: "leisure", icon: "waves" },
    ])
  })

  /* ================================================================ create */

  describe("creating a listing (rule #69)", () => {
    it("creates one, and it starts as a draft", async () => {
      const cookie = await partner("admin")
      const res = await create(cookie).expect(201)

      expect(res.body).toMatchObject({
        name: "The Plaza",
        city: "New York",
        status: "draft",
        slug: "the-plaza",
      })
    })

    /* A draft must not be findable by a guest — nothing has been checked yet. */
    it("keeps a draft out of the public search", async () => {
      const cookie = await partner("admin")
      await create(cookie).expect(201)

      const res = await request(server())
        .get("/api/v1/properties?city=New%20York")
        .expect(200)
      expect(res.body.items).toHaveLength(0)
    })

    it("makes the slug unique rather than failing on a duplicate name", async () => {
      const cookie = await partner("admin")
      const first = await create(cookie).expect(201)
      const second = await create(cookie).expect(201)

      expect(first.body.slug).toBe("the-plaza")
      expect(second.body.slug).toBe("the-plaza-2")
    })

    /*
     * A French hotel should not end up with a slug missing half its letters.
     */
    it("folds accents instead of dropping them", async () => {
      const cookie = await partner("admin")
      const res = await create(cookie, { name: "Hôtel Café Münster" }).expect(201)
      expect(res.body.slug).toBe("hotel-cafe-munster")
    })

    it("refuses a partner setting their own status (API3)", async () => {
      const cookie = await partner("admin")
      await create(cookie, { status: "active" }).expect(400)
    })

    it("refuses a partner naming another org", async () => {
      const cookie = await partner("admin")
      await create(cookie, { partnerOrgId: orgId }).expect(400)
    })

    it("refuses a partner setting the from-price no rate plan backs", async () => {
      const cookie = await partner("admin")
      await create(cookie, { basePrice: 1 }).expect(400)
    })

    it("lets a manager create, and refuses front-desk staff", async () => {
      await create(await partner("manager")).expect(201)
      await create(await partner("staff")).expect(403)
    })

    it("refuses a guest outright", async () => {
      const g = await account("guest@example.test")
      await create(g.cookie).expect(403)
    })
  })

  /* ================================================================ submit */

  describe("submitting for review (rule #70)", () => {
    it("refuses an empty listing and says everything that is missing", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)

      const res = await request(server())
        .post(`/api/v1/partner/listings/${created.body.id}/submit`)
        .set("Cookie", cookie)
        .expect(400)

      expect(res.body.code).toBe("listing_incomplete")
      // Every gap at once. Told one at a time, a partner gives up.
      expect(res.body.gaps.map((g: { code: string }) => g.code)).toEqual([
        "rooms",
        "rate_plans",
        "photos",
        "description",
      ])
    })

    it("accepts a complete listing", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await makeComplete(created.body.id)

      const res = await request(server())
        .post(`/api/v1/partner/listings/${created.body.id}/submit`)
        .set("Cookie", cookie)
        .expect(201)

      expect(res.body.status).toBe("pending_review")
    })

    it("shows the gaps on every read, not only when submitting", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)

      const res = await request(server())
        .get(`/api/v1/partner/listings/${created.body.id}`)
        .set("Cookie", cookie)
        .expect(200)

      expect(res.body.gaps).toHaveLength(4)
    })

    /*
     * A listing whose five photos were all turned down has not met the bar.
     * Counting them would let it back into the queue unchanged.
     */
    it("does not count rejected photos toward the minimum", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await makeComplete(created.body.id)
      await db
        .update(photos)
        .set({ status: "rejected" })
        .where(eq(photos.propertyId, created.body.id))

      const res = await request(server())
        .post(`/api/v1/partner/listings/${created.body.id}/submit`)
        .set("Cookie", cookie)
        .expect(400)

      expect(res.body.gaps.map((g: { code: string }) => g.code)).toEqual(["photos"])
    })

    it("refuses to submit a listing that is already live", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await db.update(properties).set({ status: "active" }).where(eq(properties.id, created.body.id))

      await request(server())
        .post(`/api/v1/partner/listings/${created.body.id}/submit`)
        .set("Cookie", cookie)
        .expect(409)
    })

    it("404s a listing in another org — never 403 (API1)", async () => {
      const cookie = await partner("admin")
      const [other] = await db
        .insert(partnerOrgs)
        .values({ name: "Rival", contactEmail: "r@rival.test" })
        .returning()
      const [rival] = await db
        .insert(properties)
        .values({
          slug: "rival-hotel",
          name: "Rival",
          city: "New York",
          country: "USA",
          partnerOrgId: other!.id,
        })
        .returning()

      await request(server())
        .get(`/api/v1/partner/listings/${rival!.id}`)
        .set("Cookie", cookie)
        .expect(404)
    })
  })

  /* ================================================================= edits */

  describe("editing a live listing (rules #71, #72)", () => {
    const goLive = async (cookie: string[]) => {
      const created = await create(cookie).expect(201)
      await makeComplete(created.body.id)
      await db
        .update(properties)
        .set({ status: "active" })
        .where(eq(properties.id, created.body.id))
      return created.body.id as string
    }

    /*
     * The whole point of rule #72. Moving the listing to `pending_review`
     * would drop it out of search — search filters `status = 'active'` — and
     * the guests would pay for a partner's typo fix.
     */
    it("keeps a live listing live and holds the change aside", async () => {
      const cookie = await partner("admin")
      const id = await goLive(cookie)

      const res = await request(server())
        .patch(`/api/v1/partner/listings/${id}`)
        .set("Cookie", cookie)
        .send({ name: "The Plaza Hotel" })
        .expect(200)

      expect(res.body.status).toBe("active")
      expect(res.body.pendingReview).toEqual(["name"])
      expect(res.body.pendingChanges).toEqual({ name: "The Plaza Hotel" })

      // The public still sees the approved name.
      const seen = await request(server()).get("/api/v1/properties/the-plaza").expect(200)
      expect(seen.body.name).toBe("The Plaza")
    })

    it("applies an ordinary edit immediately", async () => {
      const cookie = await partner("admin")
      const id = await goLive(cookie)

      const res = await request(server())
        .patch(`/api/v1/partner/listings/${id}`)
        .set("Cookie", cookie)
        .send({ checkInTime: "14:00" })
        .expect(200)

      expect(res.body.checkInTime).toBe("14:00")
      expect(res.body.pendingChanges).toBeNull()
    })

    /* Two edits before one review must both survive. */
    it("merges a second pending edit rather than replacing the first", async () => {
      const cookie = await partner("admin")
      const id = await goLive(cookie)

      await request(server())
        .patch(`/api/v1/partner/listings/${id}`)
        .set("Cookie", cookie)
        .send({ name: "The Plaza Hotel" })
        .expect(200)

      const res = await request(server())
        .patch(`/api/v1/partner/listings/${id}`)
        .set("Cookie", cookie)
        .send({ stars: 4 })
        .expect(200)

      expect(res.body.pendingChanges).toEqual({ name: "The Plaza Hotel", stars: 4 })
    })

    it("applies everything immediately while the listing is a draft", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)

      const res = await request(server())
        .patch(`/api/v1/partner/listings/${created.body.id}`)
        .set("Cookie", cookie)
        .send({ name: "Renamed" })
        .expect(200)

      expect(res.body.name).toBe("Renamed")
      expect(res.body.pendingChanges).toBeNull()
    })

    /*
     * A form that re-submits every field on every save must not send a
     * listing back to review for a change nobody made.
     */
    it("ignores a material field re-sent with the same value", async () => {
      const cookie = await partner("admin")
      const id = await goLive(cookie)

      const res = await request(server())
        .patch(`/api/v1/partner/listings/${id}`)
        .set("Cookie", cookie)
        .send({ name: "The Plaza", description: "Updated copy here." })
        .expect(200)

      expect(res.body.pendingChanges).toBeNull()
    })
  })

  /* ================================================================ review */

  describe("the platform's verdict (rules #71, #72)", () => {
    const submitted = async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await makeComplete(created.body.id)
      await request(server())
        .post(`/api/v1/partner/listings/${created.body.id}/submit`)
        .set("Cookie", cookie)
        .expect(201)
      return { id: created.body.id as string, cookie }
    }

    it("lists both kinds of work in one queue", async () => {
      const { id, cookie } = await submitted()
      const root = await platformAdmin()

      // A second, live listing with an edit waiting.
      const live = await create(cookie, { name: "The Carlyle" }).expect(201)
      await db.update(properties).set({ status: "active" }).where(eq(properties.id, live.body.id))
      await request(server())
        .patch(`/api/v1/partner/listings/${live.body.id}`)
        .set("Cookie", cookie)
        .send({ stars: 5 })
        .expect(200)

      const res = await request(server())
        .get("/api/v1/admin/listings/queue")
        .set("Cookie", root)
        .expect(200)

      const byId = Object.fromEntries(res.body.map((r: { id: string; kind: string }) => [r.id, r.kind]))
      expect(byId[id]).toBe("new")
      expect(byId[live.body.id]).toBe("changes")
    })

    it("approving puts a listing on the market and its photos with it", async () => {
      const { id } = await submitted()
      const root = await platformAdmin()

      const res = await request(server())
        .post(`/api/v1/admin/listings/${id}/decision`)
        .set("Cookie", root)
        .send({ decision: "approve" })
        .expect(201)

      expect(res.body.status).toBe("active")

      const rows = await db.select().from(photos).where(eq(photos.propertyId, id))
      expect(rows.every((r) => r.status === "approved")).toBe(true)

      const seen = await request(server()).get("/api/v1/properties?city=New%20York").expect(200)
      expect(seen.body.items).toHaveLength(1)
    })

    it("approving an edit merges it and clears the pending copy", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await makeComplete(created.body.id)
      await db
        .update(properties)
        .set({ status: "active" })
        .where(eq(properties.id, created.body.id))

      await request(server())
        .patch(`/api/v1/partner/listings/${created.body.id}`)
        .set("Cookie", cookie)
        .send({ name: "The Plaza Hotel" })
        .expect(200)

      const root = await platformAdmin()
      const res = await request(server())
        .post(`/api/v1/admin/listings/${created.body.id}/decision`)
        .set("Cookie", root)
        .send({ decision: "approve" })
        .expect(201)

      expect(res.body).toMatchObject({ name: "The Plaza Hotel", pendingChanges: null })
    })

    /*
     * A live listing sent back for changes STAYS live — the approved version
     * is still perfectly good, and pulling it would punish guests for a
     * partner's bad edit.
     */
    it("leaves a live listing on the market when its edit is rejected", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await makeComplete(created.body.id)
      await db
        .update(properties)
        .set({ status: "active" })
        .where(eq(properties.id, created.body.id))
      await request(server())
        .patch(`/api/v1/partner/listings/${created.body.id}`)
        .set("Cookie", cookie)
        .send({ name: "FREE ROOMS!!! CALL NOW" })
        .expect(200)

      const root = await platformAdmin()
      const res = await request(server())
        .post(`/api/v1/admin/listings/${created.body.id}/decision`)
        .set("Cookie", root)
        .send({ decision: "request_changes", note: "The name is not the hotel's name." })
        .expect(201)

      expect(res.body).toMatchObject({ status: "active", name: "The Plaza", pendingChanges: null })
    })

    it("sends a first-time listing back with the reason", async () => {
      const { id } = await submitted()
      const root = await platformAdmin()

      const res = await request(server())
        .post(`/api/v1/admin/listings/${id}/decision`)
        .set("Cookie", root)
        .send({ decision: "request_changes", note: "Photos are too dark to see the rooms." })
        .expect(201)

      expect(res.body.status).toBe("changes_requested")
    })

    /* "Rejected" with no reason is a support ticket, every time. */
    it("refuses a verdict that does not say why", async () => {
      const { id } = await submitted()
      const root = await platformAdmin()

      await request(server())
        .post(`/api/v1/admin/listings/${id}/decision`)
        .set("Cookie", root)
        .send({ decision: "request_changes" })
        .expect(400)
    })

    it("keeps the queue and the verdict away from partners", async () => {
      const { id, cookie } = await submitted()
      await request(server()).get("/api/v1/admin/listings/queue").set("Cookie", cookie).expect(403)
      await request(server())
        .post(`/api/v1/admin/listings/${id}/decision`)
        .set("Cookie", cookie)
        .send({ decision: "approve" })
        .expect(403)
    })
  })

  /* ================================================================ photos */

  describe("photos (rule #73)", () => {
    const draft = async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      return { id: created.body.id as string, cookie }
    }

    const askForUrl = (cookie: string[], id: string, body: Record<string, unknown> = {}) =>
      request(server())
        .post(`/api/v1/partner/listings/${id}/photos/upload-url`)
        .set("Cookie", cookie)
        .send({ contentType: "image/jpeg", bytes: 1_000_000, ...body })

    it("hands back a signed URL, and writes no row yet", async () => {
      const { id, cookie } = await draft()
      const res = await askForUrl(cookie, id).expect(201)

      expect(res.body.key).toMatch(new RegExp(`^properties/${id}/`))
      expect(res.body.url).toContain("signature=")
      expect(res.body.headers["Content-Type"]).toBe("image/jpeg")

      // An upload that dies halfway leaves nothing behind.
      const rows = await db.select().from(photos).where(eq(photos.propertyId, id))
      expect(rows).toHaveLength(0)
    })

    it("refuses a format that is not one of the three", async () => {
      const { id, cookie } = await draft()
      await askForUrl(cookie, id, { contentType: "image/gif" }).expect(400)
      await askForUrl(cookie, id, { contentType: "application/pdf" }).expect(400)
    })

    it("refuses a file over 5MB before any bytes move", async () => {
      const { id, cookie } = await draft()
      await askForUrl(cookie, id, { bytes: 6 * 1024 * 1024 }).expect(400)
    })

    it("accepts the bytes and records the photo as pending", async () => {
      const { id, cookie } = await draft()
      const url = await askForUrl(cookie, id).expect(201)

      // The browser's PUT, straight at the signed URL.
      const path = new URL(url.body.url).pathname + new URL(url.body.url).search
      await request(server())
        .put(path.replace("/api/v1", "/api/v1"))
        .set("Content-Type", "image/jpeg")
        .send(Buffer.from("not really a jpeg but bytes all the same"))
        .expect(204)

      const confirmed = await request(server())
        .post(`/api/v1/partner/listings/${id}/photos`)
        .set("Cookie", cookie)
        .send({ key: url.body.key, category: "rooms", caption: "The suite" })
        .expect(201)

      expect(confirmed.body).toMatchObject({ status: "pending", category: "rooms" })
      expect(confirmed.body.url).toContain(url.body.key)
    })

    /*
     * Without this a partner could confirm a key belonging to somebody else's
     * listing and attach their photo to it.
     */
    it("refuses a key that belongs to another property", async () => {
      const { id, cookie } = await draft()
      await request(server())
        .post(`/api/v1/partner/listings/${id}/photos`)
        .set("Cookie", cookie)
        .send({ key: "properties/00000000-0000-0000-0000-000000000000/x.jpg" })
        .expect(400)
    })

    it("refuses an upload URL that was tampered with", async () => {
      const { id, cookie } = await draft()
      const url = await askForUrl(cookie, id).expect(201)
      const target = new URL(url.body.url)
      target.searchParams.set("key", `properties/${id}/somebody-elses.jpg`)

      await request(server())
        .put(target.pathname + target.search)
        .set("Content-Type", "image/jpeg")
        .send(Buffer.from("bytes"))
        .expect(400)
    })

    it("refuses an upload URL whose expiry was pushed out", async () => {
      const { id, cookie } = await draft()
      const url = await askForUrl(cookie, id).expect(201)
      const target = new URL(url.body.url)
      target.searchParams.set("expires", String(Date.now() + 86_400_000))

      await request(server())
        .put(target.pathname + target.search)
        .set("Content-Type", "image/jpeg")
        .send(Buffer.from("bytes"))
        .expect(400)
    })

    it("keeps a pending photo out of the public listing", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await makeComplete(created.body.id)
      await db
        .update(properties)
        .set({ status: "active" })
        .where(eq(properties.id, created.body.id))

      const seen = await request(server()).get("/api/v1/properties/the-plaza").expect(200)
      expect(seen.body.photos).toHaveLength(0)
    })

    it("reorders and recaptions", async () => {
      const { id, cookie } = await draft()
      const url = await askForUrl(cookie, id).expect(201)
      const created = await request(server())
        .post(`/api/v1/partner/listings/${id}/photos`)
        .set("Cookie", cookie)
        .send({ key: url.body.key })
        .expect(201)

      const res = await request(server())
        .patch(`/api/v1/partner/listings/${id}/photos/${created.body.id}`)
        .set("Cookie", cookie)
        .send({ caption: "Lobby at dusk", position: 3 })
        .expect(200)

      expect(res.body).toMatchObject({ caption: "Lobby at dusk", position: 3 })
    })

    it("deletes a photo", async () => {
      const { id, cookie } = await draft()
      const url = await askForUrl(cookie, id).expect(201)
      const created = await request(server())
        .post(`/api/v1/partner/listings/${id}/photos`)
        .set("Cookie", cookie)
        .send({ key: url.body.key })
        .expect(201)

      await request(server())
        .delete(`/api/v1/partner/listings/${id}/photos/${created.body.id}`)
        .set("Cookie", cookie)
        .expect(200)

      const rows = await db.select().from(photos).where(eq(photos.propertyId, id))
      expect(rows).toHaveLength(0)
    })

    it("keeps front-desk staff away from the photography", async () => {
      const { id } = await draft()
      const staff = await partner("staff")
      await askForUrl(staff, id).expect(403)
    })

    /* A traversal is a 404, not a 400 — a different answer confirms it was understood. */
    it("refuses a key that tries to escape the storage root", async () => {
      await request(server()).get("/api/v1/files/../../../etc/passwd").expect(404)
    })
  })

  /* ============================================================= amenities */

  describe("the amenity vocabulary (rule #74)", () => {
    it("is readable by anybody, because the search filter is built from it", async () => {
      const res = await request(server()).get("/api/v1/amenities").expect(200)
      expect(res.body.map((a: { slug: string }) => a.slug).sort()).toEqual(["pool", "wifi"])
    })

    it("lets the platform add one", async () => {
      const root = await platformAdmin()
      await request(server())
        .post("/api/v1/admin/amenities")
        .set("Cookie", root)
        .send({ slug: "sauna", label: "Sauna", category: "leisure", icon: "flame" })
        .expect(201)

      const res = await request(server()).get("/api/v1/amenities").expect(200)
      expect(res.body.map((a: { slug: string }) => a.slug)).toContain("sauna")
    })

    it("re-adding a slug edits it rather than failing", async () => {
      const root = await platformAdmin()
      await request(server())
        .post("/api/v1/admin/amenities")
        .set("Cookie", root)
        .send({ slug: "wifi", label: "Wi-Fi (fast)" })
        .expect(201)

      const res = await request(server()).get("/api/v1/amenities").expect(200)
      const wifi = res.body.find((a: { slug: string }) => a.slug === "wifi")
      expect(wifi.label).toBe("Wi-Fi (fast)")
      expect(res.body).toHaveLength(2)
    })

    /*
     * The slug IS the filter key. "Free WiFi" beside "free-wifi" is how one
     * vocabulary silently becomes two, each finding half the catalogue.
     */
    it("refuses a slug that is not lower-case and hyphenated", async () => {
      const root = await platformAdmin()
      for (const slug of ["Free WiFi", "free_wifi", "FreeWifi", "free wifi", "-wifi"]) {
        await request(server())
          .post("/api/v1/admin/amenities")
          .set("Cookie", root)
          .send({ slug, label: "x" })
          .expect(400)
      }
    })

    it("keeps the vocabulary away from partners", async () => {
      const cookie = await partner("admin")
      await request(server())
        .post("/api/v1/admin/amenities")
        .set("Cookie", cookie)
        .send({ slug: "sauna", label: "Sauna" })
        .expect(403)
    })

    it("still refuses an amenity slug nobody defined", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await request(server())
        .patch(`/api/v1/partner/properties/${created.body.id}`)
        .set("Cookie", cookie)
        .send({ amenities: ["wifi", "helipad"] })
        .expect(400)
    })
  })

  /* ================================= the platform's property list == */

  describe("every listing on the platform", () => {
    const list = (cookie: string[], query: object = {}) =>
      request(server()).get("/api/v1/admin/listings").set("Cookie", cookie).query(query)

    it("lists them all with their owner, and counts what each has", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie, { name: "The Plaza" }).expect(201)
      await makeComplete(created.body.id)
      const root = await platformAdmin()

      const res = await list(root).expect(200)

      const row = res.body.items.find((i: { id: string }) => i.id === created.body.id)
      expect(row).toMatchObject({
        name: "The Plaza",
        status: "draft",
        orgId,
        rooms: 1,
        photos: 5,
        hasPendingChanges: false,
      })
      // The owner comes back on the row: nearly every question the platform
      // asks about a listing is really a question about who runs it.
      expect(row.orgName).toBeTruthy()
      expect(res.body.counts.draft).toBeGreaterThanOrEqual(1)
    })

    it("narrows by status, by organisation and by text", async () => {
      const cookie = await partner("admin")
      await create(cookie, { name: "The Plaza", city: "New York" }).expect(201)
      await create(cookie, { name: "Hotel Chelsea", city: "London" }).expect(201)
      const root = await platformAdmin()

      expect((await list(root, { q: "chelsea" }).expect(200)).body.items).toHaveLength(1)
      expect((await list(root, { q: "London" }).expect(200)).body.items).toHaveLength(1)
      expect((await list(root, { status: "active" }).expect(200)).body.items).toHaveLength(0)
      expect((await list(root, { orgId }).expect(200)).body.items).toHaveLength(2)
    })

    it("treats a wildcard in the search box as text, not as a wildcard", async () => {
      const cookie = await partner("admin")
      await create(cookie, { name: "The Plaza" }).expect(201)
      const root = await platformAdmin()

      // Unescaped, `%` would match every listing there is.
      expect((await list(root, { q: "%" }).expect(200)).body.items).toHaveLength(0)
    })

    it("the review queue is this same list, filtered", async () => {
      const cookie = await partner("admin")
      const waiting = await create(cookie, { name: "Waiting" }).expect(201)
      await makeComplete(waiting.body.id)
      await request(server())
        .post(`/api/v1/partner/listings/${waiting.body.id}/submit`)
        .set("Cookie", cookie)
        .expect(201)
      await create(cookie, { name: "Still A Draft" }).expect(201)
      const root = await platformAdmin()

      const queued = await list(root, { needsReview: true }).expect(200)
      expect(queued.body.items).toHaveLength(1)
      expect(queued.body.items[0].name).toBe("Waiting")
    })

    it("pages by keyset", async () => {
      const cookie = await partner("admin")
      await create(cookie, { name: "One" }).expect(201)
      await create(cookie, { name: "Two" }).expect(201)
      await create(cookie, { name: "Three" }).expect(201)
      const root = await platformAdmin()

      const page = await list(root, { limit: 2 }).expect(200)
      expect(page.body.items).toHaveLength(2)
      expect(page.body.nextCursor).toBeTruthy()

      const next = await list(root, { limit: 2, before: page.body.nextCursor }).expect(200)
      expect(next.body.items).toHaveLength(1)
      expect(next.body.nextCursor).toBeNull()
    })

    it("shows the platform a listing's pending photos, which guests never see", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await makeComplete(created.body.id)
      const root = await platformAdmin()

      const res = await request(server())
        .get(`/api/v1/admin/listings/${created.body.id}`)
        .set("Cookie", root)
        .expect(200)

      // Reviewing a photo is impossible on a screen that only shows the ones
      // already approved.
      expect(res.body.photos.length).toBe(5)
      expect(res.body.gaps).toEqual([])
    })

    it("is closed to partners and to guests", async () => {
      const cookie = await partner("admin")
      await list(cookie).expect(403)
      await request(server()).get("/api/v1/admin/listings").expect(401)
    })
  })

  /* ============================ suspension (rules #75, #78) == */

  describe("taking a listing off the market", () => {
    async function live() {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await makeComplete(created.body.id)
      await request(server())
        .post(`/api/v1/partner/listings/${created.body.id}/submit`)
        .set("Cookie", cookie)
        .expect(201)
      const root = await platformAdmin()
      await request(server())
        .post(`/api/v1/admin/listings/${created.body.id}/decision`)
        .set("Cookie", root)
        .send({ decision: "approve" })
        .expect(201)
      return { propertyId: created.body.id as string, root, cookie }
    }

    const suspend = (cookie: string[], id: string, body: object) =>
      request(server())
        .post(`/api/v1/admin/listings/${id}/suspension`)
        .set("Cookie", cookie)
        .send(body)

    it("suspends with a reason, and puts it back", async () => {
      const { propertyId, root } = await live()

      const off = await suspend(root, propertyId, {
        action: "suspend",
        reason: "Fire safety certificate has expired and was not renewed.",
      }).expect(201)
      expect(off.body.status).toBe("suspended")

      // Off the market means off the market: search must not return it.
      const search = await request(server()).get("/api/v1/properties").expect(200)
      expect(search.body.items.map((i: { id: string }) => i.id)).not.toContain(propertyId)

      const back = await suspend(root, propertyId, {
        action: "reinstate",
        reason: "Certificate renewed and verified by the compliance team.",
      }).expect(201)
      expect(back.body.status).toBe("active")
    })

    it("refuses a verdict with no reason behind it (rule #78)", async () => {
      const { propertyId, root } = await live()
      await suspend(root, propertyId, { action: "suspend", reason: "no" }).expect(400)
      await suspend(root, propertyId, { action: "suspend" }).expect(400)
    })

    it("will not guess where a listing that was never suspended should go back to", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      const root = await platformAdmin()

      // Reinstating a draft would have to choose a state for it, and guessing
      // could publish a listing nobody approved.
      await suspend(root, created.body.id, {
        action: "reinstate",
        reason: "This listing was never suspended in the first place.",
      }).expect(400)
    })

    it("writes who did it, and why, to the audit log (rule #77)", async () => {
      const { propertyId, root } = await live()
      await suspend(root, propertyId, {
        action: "suspend",
        reason: "Repeated guest complaints about undisclosed building works.",
      }).expect(201)

      const log = await request(server())
        .get("/api/v1/admin/audit")
        .set("Cookie", root)
        .expect(200)

      const entry = log.body.items.find(
        (e: { action: string; subjectId: string }) =>
          e.action === "property.suspend" && e.subjectId === propertyId
      )
      expect(entry).toBeTruthy()
      expect(entry.reason).toContain("building works")
    })

    it("records approvals too, not only refusals", async () => {
      const { propertyId, root } = await live()

      const log = await request(server())
        .get("/api/v1/admin/audit")
        .set("Cookie", root)
        .expect(200)

      // "Why is this hotel live" is the same question as "why is it not",
      // asked by whoever is looking later.
      expect(
        log.body.items.some(
          (e: { action: string; subjectId: string }) =>
            e.action === "listing.approve" && e.subjectId === propertyId
        )
      ).toBe(true)
    })

    it("is closed to the partner who owns it", async () => {
      const { propertyId, cookie } = await live()
      await suspend(cookie, propertyId, {
        action: "suspend",
        reason: "Trying to suspend a competitor's listing, or my own.",
      }).expect(403)
    })
  })

  /* ====================================== the listing score (rule #99) == */

  describe("how well a page is built", () => {
    it("gives the partner and the platform the same number", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await makeComplete(created.body.id)
      const root = await platformAdmin()

      const mine = await request(server())
        .get(`/api/v1/partner/listings/${created.body.id}/score`)
        .set("Cookie", cookie)
        .expect(200)

      const theirs = await request(server())
        .get("/api/v1/admin/content")
        .set("Cookie", root)
        .expect(200)

      const row = theirs.body.items.find((i: { id: string }) => i.id === created.body.id)
      // A partner asked to improve a number the platform measures differently
      // is a partner being sent on an errand.
      expect(row.score.total).toBe(mine.body.total)
      expect(mine.body.name).toBe("The Plaza")
    })

    it("does not punish a new listing for having no reviews", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await makeComplete(created.body.id)

      const res = await request(server())
        .get(`/api/v1/partner/listings/${created.body.id}/score`)
        .set("Cookie", cookie)
        .expect(200)

      const reviews = res.body.categories.find((c: { key: string }) => c.key === "reviews")
      expect(reviews.applicable).toBe(false)
      expect(reviews.score).toBeNull()
      // Photos were approved by nobody yet, so the score is not full marks -
      // but it is not dragged down by a category that cannot apply.
      expect(res.body.total).toBeGreaterThan(0)
    })

    it("counts only approved photos and published reviews", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)
      await makeComplete(created.body.id)

      const before = await request(server())
        .get(`/api/v1/partner/listings/${created.body.id}/score`)
        .set("Cookie", cookie)
        .expect(200)
      const pendingPhotos = before.body.categories.find(
        (c: { key: string }) => c.key === "photos"
      )
      // makeComplete writes photos as `pending`, and a pending photo is one no
      // guest can see - so it cannot count towards how well the page reads.
      expect(pendingPhotos.score).toBe(0)

      await db.update(photos).set({ status: "approved" })

      const after = await request(server())
        .get(`/api/v1/partner/listings/${created.body.id}/score`)
        .set("Cookie", cookie)
        .expect(200)
      expect(
        after.body.categories.find((c: { key: string }) => c.key === "photos").score
      ).toBeGreaterThan(0)
      expect(after.body.total).toBeGreaterThan(before.body.total)
    })

    it("puts the thinnest pages first", async () => {
      const cookie = await partner("admin")
      const thin = await create(cookie, { name: "Thin" }).expect(201)
      const full = await create(cookie, { name: "Full" }).expect(201)
      await makeComplete(full.body.id)
      await db.update(photos).set({ status: "approved" })
      const root = await platformAdmin()

      const res = await request(server())
        .get("/api/v1/admin/content")
        .set("Cookie", root)
        .expect(200)

      // The screen exists to find pages that need work; starting with the best
      // ones buries them.
      expect(res.body.items[0].id).toBe(thin.body.id)
      expect(res.body.items[0].score.total).toBeLessThan(
        res.body.items.find((i: { id: string }) => i.id === full.body.id).score.total
      )
    })

    it("will not score somebody else's listing", async () => {
      const cookie = await partner("admin")
      const created = await create(cookie).expect(201)

      const [rivalOrg] = await db
        .insert(partnerOrgs)
        .values({ name: "Rival Group", status: "active" })
        .returning()
      const outsider = await account(`rival${++n}@example.test`)
      await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, outsider.id))
      await db.insert(partnerMembers).values({
        orgId: rivalOrg!.id,
        userId: outsider.id,
        role: "admin",
        status: "active",
        propertyIds: [],
      })
      const rival = await request(server())
        .post("/api/v1/auth/login")
        .set("x-forwarded-for", freshIp())
        .send({ email: outsider.email, password: strong })
        .expect(200)

      // 404, not 403 - a 403 confirms the id belongs to somebody (API1).
      await request(server())
        .get(`/api/v1/partner/listings/${created.body.id}/score`)
        .set("Cookie", rival.headers["set-cookie"] as unknown as string[])
        .expect(404)
    })

    it("is closed to guests, and the content screen to partners", async () => {
      const cookie = await partner("admin")
      await request(server()).get("/api/v1/admin/content").set("Cookie", cookie).expect(403)
      await request(server()).get("/api/v1/admin/content").expect(401)
    })
  })
})
