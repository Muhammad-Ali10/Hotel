import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { eq, sql } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module"
import { resetDb } from "./support/reset-db"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { env } from "../src/config/env"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"
import { NotificationsService } from "../src/modules/notifications/notifications.service"
import { FakeEmailProvider } from "../src/modules/notifications/provider/fake-email.provider"
import { partnerInvites, partnerMembers, partnerOrgs, properties, users } from "../src/db/schema"

const strong = "correct horse battery staple"

describe("partner org and team", () => {
  let app: NestExpressApplication
  let db: Database
  let mail: FakeEmailProvider
  let notifications: NotificationsService

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
    mail = moduleRef.get(FakeEmailProvider)
    notifications = moduleRef.get(NotificationsService)
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
  const freshIp = () => `198.51.100.${++n % 250}`

  /** Empties the mailbox for real — the outbox as well as the fake. */
  const drainMail = async () => {
    await notifications.deliverDue()
    mail.reset()
  }

  const account = async (email: string) => {
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

  /** Sign in again — a session only carries a membership made before it. */
  const signIn = async (email: string) => {
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    return res.headers["set-cookie"] as unknown as string[]
  }

  const admin = async (email = `root${++n}@stayora.test`) => {
    const g = await account(email)
    await db.update(users).set({ role: "admin", platformRole: "super_admin" }).where(eq(users.id, g.id))
    return g.cookie
  }

  /** A partner org with one admin — the state everything else starts from. */
  const orgWithAdmin = async (email = "owner@aurora.test") => {
    const root = await admin()
    const created = await request(server())
      .post("/api/v1/admin/partner-orgs")
      .set("Cookie", root)
      .send({ name: "Aurora Hospitality", contactEmail: "hello@aurora.test" })
      .expect(201)

    const owner = await account(email)
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, owner.id))
    const [member] = await db
      .insert(partnerMembers)
      .values({ orgId: created.body.id, userId: owner.id, role: "admin", status: "active" })
      .returning()

    // Re-sign-in so the session carries the partner membership.
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)

    return {
      orgId: created.body.id as string,
      cookie: res.headers["set-cookie"] as unknown as string[],
      memberId: member!.id,
      userId: owner.id,
      root,
    }
  }

  const invite = (cookie: string[], body: Record<string, unknown>) =>
    request(server())
      .post("/api/v1/partner/team/invites")
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .send(body)

  const tokenFromMail = (email: string) =>
    /token=([A-Za-z0-9_-]+)/.exec(mail.lastTo(email)?.text ?? "")?.[1]

  /* ========================================================= the platform == */

  it("creates a partner org, which nothing could do before", async () => {
    const root = await admin()
    const res = await request(server())
      .post("/api/v1/admin/partner-orgs")
      .set("Cookie", root)
      .send({ name: "Aurora Hospitality", contactEmail: "hello@aurora.test" })
      .expect(201)

    expect(res.body).toMatchObject({
      name: "Aurora Hospitality",
      // Sensible defaults: a new partner starts on trial at the standard rate.
      status: "trial",
      planTier: "starter",
      commissionRateBps: 1500,
    })
  })

  it("refuses a commission that is almost certainly a typo", async () => {
    const root = await admin()
    // 15 basis points is 0.15%, and 150000 is somebody typing a percentage
    // where basis points were wanted. The second one is caught; the first is
    // legal and deliberate.
    await request(server())
      .post("/api/v1/admin/partner-orgs")
      .set("Cookie", root)
      .send({ name: "X", contactEmail: "x@x.test", commissionRateBps: 150_000 })
      .expect(400)
  })

  it("refuses a partner and a guest the admin surface (API5)", async () => {
    const org = await orgWithAdmin()
    const guest = await account("nobody@example.com")

    for (const cookie of [org.cookie, guest.cookie]) {
      await request(server())
        .post("/api/v1/admin/partner-orgs")
        .set("Cookie", cookie)
        .send({ name: "X", contactEmail: "x@x.test" })
        .expect(403)
    }
  })

  /* =============================================================== the org == */

  it("lets an org admin change their own details", async () => {
    const org = await orgWithAdmin()
    const res = await request(server())
      .patch("/api/v1/partner/org")
      .set("Cookie", org.cookie)
      .send({ name: "Aurora Group", contactPhone: "+92 300 1234567" })
      .expect(200)

    expect(res.body).toMatchObject({ name: "Aurora Group", contactPhone: "+92 300 1234567" })
  })

  it("🔴 refuses a partner their own commission, plan and status (rule #59, API3)", async () => {
    const org = await orgWithAdmin()

    /*
     * The platform's side of the agreement. A partner who could set their own
     * commission would set it to zero — and one who could set their own
     * status could un-suspend themselves.
     */
    for (const body of [
      { commissionRateBps: 0 },
      { planTier: "enterprise" },
      { status: "active" },
      { id: "x" },
    ]) {
      await request(server())
        .patch("/api/v1/partner/org")
        .set("Cookie", org.cookie)
        .send(body)
        .expect(400)
    }

    const [row] = await db.select().from(partnerOrgs).where(eq(partnerOrgs.id, org.orgId))
    expect(row!.commissionRateBps).toBe(1500)
    expect(row!.status).toBe("trial")
  })

  it("never shows a partner the platform's own fields", async () => {
    const org = await orgWithAdmin()
    const res = await request(server())
      .get("/api/v1/partner/org")
      .set("Cookie", org.cookie)
      .expect(200)

    // They see their commission on every payout statement, which is where it
    // belongs — a settings screen would invite "why can I not edit this".
    expect(res.body).not.toHaveProperty("commissionRateBps")
    expect(res.body).not.toHaveProperty("status")
  })

  it("refuses a manager the org's details (rule #14)", async () => {
    const org = await orgWithAdmin()
    const colleague = await account("manager@aurora.test")
    await db.insert(partnerMembers).values({
      orgId: org.orgId,
      userId: colleague.id,
      role: "manager",
      status: "active",
    })
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, colleague.id))
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "manager@aurora.test", password: strong })
      .expect(200)

    await request(server())
      .patch("/api/v1/partner/org")
      .set("Cookie", res.headers["set-cookie"])
      .send({ name: "Renamed" })
      .expect(403)
  })

  /* ============================================================= invites == */

  it("invites somebody who has no account yet, and lets them join", async () => {
    const org = await orgWithAdmin()
    await drainMail()

    const created = await invite(org.cookie, {
      email: "newcolleague@aurora.test",
      role: "manager",
    }).expect(201)
    expect(created.body).toMatchObject({ email: "newcolleague@aurora.test", role: "manager" })
    // A pending invitation is not a credential.
    expect(created.body).not.toHaveProperty("token")
    expect(created.body).not.toHaveProperty("tokenHash")

    await notifications.deliverDue()
    const token = tokenFromMail("newcolleague@aurora.test")
    expect(token).toBeTruthy()

    // They sign up afterwards, with the address they were invited on.
    const joiner = await account("newcolleague@aurora.test")
    await request(server())
      .post("/api/v1/partner/invites/accept")
      .set("Cookie", joiner.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ token })
      .expect(201)

    const [member] = await db
      .select()
      .from(partnerMembers)
      .where(eq(partnerMembers.userId, joiner.id))
    expect(member).toMatchObject({ role: "manager", status: "active", orgId: org.orgId })

    // And the account moves onto the partner surface.
    const [row] = await db.select().from(users).where(eq(users.id, joiner.id))
    expect(row!.role).toBe("partner")
  })

  it("invites somebody who already has an account the same way (rule #60)", async () => {
    const existing = await account("existing@aurora.test")
    const org = await orgWithAdmin()
    await drainMail()

    /*
     * One code path either way. Branching would tell an org admin which of
     * their colleagues is already registered — the exact question the
     * enumeration-safe signup exists to keep unanswerable.
     */
    await invite(org.cookie, { email: "existing@aurora.test", role: "staff" }).expect(201)
    await notifications.deliverDue()

    await request(server())
      .post("/api/v1/partner/invites/accept")
      .set("Cookie", existing.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ token: tokenFromMail("existing@aurora.test") })
      .expect(201)

    const [member] = await db
      .select()
      .from(partnerMembers)
      .where(eq(partnerMembers.userId, existing.id))
    expect(member!.role).toBe("staff")
  })

  it("🔴 refuses an invitation forwarded to somebody else", async () => {
    const org = await orgWithAdmin()
    await drainMail()
    await invite(org.cookie, { email: "intended@aurora.test" }).expect(201)
    await notifications.deliverDue()
    const token = tokenFromMail("intended@aurora.test")

    const stranger = await account("stranger@example.com")

    /*
     * A team member can change rates, read every guest's booking and — at
     * admin — move the payout account. A forwarded link must not be enough.
     */
    await request(server())
      .post("/api/v1/partner/invites/accept")
      .set("Cookie", stranger.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ token })
      .expect(403)

    // And the invitation is NOT burned — the person it was meant for can
    // still use it.
    const intended = await account("intended@aurora.test")
    await request(server())
      .post("/api/v1/partner/invites/accept")
      .set("Cookie", intended.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ token })
      .expect(201)
  })

  it("spends an invitation once", async () => {
    const org = await orgWithAdmin()
    await drainMail()
    await invite(org.cookie, { email: "once@aurora.test" }).expect(201)
    await notifications.deliverDue()
    const token = tokenFromMail("once@aurora.test")

    const joiner = await account("once@aurora.test")
    const accept = () =>
      request(server())
        .post("/api/v1/partner/invites/accept")
        .set("Cookie", joiner.cookie)
        .set("x-forwarded-for", freshIp())
        .send({ token })

    await accept().expect(201)
    await accept().expect(400)
  })

  it("retires the previous invitation when a new one is sent", async () => {
    const org = await orgWithAdmin()
    await drainMail()

    await invite(org.cookie, { email: "twice@aurora.test", role: "staff" }).expect(201)
    await notifications.deliverDue()
    const first = tokenFromMail("twice@aurora.test")
    mail.reset()

    await invite(org.cookie, { email: "twice@aurora.test", role: "manager" }).expect(201)
    await notifications.deliverDue()
    const second = tokenFromMail("twice@aurora.test")

    const joiner = await account("twice@aurora.test")
    // A link left in a mailbox stops working the moment a new one is sent.
    await request(server())
      .post("/api/v1/partner/invites/accept")
      .set("Cookie", joiner.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ token: first })
      .expect(400)

    await request(server())
      .post("/api/v1/partner/invites/accept")
      .set("Cookie", joiner.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ token: second })
      .expect(201)
  })

  it("refuses an expired invitation", async () => {
    const org = await orgWithAdmin()
    await drainMail()
    await invite(org.cookie, { email: "stale@aurora.test" }).expect(201)
    await notifications.deliverDue()
    const token = tokenFromMail("stale@aurora.test")

    await db
      .update(partnerInvites)
      .set({ expiresAt: new Date(Date.now() - 60_000).toISOString() })

    const joiner = await account("stale@aurora.test")
    await request(server())
      .post("/api/v1/partner/invites/accept")
      .set("Cookie", joiner.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ token })
      .expect(400)
  })

  it("lets an admin revoke an invitation before it is used", async () => {
    const org = await orgWithAdmin()
    await drainMail()
    const created = await invite(org.cookie, { email: "revoked@aurora.test" }).expect(201)
    await notifications.deliverDue()
    const token = tokenFromMail("revoked@aurora.test")

    await request(server())
      .delete(`/api/v1/partner/team/invites/${created.body.id}`)
      .set("Cookie", org.cookie)
      .expect(200)

    const joiner = await account("revoked@aurora.test")
    await request(server())
      .post("/api/v1/partner/invites/accept")
      .set("Cookie", joiner.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ token })
      .expect(400)
  })

  it("refuses a manager and staff the power to invite (rule #14)", async () => {
    const org = await orgWithAdmin()

    for (const role of ["manager", "staff"] as const) {
      const colleague = await account(`${role}@aurora.test`)
      await db.insert(partnerMembers).values({
        orgId: org.orgId,
        userId: colleague.id,
        role,
        status: "active",
      })
      await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, colleague.id))
      const res = await request(server())
        .post("/api/v1/auth/login")
        .set("x-forwarded-for", freshIp())
        .send({ email: `${role}@aurora.test`, password: strong })
        .expect(200)

      await invite(res.headers["set-cookie"] as unknown as string[], {
        email: "someone@aurora.test",
      }).expect(403)
    }
  })

  /* ============================================================== the team == */

  it("shows the team and its pending invitations in one call", async () => {
    const org = await orgWithAdmin()
    await invite(org.cookie, { email: "pending@aurora.test", role: "staff" }).expect(201)

    const res = await request(server())
      .get("/api/v1/partner/team")
      .set("Cookie", org.cookie)
      .expect(200)

    expect(res.body.members).toHaveLength(1)
    expect(res.body.members[0]).toMatchObject({ email: "owner@aurora.test", role: "admin" })
    expect(res.body.invites).toHaveLength(1)
    expect(res.body.invites[0].email).toBe("pending@aurora.test")
  })

  it("changes a member's role and which properties they may touch", async () => {
    const org = await orgWithAdmin()
    const colleague = await account("colleague@aurora.test")
    const [member] = await db
      .insert(partnerMembers)
      .values({ orgId: org.orgId, userId: colleague.id, role: "staff", status: "active" })
      .returning()

    const [property] = await db
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
        partnerOrgId: org.orgId,
      })
      .returning()

    const res = await request(server())
      .patch(`/api/v1/partner/team/${member!.id}`)
      .set("Cookie", org.cookie)
      .send({ role: "manager", propertyIds: [property!.id] })
      .expect(200)

    // Role says WHAT they may do; propertyIds says WHICH properties (rule #14).
    expect(res.body).toMatchObject({ role: "manager", propertyIds: [property!.id] })
  })

  it("removes somebody from the team", async () => {
    const org = await orgWithAdmin()
    const colleague = await account("leaving@aurora.test")
    const [member] = await db
      .insert(partnerMembers)
      .values({ orgId: org.orgId, userId: colleague.id, role: "staff", status: "active" })
      .returning()

    await request(server())
      .delete(`/api/v1/partner/team/${member!.id}`)
      .set("Cookie", org.cookie)
      .expect(200)

    expect(
      await db.select().from(partnerMembers).where(eq(partnerMembers.id, member!.id))
    ).toHaveLength(0)
  })

  /* ------------------------------------------------- the last admin (#61) */

  it("🔴 will not let the last admin remove themselves", async () => {
    const org = await orgWithAdmin()

    /*
     * Without this the last admin locks everybody out with one click: nobody
     * left can change the payout account, invite anybody, or edit a rate
     * plan's terms — and the only way back is a platform administrator.
     */
    const res = await request(server())
      .delete(`/api/v1/partner/team/${org.memberId}`)
      .set("Cookie", org.cookie)
      .expect(409)
    expect(res.body.message).toContain("at least one admin")
  })

  it("will not let the last admin demote or suspend themselves", async () => {
    const org = await orgWithAdmin()

    for (const body of [{ role: "manager" }, { status: "suspended" }]) {
      await request(server())
        .patch(`/api/v1/partner/team/${org.memberId}`)
        .set("Cookie", org.cookie)
        .send(body)
        .expect(409)
    }
  })

  it("lets an admin step down once somebody else is one", async () => {
    const org = await orgWithAdmin()
    const colleague = await account("second@aurora.test")
    const [member] = await db
      .insert(partnerMembers)
      .values({ orgId: org.orgId, userId: colleague.id, role: "admin", status: "active" })
      .returning()
    void member

    await request(server())
      .patch(`/api/v1/partner/team/${org.memberId}`)
      .set("Cookie", org.cookie)
      .send({ role: "manager" })
      .expect(200)
  })

  it("counts only ACTIVE admins as admins", async () => {
    const org = await orgWithAdmin()
    const suspended = await account("suspended@aurora.test")
    await db.insert(partnerMembers).values({
      orgId: org.orgId,
      userId: suspended.id,
      role: "admin",
      status: "suspended",
    })

    // A suspended admin cannot sign in, so they are not somebody the org can
    // fall back on.
    await request(server())
      .delete(`/api/v1/partner/team/${org.memberId}`)
      .set("Cookie", org.cookie)
      .expect(409)
  })

  /* ------------------------------------------------------- SECURITY GATE -- */

  it("refuses an anonymous caller (API5)", async () => {
    await request(server()).get("/api/v1/partner/team").expect(401)
    await request(server()).get("/api/v1/partner/org").expect(401)
    await request(server()).post("/api/v1/partner/invites/accept").send({ token: "x" }).expect(401)
  })

  it("refuses a customer the partner surface (API5)", async () => {
    const guest = await account("guest@example.com")
    await request(server()).get("/api/v1/partner/team").set("Cookie", guest.cookie).expect(403)
  })

  it("🔴 404s another org's member — never 403 (API1)", async () => {
    const mine = await orgWithAdmin("mine@aurora.test")
    const theirs = await orgWithAdmin("theirs@rival.test")

    // A competitor's team is a list of people to phone.
    await request(server())
      .patch(`/api/v1/partner/team/${theirs.memberId}`)
      .set("Cookie", mine.cookie)
      .send({ role: "staff" })
      .expect(404)

    await request(server())
      .delete(`/api/v1/partner/team/${theirs.memberId}`)
      .set("Cookie", mine.cookie)
      .expect(404)

    const list = await request(server())
      .get("/api/v1/partner/team")
      .set("Cookie", mine.cookie)
      .expect(200)
    expect(list.body.members).toHaveLength(1)
    expect(list.body.members[0].email).toBe("mine@aurora.test")
  })

  it("404s another org's invitation (API1)", async () => {
    const mine = await orgWithAdmin("mine@aurora.test")
    const theirs = await orgWithAdmin("theirs@rival.test")
    const created = await invite(theirs.cookie, { email: "x@rival.test" }).expect(201)

    await request(server())
      .delete(`/api/v1/partner/team/invites/${created.body.id}`)
      .set("Cookie", mine.cookie)
      .expect(404)
  })

  it("refuses a member state that nothing can leave (API3)", async () => {
    const org = await orgWithAdmin()
    const colleague = await account("colleague@aurora.test")
    const [member] = await db
      .insert(partnerMembers)
      .values({ orgId: org.orgId, userId: colleague.id, role: "staff", status: "active" })
      .returning()

    // `invited` is a state of an INVITATION. A membership that exists was
    // necessarily accepted, and offering it here would strand somebody.
    await request(server())
      .patch(`/api/v1/partner/team/${member!.id}`)
      .set("Cookie", org.cookie)
      .send({ status: "invited" })
      .expect(400)

    // And nothing may reassign a membership to another org or person.
    for (const body of [{ orgId: org.orgId }, { userId: colleague.id }]) {
      await request(server())
        .patch(`/api/v1/partner/team/${member!.id}`)
        .set("Cookie", org.cookie)
        .send(body)
        .expect(400)
    }
  })

  it("caps what a caller can ask for (API4)", async () => {
    const org = await orgWithAdmin()
    await invite(org.cookie, {
      email: "big@aurora.test",
      propertyIds: Array.from({ length: 300 }, () => "00000000-0000-0000-0000-000000000000"),
    }).expect(400)

    const root = await admin()
    await request(server())
      .get("/api/v1/admin/partner-orgs?limit=5000")
      .set("Cookie", root)
      .expect(400)
  })

  /* ================================== agreements (rule #98) == */

  describe("the agreements a partner signs", () => {
    const publish = (cookie: string[], over: Record<string, unknown> = {}) =>
      request(server())
        .post("/api/v1/admin/contracts/templates")
        .set("Cookie", cookie)
        .send({
          kind: "service",
          title: "Master Service Agreement",
          body: "Stayora charges commission on completed bookings. Either party may terminate on notice.",
          effectiveFrom: "2026-01-01",
          ...over,
        })

    const mine = (cookie: string[]) =>
      request(server()).get("/api/v1/partner/contracts").set("Cookie", cookie)

    const accept = (cookie: string[], templateId: string, name = "Amelia Hart") =>
      request(server())
        .post(`/api/v1/partner/contracts/templates/${templateId}/accept`)
        .set("Cookie", cookie)
        .send({ acceptedByName: name })

    it("publishes a version, and the partner sees it as outstanding", async () => {
      const org = await orgWithAdmin()
      const template = await publish(org.root).expect(201)
      expect(template.body).toMatchObject({ kind: "service", version: 1, active: true })

      const before = await mine(org.cookie).expect(200)
      // A screen listing only what was signed cannot tell a partner there is
      // something waiting for them.
      expect(before.body.signed).toHaveLength(0)
      expect(before.body.outstanding.map((t: { id: string }) => t.id)).toEqual([template.body.id])

      await accept(org.cookie, template.body.id).expect(201)

      const after = await mine(org.cookie).expect(200)
      expect(after.body.outstanding).toHaveLength(0)
      expect(after.body.signed[0]).toMatchObject({
        version: 1,
        status: "accepted",
        acceptedByName: "Amelia Hart",
      })
    })

    it("keeps the text as it was signed, even if the template is edited later", async () => {
      const org = await orgWithAdmin()
      const template = await publish(org.root).expect(201)
      const signed = await accept(org.cookie, template.body.id).expect(201)

      // Straight into the table - the API has no route that does this, which
      // is the point: even so, the signature must not move.
      await db.execute(
        sql`UPDATE contract_templates SET body = 'Rewritten terms.' WHERE id = ${template.body.id}::uuid`
      )

      const res = await request(server())
        .get(`/api/v1/partner/contracts/${signed.body.id}`)
        .set("Cookie", org.cookie)
        .expect(200)

      expect(res.body.body).toContain("Either party may terminate")
      expect(res.body.body).not.toContain("Rewritten")
    })

    it("refuses to let a signature be rewritten, at the database", async () => {
      const org = await orgWithAdmin()
      const template = await publish(org.root).expect(201)
      const signed = await accept(org.cookie, template.body.id).expect(201)

      // Not a rule in the service - a trigger, so a query run by hand hits the
      // same wall as one written through the API.
      await expect(
        db.execute(
          sql`UPDATE partner_contracts SET accepted_by_name = 'Someone Else' WHERE id = ${signed.body.id}::uuid`
        )
      ).rejects.toThrow()

      // The lifecycle still moves, which is what the trigger deliberately allows.
      await db.execute(
        sql`UPDATE partner_contracts SET status = 'terminated', ended_at = now() WHERE id = ${signed.body.id}::uuid`
      )
    })

    it("accepts once, however many times the button is pressed", async () => {
      const org = await orgWithAdmin()
      const template = await publish(org.root).expect(201)

      const first = await accept(org.cookie, template.body.id).expect(201)
      const second = await accept(org.cookie, template.body.id).expect(201)

      expect(second.body.id).toBe(first.body.id)
      const res = await mine(org.cookie).expect(200)
      expect(res.body.signed).toHaveLength(1)
    })

    it("a new version supersedes the old one, and asks everyone to sign again", async () => {
      const org = await orgWithAdmin()
      const v1 = await publish(org.root).expect(201)
      await accept(org.cookie, v1.body.id).expect(201)

      const v2 = await publish(org.root, {
        title: "Master Service Agreement",
        body: "Revised commission terms take effect from the first of the month.",
        supersedes: v1.body.id,
      }).expect(201)
      expect(v2.body.version).toBe(2)

      const res = await mine(org.cookie).expect(200)
      // The old signature is still there and still says what it said - it is
      // simply no longer the live agreement.
      expect(res.body.signed[0]).toMatchObject({ version: 1, status: "superseded" })
      expect(res.body.signed[0].endedReason).toContain("v2")
      expect(res.body.outstanding.map((t: { id: string }) => t.id)).toEqual([v2.body.id])
    })

    it("will not offer a replaced version for acceptance", async () => {
      const org = await orgWithAdmin()
      const v1 = await publish(org.root).expect(201)
      await publish(org.root, { supersedes: v1.body.id, body: "Revised terms of service." }).expect(201)

      await accept(org.cookie, v1.body.id).expect(400)
    })

    it("will not let a version replace one of a different kind", async () => {
      const org = await orgWithAdmin()
      const service = await publish(org.root).expect(201)

      await publish(org.root, {
        kind: "commission",
        title: "Commission Agreement",
        body: "The commission rate and the invoicing schedule.",
        supersedes: service.body.id,
      }).expect(400)
    })

    it("only an org admin can bind the company", async () => {
      const org = await orgWithAdmin()
      const template = await publish(org.root).expect(201)

      const staff = await account("desk@aurora.test")
      await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, staff.id))
      await db
        .insert(partnerMembers)
        .values({ orgId: org.orgId, userId: staff.id, role: "manager", status: "active" })
      const cookie = await signIn("desk@aurora.test")

      // Reading is fine - everyone working there should see what was signed.
      await request(server())
        .get("/api/v1/partner/contracts")
        .set("Cookie", cookie)
        .expect(200)

      // Signing is not.
      await accept(cookie, template.body.id).expect(403)
    })

    it("never shows one organisation another's agreements", async () => {
      const org = await orgWithAdmin()
      const template = await publish(org.root).expect(201)
      const signed = await accept(org.cookie, template.body.id).expect(201)

      const other = await orgWithAdmin("owner@rival.test")
      const res = await mine(other.cookie).expect(200)
      expect(res.body.signed).toHaveLength(0)

      // 404, not 403 - a 403 would confirm the id belongs to somebody (API1).
      await request(server())
        .get(`/api/v1/partner/contracts/${signed.body.id}`)
        .set("Cookie", other.cookie)
        .expect(404)
    })

    it("terminates with a reason, and never without one", async () => {
      const org = await orgWithAdmin()
      const template = await publish(org.root).expect(201)
      const signed = await accept(org.cookie, template.body.id).expect(201)

      await request(server())
        .post(`/api/v1/admin/contracts/${signed.body.id}/terminate`)
        .set("Cookie", org.root)
        .send({ reason: "no" })
        .expect(400)

      await request(server())
        .post(`/api/v1/admin/contracts/${signed.body.id}/terminate`)
        .set("Cookie", org.root)
        .send({ reason: "Partnership ended by mutual agreement on 30 September." })
        .expect(201)

      const res = await mine(org.cookie).expect(200)
      expect(res.body.signed[0].status).toBe("terminated")
      // Terminating puts the agreement back on the outstanding list - there is
      // no live agreement any more, and the screen has to say so.
      expect(res.body.outstanding).toHaveLength(1)
    })

    it("is the platform's decision, not the partner's", async () => {
      const org = await orgWithAdmin()
      const template = await publish(org.root).expect(201)
      const signed = await accept(org.cookie, template.body.id).expect(201)

      // An agreement one side can walk away from by clicking is not one.
      await request(server())
        .post(`/api/v1/admin/contracts/${signed.body.id}/terminate`)
        .set("Cookie", org.cookie)
        .send({ reason: "We would rather not be bound by this any more." })
        .expect(403)

      await publish(org.cookie).expect(403)
    })

    it("records publishing, accepting and terminating in the audit log", async () => {
      const org = await orgWithAdmin()
      const template = await publish(org.root).expect(201)
      const signed = await accept(org.cookie, template.body.id).expect(201)
      await request(server())
        .post(`/api/v1/admin/contracts/${signed.body.id}/terminate`)
        .set("Cookie", org.root)
        .send({ reason: "Partnership ended by mutual agreement on 30 September." })
        .expect(201)

      const log = await request(server())
        .get("/api/v1/admin/audit")
        .set("Cookie", org.root)
        .expect(200)

      const actions = log.body.items.map((e: { action: string }) => e.action)
      expect(actions).toContain("contract.publish")
      expect(actions).toContain("contract.accept")
      expect(actions).toContain("contract.terminate")
    })
  })

  /* ================================ platform settings (rule #106) == */

  describe("the platform's own settings", () => {
    const get = (cookie: string[]) =>
      request(server()).get("/api/v1/admin/partner-orgs/settings").set("Cookie", cookie)

    const save = (cookie: string[], body: object) =>
      request(server())
        .patch("/api/v1/admin/partner-orgs/settings")
        .set("Cookie", cookie)
        .send(body)

    it("creates the single row on first read", async () => {
      const root = await admin()

      const res = await get(root).expect(200)
      expect(res.body).toMatchObject({ defaultCommissionRateBps: 1500, currency: "USD" })

      // Read twice, still one row - two admins opening the screen at once must
      // not produce two.
      await get(root).expect(200)
    })

    it("applies the default rate to a NEW organisation only", async () => {
      const root = await admin()
      await save(root, { defaultCommissionRateBps: 800 }).expect(200)

      const created = await request(server())
        .post("/api/v1/admin/partner-orgs")
        .set("Cookie", root)
        .send({ name: "Later Hotels", contactEmail: "hello@later.test" })
        .expect(201)
      expect(created.body.commissionRateBps).toBe(800)

      /*
       * And never to history. An existing rate is what that partner's invoices
       * were calculated from; a platform that could reprice the past by editing
       * one field is one nobody can reconcile against.
       */
      await save(root, { defaultCommissionRateBps: 2000 }).expect(200)
      const unchanged = await request(server())
        .get(`/api/v1/admin/partner-orgs/${created.body.id}`)
        .set("Cookie", root)
        .expect(200)
      expect(unchanged.body.client.commissionRateBps).toBe(800)
    })

    it("refuses a commission rate that is not a rate", async () => {
      const root = await admin()
      await save(root, { defaultCommissionRateBps: -1 }).expect(400)
      await save(root, { defaultCommissionRateBps: 10_001 }).expect(400)
      // The currency is stated, not offered - every price in the system is USD.
      await save(root, { currency: "EUR" }).expect(400)
    })

    it("records who changed it (rule #77)", async () => {
      const root = await admin()
      await save(root, { defaultCommissionRateBps: 1200 }).expect(200)

      const log = await request(server())
        .get("/api/v1/admin/audit")
        .set("Cookie", root)
        .expect(200)

      const entry = log.body.items.find(
        (e: { action: string }) => e.action === "platform.settings"
      )
      expect(entry).toBeTruthy()
      expect(entry.metadata).toMatchObject({ defaultCommissionRateBps: 1200 })
    })

    it("is closed to partners", async () => {
      const org = await orgWithAdmin()
      await get(org.cookie).expect(403)
      await save(org.cookie, { defaultCommissionRateBps: 0 }).expect(403)
    })
  })
})
