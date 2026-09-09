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
import { AuthService } from "../src/modules/auth/auth.service"
import { NotificationsService } from "../src/modules/notifications/notifications.service"
import { FakeEmailProvider } from "../src/modules/notifications/provider/fake-email.provider"
import {
  notificationOutbox,
  auditLog,
  notificationSettings,
  notifications,
  users,
} from "../src/db/schema"

const strong = "correct horse battery staple"

describe("notifications", () => {
  let app: NestExpressApplication
  let db: Database
  let service: NotificationsService
  let authService: AuthService
  let mail: FakeEmailProvider

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
    service = moduleRef.get(NotificationsService)
    authService = moduleRef.get(AuthService)
    mail = moduleRef.get(FakeEmailProvider)
  })

  afterAll(async () => {
    await resetDb(db)
    await app?.close()
  })

  beforeEach(async () => {
    await resetDb(db)
    mail.reset()
  })

  const server = () => app.getHttpServer()
  let n = 0
  const freshIp = () => `192.0.2.${++n % 250}`

  const signup = (email: string) =>
    request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "Amelia", lastName: "Hart" })

  const signIn = (email: string) =>
    request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })

  /**
   * A signed-in account with a clean slate.
   *
   * Signing up queues a welcome and a verification link of its own, so tests
   * that assert on the outbox clear it here rather than each subtracting two.
   * The tests that care about the signup messages use `signup` directly.
   */
  const account = async (email: string) => {
    await signup(email).expect(201)
    const res = await signIn(email).expect(200)
    await db.delete(notificationOutbox)
    mail.reset()
    return {
      cookie: res.headers["set-cookie"] as unknown as string[],
      id: res.body.user.id as string,
    }
  }

  const deliver = () => service.deliverDue()

  /* ============================================================== offers == */

  describe("an announcement to customers", () => {
    const KEY = "offer-key-0001"

    const admin = async () => {
      const person = await account("root@stayora.test")
      await db.update(users).set({ role: "admin", platformRole: "super_admin" }).where(eq(users.id, person.id))
      // The role changed under the session, so take a fresh one.
      const res = await signIn("root@stayora.test").expect(200)
      return res.headers["set-cookie"] as unknown as string[]
    }

    const optedIn = async (email: string) => {
      const person = await account(email)
      await db
        .update(users)
        .set({ emailVerifiedAt: new Date().toISOString() })
        .where(eq(users.id, person.id))
      await db
        .insert(notificationSettings)
        .values({ userId: person.id, emailUseful: true, emailMarketing: true })
      return person
    }

    const send = (cookie: string[], key: string | null = KEY) => {
      const req = request(server())
        .post("/api/v1/admin/offers")
        .set("Cookie", cookie)
        .set("x-forwarded-for", freshIp())
      if (key) req.set("Idempotency-Key", key)
      return req.send({
        title: "Three nights in Paris, 20% off",
        body: "Book by Friday and save on selected stays across the city.",
      })
    }

    it("reaches a customer who asked to hear from us", async () => {
      const cookie = await admin()
      const person = await optedIn("keen@example.com")
      mail.reset()

      const res = await send(cookie).expect(201)
      expect(res.body.queued).toBe(1)

      await deliver()
      const message = mail.lastTo(person.email ?? "keen@example.com")
      expect(message).toBeDefined()
      expect(message!.subject).toBe("Three nights in Paris, 20% off")
    })

    it("does not reach a customer who never opted in", async () => {
      const cookie = await admin()
      /*
       * `emailMarketing` defaults to FALSE — opt-in, not opt-out. This is the
       * test that keeps it that way: an endpoint that can mail every customer
       * is one line away from an endpoint that mails every customer who said
       * no, and nothing else in the request would look different.
       */
      const person = await account("quiet@example.com")
      await db
        .update(users)
        .set({ emailVerifiedAt: new Date().toISOString() })
        .where(eq(users.id, person.id))
      mail.reset()

      const res = await send(cookie).expect(201)
      await deliver()

      // Zero, and the number has to say so. An administrator planning a
      // campaign around "queued: 1" when nothing was queued is exactly the
      // kind of figure that is worse than no figure.
      expect(res.body.queued).toBe(0)
      expect(mail.lastTo("quiet@example.com")).toBeUndefined()
    })

    it("does not reach an unverified address", async () => {
      const cookie = await admin()
      const person = await account("unverified@example.com")
      await db
        .insert(notificationSettings)
        .values({ userId: person.id, emailUseful: true, emailMarketing: true })
      mail.reset()

      // Never verified. Bulk mail to addresses nobody has proved they own is
      // how a sending domain earns a spam reputation.
      const res = await send(cookie).expect(201)
      await deliver()

      expect(res.body.queued).toBe(0)
      expect(mail.lastTo("unverified@example.com")).toBeUndefined()
    })

    it("sends nothing twice for the same key", async () => {
      const cookie = await admin()
      await optedIn("twice@example.com")
      mail.reset()

      await send(cookie).expect(201)
      await send(cookie).expect(201)
      await deliver()

      // A retried refund pays somebody twice; a retried campaign mails
      // thousands of people twice, and the second copy is the one they
      // remember.
      expect(mail.countTo("twice@example.com")).toBe(1)
    })

    it("sends again under a different key", async () => {
      const cookie = await admin()
      await optedIn("again@example.com")
      mail.reset()

      await send(cookie, "offer-key-0001").expect(201)
      await send(cookie, "offer-key-0002").expect(201)
      await deliver()

      // Sending the same offer again next month is a real thing to want, which
      // is why the key is the campaign and not a hash of the text.
      expect(mail.countTo("again@example.com")).toBe(2)
    })

    it("refuses without an idempotency key", async () => {
      const cookie = await admin()
      await send(cookie, null).expect(400)
    })

    it("is closed to everybody but an administrator", async () => {
      const person = await account("nosy@example.com")
      await send(person.cookie).expect(403)
    })

    it("writes down who sent it", async () => {
      const cookie = await admin()
      await optedIn("audited@example.com")

      await send(cookie).expect(201)

      const [line] = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "notification.offer_sent"))
      expect(line).toBeDefined()
      expect(line!.actorEmail).toBe("root@stayora.test")
      // A message that reached every customer on the platform has to be
      // attributable to a person by name.
      expect(line!.reason).toBe("Three nights in Paris, 20% off")
    })
  })

  /* ================================================= signup, safely (#58) == */

  it("answers a new and an existing address identically", async () => {
    const first = await signup("known@example.com").expect(201)
    const second = await signup("known@example.com").expect(201)

    // The truth goes to the mailbox, not to whoever typed the address in.
    expect(second.body).toEqual(first.body)
    expect(second.headers["set-cookie"]).toBeUndefined()
    expect(await db.select().from(users)).toHaveLength(1)
  })

  it("tells the address itself which one it was", async () => {
    await signup("known@example.com").expect(201)
    await deliver()
    /*
     * Both messages, in no particular order.
     *
     * They are queued in the same millisecond and the worker takes them by
     * `next_attempt_at`, so which lands first is a coin toss — and the product
     * promises nothing about it. Asserting a sequence made the test fail on
     * the toss rather than on the behaviour.
     */
    expect(mail.sent.map((m) => m.subject).sort()).toEqual([
      "Confirm your email address",
      "Welcome to Stayora",
    ])
    mail.reset()

    await signup("known@example.com").expect(201)
    await deliver()

    // Only the person holding the mailbox learns anything.
    const message = mail.lastTo("known@example.com")
    expect(message?.subject).toContain("already have")
    expect(message?.text).toContain("nothing has changed")
  })

  it("sends a verification link a new account can actually use", async () => {
    await signup("verify@example.com").expect(201)
    await deliver()

    const verification = mail.sent.find((m) => m.subject.includes("Confirm"))
    expect(verification).toBeDefined()

    const token = /token=([A-Za-z0-9_-]+)/.exec(verification!.text)?.[1]
    await request(server())
      .post("/api/v1/auth/verify-email")
      .set("x-forwarded-for", freshIp())
      .send({ token })
      .expect(201)

    const [row] = await db.select().from(users).where(eq(users.email, "verify@example.com"))
    // The column existed from Module 1 and nothing ever set it.
    expect(row!.emailVerifiedAt).not.toBeNull()
  })

  it("spends a verification link once", async () => {
    await signup("once@example.com").expect(201)
    await deliver()
    const token = /token=([A-Za-z0-9_-]+)/.exec(
      mail.sent.find((m) => m.subject.includes("Confirm"))!.text
    )?.[1]

    await request(server())
      .post("/api/v1/auth/verify-email")
      .set("x-forwarded-for", freshIp())
      .send({ token })
      .expect(201)
    await request(server())
      .post("/api/v1/auth/verify-email")
      .set("x-forwarded-for", freshIp())
      .send({ token })
      .expect(400)
  })

  /* ========================================================= the outbox == */

  it("queues in the transaction and sends from the worker (rule #57)", async () => {
    const guest = await account("queue@example.com")
    mail.reset()

    await service.notify({
      template: "stay_reminder",
      subjectId: "b1",
      userId: guest.id,
      toEmail: "queue@example.com",
      payload: { propertyName: "The Ritz-Carlton", checkInTime: "15:00" },
    })

    // Recorded immediately, sent later. Nothing about the provider is in the
    // path of the thing that caused it.
    const queued = await db.select().from(notificationOutbox)
    expect(queued).toHaveLength(1)
    expect(queued[0]!.status).toBe("pending")
    expect(mail.countTo("queue@example.com")).toBe(0)

    const result = await deliver()
    expect(result.sent).toBe(1)
    expect(mail.countTo("queue@example.com")).toBe(1)
  })

  it("sends one event once, however often it is recorded", async () => {
    const guest = await account("dedupe@example.com")
    mail.reset()

    for (let i = 0; i < 3; i++) {
      await service.notify({
        template: "booking_confirmed",
        subjectId: "the-same-booking",
        userId: guest.id,
        toEmail: "dedupe@example.com",
        payload: { ref: "STY-000001", propertyName: "The Ritz-Carlton", total: 217_500 },
      })
    }

    await deliver()
    // Four copies of the same email and a guest stops trusting any of them.
    expect(mail.countTo("dedupe@example.com")).toBe(1)
  })

  it("retries a wobble and gives up on a bounce", async () => {
    await service.notify({
      template: "stay_reminder",
      subjectId: "b-flaky",
      userId: null,
      toEmail: "flaky@example.com",
      payload: { propertyName: "X", checkInTime: "15:00" },
    })
    await service.notify({
      template: "stay_reminder",
      subjectId: "b-bounce",
      userId: null,
      toEmail: "bounce@example.com",
      payload: { propertyName: "X", checkInTime: "15:00" },
    })

    await deliver()

    const rows = await db.select().from(notificationOutbox)
    const flaky = rows.find((r) => r.toEmail === "flaky@example.com")!
    const bounced = rows.find((r) => r.toEmail === "bounce@example.com")!

    // A 503 clears on its own given room; a 550 says the same thing forever,
    // and retrying it four more times is how a sending domain earns a
    // reputation problem.
    expect(flaky.status).toBe("pending")
    expect(flaky.attempts).toBe(1)
    expect(bounced.status).toBe("failed")
  })

  it("waits before trying again", async () => {
    await service.notify({
      template: "stay_reminder",
      subjectId: "b-backoff",
      userId: null,
      toEmail: "flaky@example.com",
      payload: { propertyName: "X", checkInTime: "15:00" },
    })
    const at = new Date()
    await service.deliverDue(at)

    const [row] = await db.select().from(notificationOutbox)
    expect(new Date(row!.nextAttemptAt).getTime()).toBeGreaterThan(at.getTime())

    // Nothing is due yet, so the next pass finds nothing.
    expect((await service.deliverDue(at)).examined).toBe(0)
  })

  it("eventually succeeds after a wobble clears", async () => {
    await service.notify({
      template: "stay_reminder",
      subjectId: "b-eventual",
      userId: null,
      toEmail: "flaky@example.com",
      payload: { propertyName: "X", checkInTime: "15:00" },
    })

    // The fake fails the first two attempts, then works.
    for (let i = 0; i < 3; i++) {
      await service.deliverDue(new Date(Date.now() + i * 3_600_000))
    }

    const [row] = await db.select().from(notificationOutbox)
    expect(row!.status).toBe("sent")
    expect(mail.countTo("flaky@example.com")).toBe(1)
  })


  it("does not send the same message twice when two workers run together", async () => {
    await service.notify({
      template: "stay_reminder",
      subjectId: "b-race",
      userId: null,
      toEmail: "race@example.com",
      payload: { propertyName: "X", checkInTime: "15:00" },
    })

    /*
     * Two workers, one message.
     *
     * `SELECT ... FOR UPDATE SKIP LOCKED` only holds its lock for the length of
     * the transaction it runs in — and a bare statement runs in an implicit one
     * that commits immediately. So the claim has to be a WRITE, or both workers
     * read the same row and the guest gets the email twice.
     */
    await Promise.all([service.deliverDue(), service.deliverDue()])

    expect(mail.countTo("race@example.com")).toBe(1)
  })

  /* ================================================ consent (rule #56) == */

  it("never lets a setting silence a booking confirmation", async () => {
    const guest = await account("essential@example.com")
    await request(server())
      .patch("/api/v1/notifications/settings")
      .set("Cookie", guest.cookie)
      .send({ emailUseful: false, emailMarketing: false })
      .expect(200)
    mail.reset()

    await service.notify({
      template: "booking_confirmed",
      subjectId: "b-essential",
      userId: guest.id,
      toEmail: "essential@example.com",
      payload: { ref: "STY-1", propertyName: "X", total: 100 },
    })
    await deliver()

    /*
     * A booking confirmation is a record of something that happened to
     * somebody's money. Switching it off is not a preference anyone can
     * meaningfully express in advance.
     */
    expect(mail.countTo("essential@example.com")).toBe(1)
  })

  it("honours a switched-off useful message", async () => {
    const guest = await account("optout@example.com")
    await request(server())
      .patch("/api/v1/notifications/settings")
      .set("Cookie", guest.cookie)
      .send({ emailUseful: false })
      .expect(200)
    mail.reset()

    await service.notify({
      template: "stay_reminder",
      subjectId: "b-optout",
      userId: guest.id,
      toEmail: "optout@example.com",
      payload: { propertyName: "X", checkInTime: "15:00" },
      inApp: { title: "Your stay is tomorrow", message: "See you at X" },
    })
    await deliver()

    expect(mail.countTo("optout@example.com")).toBe(0)
    // Switching off the email means stop emailing me, not hide it from my own
    // dashboard — nothing arrives uninvited in-app.
    const list = await request(server())
      .get("/api/v1/notifications")
      .set("Cookie", guest.cookie)
      .expect(200)
    expect(list.body.items).toHaveLength(1)
  })

  it("keeps marketing off until it is asked for", async () => {
    const guest = await account("marketing@example.com")
    mail.reset()

    await service.notify({
      template: "offer",
      subjectId: "promo-1",
      userId: guest.id,
      toEmail: "marketing@example.com",
      payload: { title: "20% off", body: "This weekend only" },
      inApp: { title: "20% off", message: "This weekend only" },
    })
    await deliver()

    // Opt-in is the only honest default for a message nobody asked for — and a
    // promotional card in a notifications list is still a promotion.
    expect(mail.countTo("marketing@example.com")).toBe(0)
    const list = await request(server())
      .get("/api/v1/notifications")
      .set("Cookie", guest.cookie)
      .expect(200)
    expect(list.body.items).toHaveLength(0)
  })

  it("respects a preference changed after the message was queued", async () => {
    const guest = await account("late@example.com")
    await service.notify({
      template: "stay_reminder",
      subjectId: "b-late",
      userId: guest.id,
      toEmail: "late@example.com",
      payload: { propertyName: "X", checkInTime: "15:00" },
    })
    mail.reset()

    await request(server())
      .patch("/api/v1/notifications/settings")
      .set("Cookie", guest.cookie)
      .send({ emailUseful: false })
      .expect(200)

    await deliver()

    // Somebody who switched it off between the queue and the send has said
    // something more recent than the queue has.
    expect(mail.countTo("late@example.com")).toBe(0)
    const [row] = await db.select().from(notificationOutbox)
    expect(row!.status).toBe("suppressed")
  })

  it("starts everybody on the documented defaults", async () => {
    const guest = await account("defaults@example.com")
    const res = await request(server())
      .get("/api/v1/notifications/settings")
      .set("Cookie", guest.cookie)
      .expect(200)

    // No row needed to sign up: absent means the defaults apply.
    // No `smsUseful`: a switch nothing honours is not offered at all (#106).
    expect(res.body).toEqual({ emailUseful: true, emailMarketing: false })
    expect(await db.select().from(notificationSettings)).toHaveLength(0)
  })

  /* ================================================== the dashboard list == */

  it("lists a person's own notifications, newest first, with an unread count", async () => {
    const guest = await account("list@example.com")

    for (const title of ["First", "Second"]) {
      await service.notify({
        template: "booking_confirmed",
        subjectId: title,
        userId: guest.id,
        toEmail: "list@example.com",
        payload: {},
        inApp: { title, message: title },
      })
    }

    const res = await request(server())
      .get("/api/v1/notifications")
      .set("Cookie", guest.cookie)
      .expect(200)

    expect(res.body.items).toHaveLength(2)
    expect(res.body.items[0].title).toBe("Second")
    expect(res.body.unread).toBe(2)
    expect(res.body.items[0].type).toBe("booking")
  })

  it("marks one read, and then all", async () => {
    const guest = await account("read@example.com")
    for (const title of ["A", "B", "C"]) {
      await service.notify({
        template: "booking_confirmed",
        subjectId: title,
        userId: guest.id,
        toEmail: "read@example.com",
        payload: {},
        inApp: { title, message: title },
      })
    }

    const list = await request(server())
      .get("/api/v1/notifications")
      .set("Cookie", guest.cookie)
      .expect(200)

    await request(server())
      .patch(`/api/v1/notifications/${list.body.items[0].id}/read`)
      .set("Cookie", guest.cookie)
      .expect(200)

    const afterOne = await request(server())
      .get("/api/v1/notifications")
      .set("Cookie", guest.cookie)
      .expect(200)
    expect(afterOne.body.unread).toBe(2)

    const all = await request(server())
      .post("/api/v1/notifications/read-all")
      .set("Cookie", guest.cookie)
      .expect(201)
    expect(all.body.read).toBe(2)
  })

  /* ================================================== the events fire == */

  it("sends the confirmation when the booking actually confirms, not when it is made", async () => {
    // Proven end to end in the payments suite; here the point is the CONTENT:
    // the cancellation sentence comes from `policyText()`, generated from the
    // same fields `refundFor()` reads (rule #1). A hosted template would let
    // somebody edit it into something the refund engine does not honour.
    const guest = await account("content@example.com")
    mail.reset()

    await service.notify({
      template: "booking_confirmed",
      subjectId: "b-content",
      userId: guest.id,
      toEmail: "content@example.com",
      payload: {
        ref: "STY-000042",
        propertyName: "The Ritz-Carlton",
        roomName: "Deluxe King Room",
        ratePlanName: "Flexible",
        checkIn: "2026-09-10",
        checkOut: "2026-09-13",
        total: 217_500,
        cancellationText:
          "Free cancellation until 48 hours before check-in. After that, 50% of the room rate is charged.",
      },
    })
    await deliver()

    const message = mail.lastTo("content@example.com")!
    expect(message.subject).toContain("The Ritz-Carlton")
    expect(message.subject).toContain("STY-000042")
    expect(message.text).toContain("$2,175.00")
    expect(message.html).toContain("Free cancellation until 48 hours")
  })

  it("escapes what somebody else typed", async () => {
    const guest = await account("xss@example.com")
    mail.reset()

    await service.notify({
      template: "partner_new_review",
      subjectId: "r-xss",
      userId: guest.id,
      toEmail: "xss@example.com",
      payload: { author: "<script>alert(1)</script>", rating: 5, title: "Lovely" },
    })
    await deliver()

    // Every value here is somebody's input at one remove. An unescaped one
    // turns a notification into a delivery mechanism.
    const html = mail.lastTo("xss@example.com")!.html
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })

  it("posts the reset link that Module 1 could only ever create", async () => {
    await account("reset@example.com")
    mail.reset()

    await authService.requestPasswordReset({ email: "reset@example.com", ip: "203.0.113.1" })
    await deliver()

    const message = mail.lastTo("reset@example.com")!
    expect(message.subject).toContain("Reset your")
    expect(message.text).toContain("/reset-password?token=")
  })

  /* ------------------------------------------------------- SECURITY GATE -- */

  it("refuses an anonymous caller (API5)", async () => {
    await request(server()).get("/api/v1/notifications").expect(401)
    await request(server()).get("/api/v1/notifications/settings").expect(401)
    await request(server()).post("/api/v1/notifications/read-all").expect(401)
  })

  it("keeps one person's notifications out of another's list (API1)", async () => {
    const mine = await account("mine@example.com")
    const theirs = await account("theirs@example.com")

    await service.notify({
      template: "booking_confirmed",
      subjectId: "b-theirs",
      userId: theirs.id,
      toEmail: "theirs@example.com",
      payload: {},
      inApp: { title: "Theirs", message: "Theirs" },
    })

    const res = await request(server())
      .get("/api/v1/notifications")
      .set("Cookie", mine.cookie)
      .expect(200)
    expect(res.body.items).toHaveLength(0)
  })

  it("404s somebody else's notification — never 403 (API1)", async () => {
    const mine = await account("a@example.com")
    const theirs = await account("b@example.com")

    await service.notify({
      template: "booking_confirmed",
      subjectId: "b-other",
      userId: theirs.id,
      toEmail: "b@example.com",
      payload: {},
      inApp: { title: "Theirs", message: "Theirs" },
    })
    const [row] = await db.select().from(notifications)

    await request(server())
      .patch(`/api/v1/notifications/${row!.id}/read`)
      .set("Cookie", mine.cookie)
      .expect(404)

    const [after] = await db.select().from(notifications)
    expect(after!.readAt).toBeNull()
  })

  it("refuses a setting nobody declared, and the essential ones (API3)", async () => {
    const guest = await account("strict@example.com")

    // There is no switch for `essential`, and offering one would promise a
    // choice the system will not honour.
    for (const body of [{ emailEssential: false }, { userId: "x" }, { emailUseful: "no" }]) {
      await request(server())
        .patch("/api/v1/notifications/settings")
        .set("Cookie", guest.cookie)
        .send(body)
        .expect(400)
    }
  })

  it("caps the page size (API4)", async () => {
    const guest = await account("cap@example.com")
    await request(server())
      .get("/api/v1/notifications?limit=5000")
      .set("Cookie", guest.cookie)
      .expect(400)
  })

  it("never lets a failed send undo the thing it was describing", async () => {
    const guest = await account("safe@example.com")

    // `notify` swallows its own failures: the worst outcome is a guest who was
    // not told, and the worst outcome of the alternative is a booking that
    // silently failed.
    const result = await service.notify({
      template: "booking_confirmed",
      subjectId: "b-safe",
      userId: "not-a-uuid",
      toEmail: "safe@example.com",
      payload: {},
      inApp: { title: "X", message: "X" },
    })

    // It did not throw — and it says plainly that nothing was recorded, rather
    // than being indistinguishable from a message that went out fine.
    expect(result).toEqual({ emailed: false, inApped: false })
    void guest
  })

  /* ============================= per-message switches (rule #105) == */

  describe("switching one message off", () => {
    const prefs = (cookie: string[]) =>
      request(server()).get("/api/v1/notifications/preferences").set("Cookie", cookie)

    const setPrefs = (cookie: string[], body: object) =>
      request(server())
        .patch("/api/v1/notifications/preferences")
        .set("Cookie", cookie)
        .send(body)

    it("lists what can be switched, and never what cannot", async () => {
      const guest = await account("prefs@example.com")

      const res = await prefs(guest.cookie).expect(200)
      const templates = res.body.items.map((i: { template: string }) => i.template)

      /*
       * An invoice, a payout and a booking confirmation are records of
       * something that happened to somebody's money (rule #56). A switch that
       * will not be honoured is worse than no switch.
       */
      expect(templates).not.toContain("booking_confirmed")
      expect(templates).not.toContain("password_reset")
      expect(templates.length).toBeGreaterThan(0)

      for (const item of res.body.items) {
        expect(item.klass).not.toBe("essential")
        expect(item.channels.length).toBeGreaterThan(0)
        // Nothing is the person's own choice until they make one.
        for (const c of item.channels) expect(c.isSet).toBe(false)
      }
    })

    it("shows a partner their own messages, not a guest's", async () => {
      const guest = await account("plainguest@example.com")
      const guestList = (await prefs(guest.cookie).expect(200)).body.items.map(
        (i: { template: string }) => i.template
      )
      expect(guestList).not.toContain("partner_new_booking")
    })

    it("stops one message without touching the rest", async () => {
      const guest = await account("mute@example.com")
      const before = await prefs(guest.cookie).expect(200)
      const target = before.body.items.find((i: { channels: { channel: string }[] }) =>
        i.channels.some((c) => c.channel === "email")
      )
      expect(target).toBeTruthy()

      const after = await setPrefs(guest.cookie, {
        preferences: [{ template: target.template, channel: "email", enabled: false }],
      }).expect(200)

      const changed = after.body.items.find(
        (i: { template: string }) => i.template === target.template
      )
      const email = changed.channels.find((c: { channel: string }) => c.channel === "email")
      expect(email).toMatchObject({ enabled: false, isSet: true })

      // Everything else is still on its default.
      const others = after.body.items.filter(
        (i: { template: string }) => i.template !== target.template
      )
      for (const item of others) {
        for (const c of item.channels) expect(c.isSet).toBe(false)
      }
    })

    it("beats the coarse setting in both directions", async () => {
      const guest = await account("both@example.com")

      // Email off overall …
      await request(server())
        .patch("/api/v1/notifications/settings")
        .set("Cookie", guest.cookie)
        .send({ emailUseful: false })
        .expect(200)

      const list = await prefs(guest.cookie).expect(200)
      const target = list.body.items.find((i: { channels: { channel: string }[] }) =>
        i.channels.some((c) => c.channel === "email")
      )

      // … but this one message wanted anyway.
      const after = await setPrefs(guest.cookie, {
        preferences: [{ template: target.template, channel: "email", enabled: true }],
      }).expect(200)

      const changed = after.body.items.find(
        (i: { template: string }) => i.template === target.template
      )
      expect(
        changed.channels.find((c: { channel: string }) => c.channel === "email").enabled
      ).toBe(true)
    })

    it("refuses to pretend an essential message can be switched off", async () => {
      const guest = await account("essential@example.com")

      // Refused, not ignored: silently accepting is how somebody ends up
      // believing they turned something off.
      await setPrefs(guest.cookie, {
        preferences: [
          { template: "booking_confirmed", channel: "email", enabled: false },
        ],
      }).expect(400)
    })

    it("refuses a message that does not exist, and a channel it never uses", async () => {
      const guest = await account("nonsense@example.com")

      await setPrefs(guest.cookie, {
        preferences: [{ template: "not_a_template", channel: "email", enabled: false }],
      }).expect(400)

      await setPrefs(guest.cookie, {
        preferences: [{ template: "offer", channel: "sms", enabled: true }],
      }).expect(400)
    })

    it("refuses a message the account never receives", async () => {
      /*
       * The read path and the write path have to agree (rule #105).
       *
       * `preferencesFor` has always hidden a guest's messages from a partner
       * and the reverse — but a hand-made PATCH for one used to be stored
       * anyway, leaving an override against a message that account can never
       * be sent. Refused, for the same reason an essential template is: an
       * accepted-and-ignored switch is worse than no switch.
       */
      const guest = await account("audience-guest@example.com")

      // A guest cannot switch a partner's payout or booking messages.
      await setPrefs(guest.cookie, {
        preferences: [
          { template: "partner_new_booking", channel: "email", enabled: false },
        ],
      }).expect(400)

      const owner = await account("audience-partner@example.com")
      await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, owner.id))

      // …and, now a partner, they cannot switch a guest's marketing either.
      await setPrefs(owner.cookie, {
        preferences: [{ template: "offer", channel: "email", enabled: false }],
      }).expect(400)

      // Their OWN messages still switch, so this is a boundary and not a wall.
      await setPrefs(owner.cookie, {
        preferences: [
          { template: "partner_new_booking", channel: "email", enabled: false },
        ],
      }).expect(200)
    })

    it("names every switch, so no screen has to invent the words", async () => {
      const guest = await account("labels@example.com")
      const list = await prefs(guest.cookie).expect(200)

      // A template added without copy would ship a switch labelled
      // `partner_new_review`; the catalogue is the one place that decides.
      for (const item of list.body.items) {
        expect(typeof item.label).toBe("string")
        expect(item.label.length).toBeGreaterThan(0)
        expect(typeof item.description).toBe("string")
        expect(item.description.length).toBeGreaterThan(0)
      }
    })

    it("actually stops the email going out", async () => {
      const guest = await account("silence@example.com")

      const list = await prefs(guest.cookie).expect(200)
      const target = list.body.items.find(
        (i: { klass: string; channels: { channel: string }[] }) =>
          i.klass === "useful" && i.channels.some((c) => c.channel === "email")
      )
      expect(target).toBeTruthy()

      await setPrefs(guest.cookie, {
        preferences: [{ template: target.template, channel: "email", enabled: false }],
      }).expect(200)

      await service.notify({
        template: target.template,
        subjectId: `pref-${++n}`,
        userId: guest.id,
        toEmail: "silence@example.com",
        payload: {},
      })
      await deliver()

      // The whole point: the switch is a switch, not a label.
      expect(mail.sent.filter((m) => m.to === "silence@example.com")).toHaveLength(0)
    })

    it("needs a session", async () => {
      await request(server()).get("/api/v1/notifications/preferences").expect(401)
    })
  })

  /* ====================================================== delivery health == */

  describe("is mail actually going out", () => {
    it("says so when the driver is not sending anything", async () => {
      const health = await service.deliveryHealth()

      /*
       * `fake` is the right setting for tests and for local work, and it is
       * also the one that looks perfect in production: every message accepted,
       * marked sent, delivered nowhere. So it is its own status, not "ok".
       */
      expect(health.driver).toBe("fake")
      expect(health.status).toBe("not_sending")
    })

    it("counts what is waiting, and how long it has waited", async () => {
      await db.insert(notificationOutbox).values([
        {
          template: "booking_confirmed",
          channel: "email",
          toEmail: "waiting@example.test",
          payload: {},
          dedupeKey: `health-fresh-${Date.now()}`,
          status: "pending",
          nextAttemptAt: new Date().toISOString(),
        },
      ])

      const health = await service.deliveryHealth()
      expect(health.pending).toBeGreaterThanOrEqual(1)

      /* Due now, so it is waiting rather than stuck. */
      expect(health.stuck).toBe(0)
    })

    it("calls a message stuck once it is long overdue", async () => {
      const anHourAgo = new Date(Date.now() - 60 * 60_000).toISOString()

      await db.insert(notificationOutbox).values([
        {
          template: "booking_confirmed",
          channel: "email",
          toEmail: "stuck@example.test",
          payload: {},
          dedupeKey: `health-stuck-${Date.now()}`,
          status: "pending",
          nextAttemptAt: anHourAgo,
        },
      ])

      const health = await service.deliveryHealth()

      /*
       * The whole point of the screen. An hour past due with the worker running
       * every minute means nothing is draining the queue, and that is the state
       * nobody finds out about on their own.
       */
      expect(health.stuck).toBeGreaterThanOrEqual(1)
    })

    it("reports how long the oldest message has been queued", async () => {
      /*
       * Queued an hour ago, not merely DUE an hour ago — the two are different
       * numbers and this is the one an operator reads. A message can be overdue
       * seconds after it was created (a retry backing off) without anything
       * being wrong; a message that has sat in the queue for an hour is.
       */
      await db.insert(notificationOutbox).values([
        {
          template: "booking_confirmed",
          channel: "email",
          toEmail: "old@example.test",
          payload: {},
          dedupeKey: `health-old-${Date.now()}`,
          status: "pending",
          nextAttemptAt: new Date().toISOString(),
          createdAt: new Date(Date.now() - 90 * 60_000).toISOString(),
        },
      ])

      const health = await service.deliveryHealth()
      expect(health.oldestPendingMinutes).toBeGreaterThanOrEqual(85)
    })
  })
})
