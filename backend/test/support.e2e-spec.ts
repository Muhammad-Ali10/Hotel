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
  bookings,
  partnerMembers,
  partnerOrgs,
  properties,
  ratePlans,
  rooms,
  supportThreads,
  users,
} from "../src/db/schema"

const strong = "correct horse battery staple"
const LONG = "The booking confirmation never arrived and I cannot sign in to check it."

describe("support — tickets, partner threads, booking messages", () => {
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
  let propertyId: string

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

  const signIn = async (email: string) => {
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    return res.headers["set-cookie"] as unknown as string[]
  }

  async function admin() {
    const g = await account(`root${++n}@stayora.test`)
    await db.update(users).set({ role: "admin", platformRole: "super_admin" }).where(eq(users.id, g.id))
    return { cookie: await signIn(g.email), id: g.id, email: g.email }
  }

  async function partner(role: "admin" | "manager" | "staff" = "admin") {
    const g = await account(`p${++n}@aurora.test`)
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, g.id))
    await db
      .insert(partnerMembers)
      .values({ orgId, userId: g.id, role, status: "active", propertyIds: [] })
    return { cookie: await signIn(g.email), id: g.id, email: g.email }
  }

  const openAnon = (over: Record<string, unknown> = {}) =>
    request(server())
      .post("/api/v1/support/tickets")
      .set("x-forwarded-for", freshIp())
      .send({
        subject: "Cannot sign in",
        body: LONG,
        email: `anon${++n}@example.test`,
        name: "Amelia Hart",
        ...over,
      })

  beforeEach(async () => {
    await resetDb(db)
    const [org] = await db
      .insert(partnerOrgs)
      .values({ name: "Aurora", contactEmail: "hi@aurora.test", status: "active" })
      .returning()
    orgId = org!.id

    const [property] = await db
      .insert(properties)
      .values({
        slug: "the-plaza",
        name: "The Plaza",
        city: "New York",
        country: "USA",
        timezone: "UTC",
        checkInTime: "15:00",
        status: "active",
        partnerOrgId: orgId,
      })
      .returning()
    propertyId = property!.id

    const [room] = await db
      .insert(rooms)
      .values({
        propertyId,
        name: "Deluxe King Room",
        maxAdults: 2,
        maxChildren: 0,
        maxOccupancy: 2,
        units: 5,
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
    })
  })

  /* ========================================================= anonymous == */

  describe("opening a ticket without an account (rule #85)", () => {
    /*
     * The reason the rule exists. "I cannot sign in" is the most common thing
     * support is asked, and a help desk behind a login turns that into a
     * closed loop.
     */
    it("lets somebody who cannot sign in ask for help", async () => {
      const res = await openAnon().expect(201)

      expect(res.body.ref).toMatch(/^TKT-\d{6}$/)
      expect(res.body.status).toBe("open")
      expect(res.body.requesterId).toBeNull()
    })

    it("gives each ticket a reference that cannot collide", async () => {
      const a = await openAnon().expect(201)
      const b = await openAnon().expect(201)
      expect(a.body.ref).not.toBe(b.body.ref)
    })

    /*
     * Attaching a booking to a ticket opened from an unproven address hands
     * somebody else's reservation to whoever asked for it. Refused in the
     * service AND by a database CHECK.
     */
    it("refuses to attach a booking to an unproven address", async () => {
      const g = await account(`owner${++n}@example.test`)
      const [booking] = await db
        .insert(bookings)
        .values({
          ref: `STY-S${++n}`,
          customerId: g.id,
          propertyId,
          roomId: (await db.select().from(rooms).limit(1))[0]!.id,
          ratePlanId: (await db.select().from(ratePlans).limit(1))[0]!.id,
          propertyName: "The Plaza",
          roomName: "Deluxe King Room",
          ratePlanName: "Flexible",
          city: "New York",
          cancelFreeUntil: "48h",
          cancelCharge: "full",
          guestFirstName: "A",
          guestLastName: "B",
          guestEmail: g.email,
          checkIn: "2027-01-01",
          checkOut: "2027-01-03",
          adults: 2,
          pricing: {},
          total: 1000,
          paymentMode: "prepay",
          commissionRateBps: 1500,
          commissionAmount: 150,
        })
        .returning()

      const res = await openAnon({ bookingId: booking!.id }).expect(201)
      expect(res.body.bookingId).toBeNull()
    })

    it("stops one address opening tickets endlessly", async () => {
      const email = `flood${++n}@example.test`
      for (let i = 0; i < 5; i += 1) await openAnon({ email }).expect(201)
      await openAnon({ email }).expect(400)
    })

    it("refuses a ticket that says nothing", async () => {
      await openAnon({ body: "help" }).expect(400)
      await openAnon({ subject: "" }).expect(400)
    })

    /*
     * The moment the address is proven, and the only moment this may happen.
     * Support saying "that ticket is yours" is what social engineering asks for.
     */
    it("links the ticket the moment its owner signs in (rule #86)", async () => {
      const email = `claim${++n}@example.test`
      const ticket = await openAnon({ email }).expect(201)

      // Before: the ticket belongs to nobody.
      const [before] = await db
        .select()
        .from(supportThreads)
        .where(eq(supportThreads.id, ticket.body.id))
      expect(before!.requesterId).toBeNull()

      const g = await account(email)
      // `account()` signs in, which is what does the linking.
      const mine = await request(server())
        .get("/api/v1/support/tickets")
        .set("Cookie", g.cookie)
        .expect(200)

      expect(mine.body.map((t: { id: string }) => t.id)).toContain(ticket.body.id)
    })

    it("never links a ticket to somebody else's account", async () => {
      const ticket = await openAnon({ email: `victim${++n}@example.test` }).expect(201)
      const other = await account(`attacker${++n}@example.test`)

      const theirs = await request(server())
        .get("/api/v1/support/tickets")
        .set("Cookie", other.cookie)
        .expect(200)

      expect(theirs.body).toHaveLength(0)
      await request(server())
        .get(`/api/v1/support/tickets/${ticket.body.id}`)
        .set("Cookie", other.cookie)
        .expect(404)
    })
  })

  /* ============================================================= guest == */

  describe("a signed-in guest", () => {
    it("gets their account attached", async () => {
      const g = await account(`g${++n}@example.test`)
      const res = await request(server())
        .post("/api/v1/support/tickets")
        .set("Cookie", g.cookie)
        .set("x-forwarded-for", freshIp())
        .send({ subject: "Refund question", body: LONG, email: g.email, name: "Amelia" })
        .expect(201)

      expect(res.body.requesterId).toBe(g.id)
    })

    it("sees only their own tickets", async () => {
      const a = await account(`a${++n}@example.test`)
      const b = await account(`b${++n}@example.test`)

      await request(server())
        .post("/api/v1/support/tickets")
        .set("Cookie", a.cookie)
        .set("x-forwarded-for", freshIp())
        .send({ subject: "Mine", body: LONG, email: a.email, name: "A" })
        .expect(201)

      const theirs = await request(server())
        .get("/api/v1/support/tickets")
        .set("Cookie", b.cookie)
        .expect(200)
      expect(theirs.body).toHaveLength(0)
    })

    /*
     * Somebody writing back after being told a matter is closed is telling you
     * it is not. Leaving it resolved means nobody looks again.
     */
    it("reopens a resolved ticket by replying to it", async () => {
      const g = await account(`re${++n}@example.test`)
      const ticket = await request(server())
        .post("/api/v1/support/tickets")
        .set("Cookie", g.cookie)
        .set("x-forwarded-for", freshIp())
        .send({ subject: "Still broken", body: LONG, email: g.email, name: "A" })
        .expect(201)

      const root = await admin()
      await request(server())
        .patch(`/api/v1/admin/support/${ticket.body.id}`)
        .set("Cookie", root.cookie)
        .send({ status: "resolved" })
        .expect(200)

      await request(server())
        .post(`/api/v1/support/tickets/${ticket.body.id}/reply`)
        .set("Cookie", g.cookie)
        .send({ body: "This is still happening, nothing has changed for me." })
        .expect(201)

      const after = await request(server())
        .get(`/api/v1/support/tickets/${ticket.body.id}`)
        .set("Cookie", g.cookie)
        .expect(200)

      expect(after.body.thread.status).toBe("open")
      expect(after.body.thread.resolvedAt).toBeNull()
    })

    /* An internal note is a colleague's aside. It never reaches the requester. */
    it("never shows the guest an internal note", async () => {
      const g = await account(`n${++n}@example.test`)
      const ticket = await request(server())
        .post("/api/v1/support/tickets")
        .set("Cookie", g.cookie)
        .set("x-forwarded-for", freshIp())
        .send({ subject: "Refund", body: LONG, email: g.email, name: "A" })
        .expect(201)

      const root = await admin()
      await request(server())
        .post(`/api/v1/admin/support/${ticket.body.id}/reply`)
        .set("Cookie", root.cookie)
        .send({ body: "Third refund request this month — check before approving.", internal: true })
        .expect(201)

      const seen = await request(server())
        .get(`/api/v1/support/tickets/${ticket.body.id}`)
        .set("Cookie", g.cookie)
        .expect(200)

      const bodies = seen.body.messages.map((m: { body: string }) => m.body).join(" ")
      expect(bodies).not.toContain("Third refund request")

      // The platform sees it.
      const agentView = await request(server())
        .get(`/api/v1/admin/support/${ticket.body.id}`)
        .set("Cookie", root.cookie)
        .expect(200)
      expect(
        agentView.body.messages.some((m: { authorKind: string }) => m.authorKind === "internal")
      ).toBe(true)
    })
  })

  /* =========================================================== partner == */

  describe("partner threads (rule #88)", () => {
    it("belongs to the org, so a colleague can read it", async () => {
      const first = await partner("admin")
      const colleague = await partner("manager")

      const ticket = await request(server())
        .post("/api/v1/partner/support")
        .set("Cookie", first.cookie)
        .send({ subject: "Payout missing", category: "finance", body: LONG })
        .expect(201)

      const theirs = await request(server())
        .get(`/api/v1/partner/support/${ticket.body.id}`)
        .set("Cookie", colleague.cookie)
        .expect(200)

      expect(theirs.body.thread.ref).toBe(ticket.body.ref)
    })

    /*
     * A partner thread discusses commission, payouts and the contract. A guest
     * must never reach one — and a 404, never a 403, because a 403 confirms
     * the id is real (API1).
     */
    it("is invisible to a guest and to another org", async () => {
      const p = await partner()
      const ticket = await request(server())
        .post("/api/v1/partner/support")
        .set("Cookie", p.cookie)
        .send({ subject: "Commission dispute", category: "finance", body: LONG })
        .expect(201)

      const g = await account(`nosy${++n}@example.test`)
      await request(server())
        .get(`/api/v1/support/tickets/${ticket.body.id}`)
        .set("Cookie", g.cookie)
        .expect(404)

      // A partner in a DIFFERENT org.
      const [other] = await db
        .insert(partnerOrgs)
        .values({ name: "Rival", contactEmail: "r@rival.test", status: "active" })
        .returning()
      const rival = await account(`rival${++n}@rival.test`)
      await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, rival.id))
      await db
        .insert(partnerMembers)
        .values({ orgId: other!.id, userId: rival.id, role: "admin", status: "active" })
      const rivalCookie = await signIn(rival.email)

      await request(server())
        .get(`/api/v1/partner/support/${ticket.body.id}`)
        .set("Cookie", rivalCookie)
        .expect(404)
    })

    it("offers the partner's own categories, not the guest's", async () => {
      const p = await partner()
      await request(server())
        .post("/api/v1/partner/support")
        .set("Cookie", p.cookie)
        .send({ subject: "Channel manager down", category: "connectivity", body: LONG })
        .expect(201)

      // `cancellation` is a guest category and means nothing here.
      await request(server())
        .post("/api/v1/partner/support")
        .set("Cookie", p.cookie)
        .send({ subject: "x", category: "cancellation", body: LONG })
        .expect(400)
    })
  })

  /* ============================================================= queue == */

  describe("the platform's inbox", () => {
    /*
     * Longest wait first. Newest-first is the ordering that lets a ticket sit
     * for a week while fresh ones get answered.
     */
    it("puts the longest wait at the top", async () => {
      const first = await openAnon({ subject: "Waiting longest" }).expect(201)
      await new Promise((r) => setTimeout(r, 25))
      await openAnon({ subject: "Just arrived" }).expect(201)

      const root = await admin()
      const res = await request(server())
        .get("/api/v1/admin/support")
        .set("Cookie", root.cookie)
        .expect(200)

      expect(res.body.items[0].id).toBe(first.body.id)
    })

    /*
     * `last_message_at` means "waiting since". An agent's reply must not push
     * the thread back to the front of the queue it was just taken off.
     */
    it("does not reorder the queue when an agent answers", async () => {
      const ticket = await openAnon({ subject: "First" }).expect(201)
      await new Promise((r) => setTimeout(r, 25))
      await openAnon({ subject: "Second" }).expect(201)

      const root = await admin()
      await request(server())
        .post(`/api/v1/admin/support/${ticket.body.id}/reply`)
        .set("Cookie", root.cookie)
        .send({ body: "Looking into this for you now, thanks for waiting." })
        .expect(201)

      const res = await request(server())
        .get("/api/v1/admin/support")
        .set("Cookie", root.cookie)
        .expect(200)
      expect(res.body.items[0].id).toBe(ticket.body.id)
    })

    it("picks the thread up when an agent answers", async () => {
      const ticket = await openAnon().expect(201)
      const root = await admin()

      await request(server())
        .post(`/api/v1/admin/support/${ticket.body.id}/reply`)
        .set("Cookie", root.cookie)
        .send({ body: "Thanks for getting in touch, I can help with that." })
        .expect(201)

      const res = await request(server())
        .get(`/api/v1/admin/support/${ticket.body.id}`)
        .set("Cookie", root.cookie)
        .expect(200)

      expect(res.body.thread.status).toBe("in_progress")
      expect(res.body.thread.assigneeId).toBe(root.id)
    })

    it("leaves the thread alone for an internal note", async () => {
      const ticket = await openAnon().expect(201)
      const root = await admin()

      await request(server())
        .post(`/api/v1/admin/support/${ticket.body.id}/reply`)
        .set("Cookie", root.cookie)
        .send({ body: "Checking whether this address has opened tickets before.", internal: true })
        .expect(201)

      const res = await request(server())
        .get(`/api/v1/admin/support/${ticket.body.id}`)
        .set("Cookie", root.cookie)
        .expect(200)
      expect(res.body.thread.status).toBe("open")
    })

    /* The timestamp is the server's — a client naming it could resolve a
       thread into the past and out of every report. */
    it("stamps the resolution itself", async () => {
      const ticket = await openAnon().expect(201)
      const root = await admin()

      const res = await request(server())
        .patch(`/api/v1/admin/support/${ticket.body.id}`)
        .set("Cookie", root.cookie)
        .send({ status: "resolved" })
        .expect(200)

      expect(res.body.resolvedAt).not.toBeNull()

      const reopened = await request(server())
        .patch(`/api/v1/admin/support/${ticket.body.id}`)
        .set("Cookie", root.cookie)
        .send({ status: "open" })
        .expect(200)
      expect(reopened.body.resolvedAt).toBeNull()
    })

    it("refuses a client that tries to set the resolution time (API3)", async () => {
      const ticket = await openAnon().expect(201)
      const root = await admin()

      await request(server())
        .patch(`/api/v1/admin/support/${ticket.body.id}`)
        .set("Cookie", root.cookie)
        .send({ status: "resolved", resolvedAt: "2020-01-01T00:00:00Z" })
        .expect(400)
    })

    it("keeps the whole inbox away from a guest and a partner", async () => {
      const g = await account(`x${++n}@example.test`)
      const p = await partner()
      await request(server()).get("/api/v1/admin/support").set("Cookie", g.cookie).expect(403)
      await request(server()).get("/api/v1/admin/support").set("Cookie", p.cookie).expect(403)
    })
  })

  /* =================================================== booking messages == */

  describe("guest and property, about one booking (rule #89)", () => {
    const seedBooking = async () => {
      const g = await account(`bm${++n}@example.test`)
      const [room] = await db.select().from(rooms).limit(1)
      const [plan] = await db.select().from(ratePlans).limit(1)
      const [booking] = await db
        .insert(bookings)
        .values({
          ref: `STY-M${++n}`,
          customerId: g.id,
          propertyId,
          roomId: room!.id,
          ratePlanId: plan!.id,
          propertyName: "The Plaza",
          roomName: "Deluxe King Room",
          ratePlanName: "Flexible",
          city: "New York",
          cancelFreeUntil: "48h",
          cancelCharge: "full",
          guestFirstName: "A",
          guestLastName: "B",
          guestEmail: g.email,
          checkIn: "2027-01-01",
          checkOut: "2027-01-03",
          adults: 2,
          pricing: {},
          total: 1000,
          paymentMode: "prepay",
          commissionRateBps: 1500,
          commissionAmount: 150,
          status: "confirmed",
        })
        .returning()
      return { bookingId: booking!.id, guest: g }
    }

    it("lets the guest and the property talk", async () => {
      const { bookingId, guest } = await seedBooking()
      const p = await partner()

      await request(server())
        .post(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", guest.cookie)
        .send({ body: "Could we have a room on a high floor if one is free?" })
        .expect(201)

      await request(server())
        .post(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", p.cookie)
        .send({ body: "Of course — we have noted it on your reservation." })
        .expect(201)

      const seen = await request(server())
        .get(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", guest.cookie)
        .expect(200)

      expect(seen.body.side).toBe("guest")
      expect(seen.body.messages.map((m: { side: string }) => m.side)).toEqual([
        "guest",
        "property",
      ])
    })

    it("marks the other side's messages read when the conversation is opened", async () => {
      const { bookingId, guest } = await seedBooking()
      const p = await partner()

      await request(server())
        .post(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", guest.cookie)
        .send({ body: "Is late check-out possible on our last day there?" })
        .expect(201)

      const beforeRead = await request(server())
        .get(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", guest.cookie)
        .expect(200)
      // Their own message is not read by them.
      expect(beforeRead.body.messages[0].readAt).toBeNull()

      await request(server())
        .get(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", p.cookie)
        .expect(200)

      const after = await request(server())
        .get(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", guest.cookie)
        .expect(200)
      expect(after.body.messages[0].readAt).not.toBeNull()
    })

    /* A 404, never a 403 — a 403 confirms the booking exists (API1). */
    it("is a 404 for anybody who is neither side", async () => {
      const { bookingId } = await seedBooking()
      const stranger = await account(`str${++n}@example.test`)

      await request(server())
        .get(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", stranger.cookie)
        .expect(404)
      await request(server())
        .post(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", stranger.cookie)
        .send({ body: "Trying to read somebody else's conversation here." })
        .expect(404)
    })

    it("is not reachable without a session at all", async () => {
      const { bookingId } = await seedBooking()
      await request(server()).get(`/api/v1/bookings/${bookingId}/messages`).expect(401)
    })

    /*
     * It is not support. Nothing here has a category, a priority, an assignee
     * or a resolution, and it never appears in the platform's queue.
     */
    it("never turns up in the support inbox", async () => {
      const { bookingId, guest } = await seedBooking()
      await request(server())
        .post(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", guest.cookie)
        .send({ body: "We will be arriving quite late, around midnight." })
        .expect(201)

      const root = await admin()
      const queue = await request(server())
        .get("/api/v1/admin/support")
        .set("Cookie", root.cookie)
        .expect(200)

      expect(queue.body.items).toHaveLength(0)
    })
  })

  /* ================================================= the property inbox == */

  describe("a property's guest inbox", () => {
    const seedBookingFor = async (ref: string) => {
      const g = await account(`inbox${++n}@example.test`)
      const [room] = await db.select().from(rooms).limit(1)
      const [plan] = await db.select().from(ratePlans).limit(1)
      const [booking] = await db
        .insert(bookings)
        .values({
          ref,
          customerId: g.id,
          propertyId,
          roomId: room!.id,
          ratePlanId: plan!.id,
          propertyName: "The Plaza",
          roomName: "Deluxe King Room",
          ratePlanName: "Flexible",
          city: "New York",
          cancelFreeUntil: "48h",
          cancelCharge: "full",
          guestFirstName: "Amelia",
          guestLastName: "Hart",
          guestEmail: g.email,
          checkIn: "2027-02-01",
          checkOut: "2027-02-03",
          adults: 2,
          pricing: {},
          total: 1000,
          paymentMode: "prepay",
          commissionRateBps: 1500,
          commissionAmount: 150,
          status: "confirmed",
        })
        .returning()
      return { bookingId: booking!.id, guest: g }
    }

    const inbox = (cookie: string[]) =>
      request(server()).get("/api/v1/partner/messages").set("Cookie", cookie)

    it("lists one row per conversation, newest activity first, with an unread count", async () => {
      const first = await seedBookingFor(`STY-I${++n}`)
      const second = await seedBookingFor(`STY-I${++n}`)
      const p = await partner()

      await request(server())
        .post(`/api/v1/bookings/${first.bookingId}/messages`)
        .set("Cookie", first.guest.cookie)
        .send({ body: "Is an early check-in possible?" })
        .expect(201)

      await request(server())
        .post(`/api/v1/bookings/${second.bookingId}/messages`)
        .set("Cookie", second.guest.cookie)
        .send({ body: "We are travelling with a small dog." })
        .expect(201)
      await request(server())
        .post(`/api/v1/bookings/${second.bookingId}/messages`)
        .set("Cookie", second.guest.cookie)
        .send({ body: "Is that all right?" })
        .expect(201)

      const res = await inbox(p.cookie).expect(200)

      // One row per booking, not one per message.
      expect(res.body.items).toHaveLength(2)
      expect(res.body.items[0]).toMatchObject({
        bookingId: second.bookingId,
        guestName: "Amelia Hart",
        preview: "Is that all right?",
        lastSide: "guest",
        unread: 2,
      })
      expect(res.body.items[1]).toMatchObject({ bookingId: first.bookingId, unread: 1 })
    })

    it("stops counting once the property has opened the conversation", async () => {
      const { bookingId, guest } = await seedBookingFor(`STY-I${++n}`)
      const p = await partner()

      await request(server())
        .post(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", guest.cookie)
        .send({ body: "Could we have a quiet room?" })
        .expect(201)

      expect((await inbox(p.cookie).expect(200)).body.items[0].unread).toBe(1)

      await request(server())
        .get(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", p.cookie)
        .expect(200)

      expect((await inbox(p.cookie).expect(200)).body.items[0].unread).toBe(0)
    })

    it("shows nothing for a booking nobody has written about", async () => {
      await seedBookingFor(`STY-I${++n}`)
      const p = await partner()

      // A booking is not a conversation. An inbox listing every reservation
      // ever sold is one the desk stops reading.
      expect((await inbox(p.cookie).expect(200)).body.items).toHaveLength(0)
    })

    it("never shows another organisation's conversations", async () => {
      const { bookingId, guest } = await seedBookingFor(`STY-I${++n}`)
      await request(server())
        .post(`/api/v1/bookings/${bookingId}/messages`)
        .set("Cookie", guest.cookie)
        .send({ body: "See you on Friday." })
        .expect(201)

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

      const res = await inbox(await signIn(outsider.email)).expect(200)
      expect(res.body.items).toHaveLength(0)
    })

    it("is closed to guests and to the platform", async () => {
      const guest = await account(`plain${++n}@example.test`)
      await request(server())
        .get("/api/v1/partner/messages")
        .set("Cookie", guest.cookie)
        .expect(403)
      await request(server()).get("/api/v1/partner/messages").expect(401)
    })
  })
})
