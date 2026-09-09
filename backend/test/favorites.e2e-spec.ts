import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { eq } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { FAVORITES_LIMIT } from "@stayora/shared"

import { AppModule } from "../src/app.module"
import { resetDb } from "./support/reset-db"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { env } from "../src/config/env"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"
import { amenities, favorites, partnerOrgs, properties, propertyAmenities } from "../src/db/schema"

const strong = "correct horse battery staple"

describe("favorites", () => {
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

  beforeEach(() => resetDb(db))

  const server = () => app.getHttpServer()
  let ipCounter = 0
  const freshIp = () => `198.51.100.${++ipCounter % 250}`

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
    }
  }

  async function property(input: {
    slug: string
    name: string
    status: string
    price: number
    orgId?: string
  }) {
    const [row] = await db
      .insert(properties)
      .values({
        slug: input.slug,
        name: input.name,
        city: "New York",
        country: "USA",
        status: input.status,
        basePrice: input.price,
        partnerOrgId: input.orgId,
      })
      .returning()
    return row!
  }

  async function seed() {
    const [wifi] = await db
      .insert(amenities)
      .values({ slug: "wifi", label: "WiFi", category: "internet", position: 1 })
      .returning()
    const [org] = await db
      .insert(partnerOrgs)
      .values({ name: "Aurora Hospitality", status: "active" })
      .returning()

    const live = await property({
      slug: "the-ritz-carlton",
      name: "The Ritz-Carlton",
      status: "active",
      price: 58_000,
      orgId: org!.id,
    })
    const draft = await property({
      slug: "not-live-yet",
      name: "Not Live Yet",
      status: "pending_review",
      price: 10_000,
      orgId: org!.id,
    })
    const second = await property({
      slug: "the-standard",
      name: "The Standard",
      status: "active",
      price: 38_000,
      orgId: org!.id,
    })

    await db.insert(propertyAmenities).values({ propertyId: live.id, amenityId: wifi!.id })
    return { live, draft, second }
  }

  const save = (cookie: string[], id: string) =>
    request(server()).put(`/api/v1/favorites/${id}`).set("Cookie", cookie)

  const list = (cookie: string[]) =>
    request(server()).get("/api/v1/favorites").set("Cookie", cookie)

  /* ================================================================ basics == */

  it("saves, lists and removes", async () => {
    const { live } = await seed()
    const guest = await account("guest@example.com")

    await save(guest.cookie, live.id).expect(200)

    const saved = await list(guest.cookie).expect(200)
    expect(saved.body.items).toHaveLength(1)
    expect(saved.body.items[0]).toMatchObject({
      id: live.id,
      name: "The Ritz-Carlton",
      fromPrice: 58_000,
      amenities: ["wifi"],
      available: true,
    })
    // Same shape a search result has, so one card component can draw both.
    expect(saved.body.items[0].rating).toBeDefined()
    expect(typeof saved.body.items[0].savedAt).toBe("string")

    await request(server())
      .delete(`/api/v1/favorites/${live.id}`)
      .set("Cookie", guest.cookie)
      .expect(200)

    const after = await list(guest.cookie).expect(200)
    expect(after.body.items).toHaveLength(0)
  })

  it("is idempotent - a double tap saves once, not twice", async () => {
    const { live } = await seed()
    const guest = await account("guest@example.com")

    const first = await save(guest.cookie, live.id).expect(200)
    const second = await save(guest.cookie, live.id).expect(200)

    expect(first.body).toMatchObject({ saved: true, added: true })
    // The second call reports it changed nothing - and there is still one row.
    expect(second.body).toMatchObject({ saved: true, added: false })
    expect(await db.select().from(favorites)).toHaveLength(1)
  })

  it("removing something never saved is not an error", async () => {
    const { live } = await seed()
    const guest = await account("guest@example.com")

    const res = await request(server())
      .delete(`/api/v1/favorites/${live.id}`)
      .set("Cookie", guest.cookie)
      .expect(200)

    expect(res.body).toMatchObject({ saved: false, removed: false })
  })

  /* ============================================================== privacy == */

  it("a saved list is only ever the caller's own", async () => {
    const { live, second } = await seed()
    const amelia = await account("amelia@example.com")
    const rival = await account("rival@example.com")

    await save(amelia.cookie, live.id).expect(200)
    await save(rival.cookie, second.id).expect(200)

    const mine = await list(amelia.cookie).expect(200)
    expect(mine.body.items.map((i: { id: string }) => i.id)).toEqual([live.id])

    const theirs = await list(rival.cookie).expect(200)
    expect(theirs.body.items.map((i: { id: string }) => i.id)).toEqual([second.id])
  })

  it("requires a session", async () => {
    const { live } = await seed()
    await request(server()).get("/api/v1/favorites").expect(401)
    await request(server()).put(`/api/v1/favorites/${live.id}`).expect(401)
  })

  /* =========================================================== visibility == */

  it("refuses to save a property a guest cannot see - 404, not 403", async () => {
    const { draft } = await seed()
    const guest = await account("guest@example.com")

    // 403 would confirm the id belongs to a real unpublished listing (API1).
    await save(guest.cookie, draft.id).expect(404)
    expect(await db.select().from(favorites)).toHaveLength(0)
  })

  it("keeps a suspended property in the list, and says it is unavailable", async () => {
    const { live } = await seed()
    const guest = await account("guest@example.com")
    await save(guest.cookie, live.id).expect(200)

    await db.update(properties).set({ status: "suspended" }).where(eq(properties.id, live.id))

    const after = await list(guest.cookie).expect(200)
    // Not dropped - a list that shrinks with no explanation is worse than a
    // card admitting the hotel is gone.
    expect(after.body.items).toHaveLength(1)
    expect(after.body.items[0]).toMatchObject({ id: live.id, available: false })
  })

  /* ================================================================ order == */

  it("lists newest first and pages by keyset", async () => {
    const { live, second } = await seed()
    const guest = await account("guest@example.com")

    await save(guest.cookie, live.id).expect(200)
    await save(guest.cookie, second.id).expect(200)

    const page = await list(guest.cookie).query({ limit: 1 }).expect(200)
    expect(page.body.items.map((i: { id: string }) => i.id)).toEqual([second.id])
    expect(page.body.nextCursor).toBeTruthy()

    const next = await list(guest.cookie)
      .query({ limit: 1, before: page.body.nextCursor })
      .expect(200)
    expect(next.body.items.map((i: { id: string }) => i.id)).toEqual([live.id])
    expect(next.body.nextCursor).toBeNull()
  })

  /* =============================================================== lookup == */

  it("answers which of a page of ids are saved", async () => {
    const { live, second } = await seed()
    const guest = await account("guest@example.com")
    await save(guest.cookie, live.id).expect(200)

    const res = await request(server())
      .post("/api/v1/favorites/lookup")
      .set("Cookie", guest.cookie)
      .send({ propertyIds: [live.id, second.id] })
      .expect(201)

    expect(res.body.saved).toEqual([live.id])
  })

  /* ================================================================ limit == */

  it("caps the list, and a re-save at the cap still works", async () => {
    const { live } = await seed()
    const guest = await account("guest@example.com")

    /*
     * Filled through the database rather than the API - what is under test is
     * the behaviour AT the cap, not the several hundred calls to reach it.
     * Real property rows, because the foreign key would refuse invented ids.
     */
    const filler: { userId: string; propertyId: string }[] = [
      { userId: guest.id, propertyId: live.id },
    ]
    for (let i = 0; i < FAVORITES_LIMIT - 1; i += 1) {
      const row = await property({
        slug: `filler-${i}`,
        name: `Filler ${i}`,
        status: "active",
        price: 10_000,
      })
      filler.push({ userId: guest.id, propertyId: row.id })
    }
    await db.insert(favorites).values(filler).onConflictDoNothing()

    // Already on the list before the cap was reached, so this is not growth.
    await save(guest.cookie, live.id).expect(200)

    const fresh = await property({
      slug: "one-too-many",
      name: "One Too Many",
      status: "active",
      price: 10_000,
    })
    await save(guest.cookie, fresh.id).expect(400)
  })
})
