import { Controller, Get, VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { eq } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module"
import { resetDb } from "./support/reset-db"
import { Public, Roles } from "../src/common/auth/decorators"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"
import { AuthService } from "../src/modules/auth/auth.service"
import { passwordResets, users } from "../src/db/schema"
import { SESSION_COOKIE } from "../src/modules/auth/session.service"
import { env } from "../src/config/env"

/** Routes that exist only to prove the guards behave. */
@Controller("guard-probe")
class GuardProbeController {
  @Get("open")
  @Public()
  open() {
    return { ok: true }
  }

  @Get("protected")
  protectedRoute() {
    return { ok: true }
  }

  @Get("admin-only")
  @Roles("admin")
  adminOnly() {
    return { ok: true }
  }
}

const strong = "correct horse battery staple"

describe("auth", () => {
  let app: NestExpressApplication
  let db: Database
  let authService: AuthService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [GuardProbeController],
    }).compile()

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
    authService = moduleRef.get(AuthService)
  })

  afterAll(async () => {
    await resetDb(db)
    await app?.close()
  })

  beforeEach(async () => {
    await resetDb(db)
  })

  const server = () => app.getHttpServer()
  /** A distinct client per test, so the auth rate limit is not shared. */
  let ipCounter = 0
  const freshIp = () => `198.51.100.${++ipCounter % 250}`

  const signup = (email: string, ip = freshIp()) =>
    request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", ip)
      .send({ email, password: strong, firstName: "John", lastName: "Doe" })

  /**
   * Signup no longer hands back a session (rule #58), so a test that needs one
   * signs in afterwards — exactly as a real guest does.
   */
  const signIn = (email: string) =>
    request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })

  const signedUpAndIn = async (email: string) => {
    await signup(email).expect(201)
    return signIn(email).expect(200)
  }

  /* ------------------------------------------------------------- signup -- */

  it("creates an account WITHOUT signing anyone in (rule #58)", async () => {
    const res = await signup("john@example.com").expect(201)

    /*
     * The trade behind the enumeration-safe flow: a cookie coming back for a
     * new account and not for an existing one IS the leak restated. So signup
     * returns no session, and says the same thing either way.
     */
    expect(res.headers["set-cookie"]).toBeUndefined()
    expect(res.body).toEqual({ message: expect.stringContaining("Check your email") })
  })

  it("signs in with the password just chosen", async () => {
    // The extra step is smaller than it looks: whoever signed up knows their
    // own password. The verification link proves the address, it is not the
    // way in.
    const res = await signedUpAndIn("john@example.com")

    expect(res.body.user).toMatchObject({
      email: "john@example.com",
      role: "customer",
      tier: "standard",
      emailVerified: false,
    })
    const cookie = res.headers["set-cookie"][0]
    expect(cookie).toContain(`${SESSION_COOKIE}=`)
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("SameSite=Lax")
  })

  it("never returns a password hash (API3, output side)", async () => {
    const res = await signup("john@example.com").expect(201)
    expect(JSON.stringify(res.body)).not.toMatch(/argon2|passwordHash|password_hash/i)
  })

  it("never returns the internal session id, on any endpoint (API3)", async () => {
    // It leaked as `sessionId: ""` from signup and login before this test
    // existed — harmless while empty, and a session handle the moment it
    // was not.
    const created = await signedUpAndIn("john@example.com")
    expect(created.body.user.sessionId).toBeUndefined()

    const login = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "john@example.com", password: strong })
      .expect(200)
    expect(login.body.user.sessionId).toBeUndefined()

    const me = await request(server())
      .get("/api/v1/auth/me")
      .set("Cookie", created.headers["set-cookie"])
      .expect(200)
    expect(me.body.user.sessionId).toBeUndefined()
  })

  it("refuses an unknown field instead of ignoring it (API3)", async () => {
    // The mass-assignment attempt: a body that tries to mint an admin.
    const res = await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({
        email: "sneaky@example.com",
        password: strong,
        firstName: "S",
        lastName: "N",
        role: "admin",
      })

    expect(res.status).toBe(400)
    // ...and nothing was created.
    const rows = await db.select().from(users)
    expect(rows).toHaveLength(0)
  })

  it("normalises the email so one person cannot become two accounts", async () => {
    await signup("John@Example.com ").expect(201)
    const rows = await db.select().from(users)
    expect(rows[0]?.email).toBe("john@example.com")

    /*
     * The same address in different case is a collision — and signup no longer
     * SAYS so (rule #58). It answers identically and creates nothing; the
     * proof is that there is still exactly one account.
     */
    const second = await signup("JOHN@EXAMPLE.COM").expect(201)
    expect(second.headers["set-cookie"]).toBeUndefined()
    expect(await db.select().from(users)).toHaveLength(1)
  })

  it("enforces the password length policy", async () => {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email: "a@example.com", password: "short", firstName: "A", lastName: "B" })
      .expect(400)
  })

  it("caps password length, so argon2 cannot be used to burn a core", async () => {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({
        email: "b@example.com",
        password: "x".repeat(5000),
        firstName: "A",
        lastName: "B",
      })
      .expect(400)
  })

  /* -------------------------------------------------------------- login -- */

  it("signs in with the right password", async () => {
    await signup("john@example.com").expect(201)

    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "john@example.com", password: strong })
      .expect(200)

    expect(res.body.user.email).toBe("john@example.com")
    expect(res.headers["set-cookie"][0]).toContain(`${SESSION_COOKIE}=`)
  })

  it("gives the SAME answer for a wrong password and an unknown account (API2)", async () => {
    await signup("john@example.com").expect(201)

    const wrongPassword = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "john@example.com", password: "wrong password here" })

    const noSuchUser = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "nobody@example.com", password: "wrong password here" })

    expect(wrongPassword.status).toBe(401)
    expect(noSuchUser.status).toBe(401)
    // Byte-identical: the body must not answer the question the status hides.
    expect(noSuchUser.body).toEqual({ ...wrongPassword.body, path: noSuchUser.body.path })
    expect(wrongPassword.body.message).toBe("Invalid email or password")
  })

  it("spends comparable time on both, so timing does not leak it either (API2)", async () => {
    await signup("john@example.com").expect(201)

    const time = async (email: string) => {
      const started = process.hrtime.bigint()
      await request(server())
        .post("/api/v1/auth/login")
        .set("x-forwarded-for", freshIp())
        .send({ email, password: "wrong password here" })
      return Number(process.hrtime.bigint() - started) / 1e6
    }

    // Warm the argon2 path so the first call does not skew the comparison.
    await time("warmup@example.com")

    const known = await time("john@example.com")
    const unknown = await time("nobody@example.com")

    // An unknown account must not answer in a fraction of the time. Without
    // the dummy verify this ratio is ~200x; the bound is loose because CI
    // machines are noisy, but a missing dummy blows straight through it.
    expect(unknown).toBeGreaterThan(known * 0.25)
  })

  it("rejects a suspended account without revealing it before the password", async () => {
    await signup("john@example.com").expect(201)
    await db.update(users).set({ status: "suspended" })

    // Wrong password on a suspended account still reads as bad credentials.
    await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "john@example.com", password: "wrong password here" })
      .expect(401)

    // Only a correct password reveals the suspension.
    await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "john@example.com", password: strong })
      .expect(403)
  })

  it("locks out after 5 attempts a minute (API4)", async () => {
    await signup("john@example.com").expect(201)
    const ip = freshIp()

    const statuses: number[] = []
    for (let i = 0; i < 7; i++) {
      const res = await request(server())
        .post("/api/v1/auth/login")
        .set("x-forwarded-for", ip)
        .send({ email: "john@example.com", password: "wrong password here" })
      statuses.push(res.status)
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
    expect(statuses[5]).toBe(429)
  })

  /* ------------------------------------------------------------ sessions -- */

  it("resolves the session on /auth/me", async () => {
    const created = await signedUpAndIn("john@example.com")
    const cookie = created.headers["set-cookie"]

    const me = await request(server()).get("/api/v1/auth/me").set("Cookie", cookie).expect(200)
    expect(me.body.user.email).toBe("john@example.com")
    // The session id is an internal handle and must not leak.
    expect(me.body.user.sessionId).toBeUndefined()
  })

  it("refuses /auth/me without a session", async () => {
    await request(server()).get("/api/v1/auth/me").expect(401)
  })

  it("refuses a forged session cookie", async () => {
    await request(server())
      .get("/api/v1/auth/me")
      .set("Cookie", [`${SESSION_COOKIE}=totally-made-up-token`])
      .expect(401)
  })

  it("kills the session on logout", async () => {
    const created = await signedUpAndIn("john@example.com")
    const cookie = created.headers["set-cookie"]

    await request(server()).post("/api/v1/auth/logout").set("Cookie", cookie).expect(204)
    // The same cookie is now worthless, not merely cleared in the browser.
    await request(server()).get("/api/v1/auth/me").set("Cookie", cookie).expect(401)
  })

  it("lets a dead session log out without erroring", async () => {
    await request(server()).post("/api/v1/auth/logout").expect(204)
  })

  it("invalidates every session the moment an account is suspended", async () => {
    const created = await signedUpAndIn("john@example.com")
    const cookie = created.headers["set-cookie"]
    await request(server()).get("/api/v1/auth/me").set("Cookie", cookie).expect(200)

    await db.update(users).set({ status: "suspended" })

    // This is what a JWT could not do without waiting out its expiry.
    await request(server()).get("/api/v1/auth/me").set("Cookie", cookie).expect(401)
  })

  /* -------------------------------------------------------------- guards -- */

  it("protects a route by default (API5)", async () => {
    await request(server()).get("/api/v1/guard-probe/protected").expect(401)
  })

  it("allows an explicitly public route", async () => {
    await request(server()).get("/api/v1/guard-probe/open").expect(200)
  })

  it("still resolves the user on a public route, because tier changes price", async () => {
    const created = await signedUpAndIn("john@example.com")
    await request(server())
      .get("/api/v1/guard-probe/open")
      .set("Cookie", created.headers["set-cookie"])
      .expect(200)
  })

  it("refuses a customer on an admin route (API5)", async () => {
    const created = await signedUpAndIn("john@example.com")
    await request(server())
      .get("/api/v1/guard-probe/admin-only")
      .set("Cookie", created.headers["set-cookie"])
      .expect(403)
  })

  it("lets an admin through the same route", async () => {
    const created = await signedUpAndIn("john@example.com")
    await db.update(users).set({ role: "admin", platformRole: "super_admin" })
    await request(server())
      .get("/api/v1/guard-probe/admin-only")
      .set("Cookie", created.headers["set-cookie"])
      .expect(200)
  })

  /* ============================================================== profile == */

  const cookieOf = async (email: string) => {
    const res = await signedUpAndIn(email)
    return res.headers["set-cookie"] as unknown as string[]
  }

  const userIdFor = async (email: string) => {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
    return row?.id
  }

  it("reads back the whole profile, which nothing could do before", async () => {
    const cookie = await cookieOf("profile@example.com")
    const res = await request(server())
      .get("/api/v1/auth/me/profile")
      .set("Cookie", cookie)
      .expect(200)

    expect(res.body).toMatchObject({
      email: "profile@example.com",
      firstName: "John",
      tier: "standard",
      points: 0,
      preferences: [],
      emailVerified: false,
    })
    expect(res.body.joined).toBeTruthy()
  })

  it("updates the fields a guest owns", async () => {
    const cookie = await cookieOf("edit@example.com")
    const res = await request(server())
      .patch("/api/v1/auth/me/profile")
      .set("Cookie", cookie)
      .send({ firstName: "Amelia", city: "Karachi", preferences: ["quiet room"] })
      .expect(200)

    expect(res.body).toMatchObject({
      firstName: "Amelia",
      lastName: "Doe",
      city: "Karachi",
      preferences: ["quiet room"],
    })
  })

  it("refuses every field API3 named by name", async () => {
    const cookie = await cookieOf("escalate@example.com")

    /*
     * docs/ARCHITECTURE.md §5 API3 lists these exactly: "PATCH /me/profile se
     * role, tier, points, id, email_verified KABHI na likhe jayen". The rule
     * was written long before the endpoint existed — this is the test that
     * makes it true rather than aspirational.
     */
    for (const body of [
      { role: "admin" },
      { tier: "genius" },
      { points: 99_999 },
      { membership: "Platinum" },
      { emailVerified: true },
      { id: "00000000-0000-0000-0000-000000000000" },
      { status: "suspended" },
      { email: "someone.else@example.com" },
    ]) {
      await request(server())
        .patch("/api/v1/auth/me/profile")
        .set("Cookie", cookie)
        .send(body)
        .expect(400)
    }

    const after = await request(server())
      .get("/api/v1/auth/me/profile")
      .set("Cookie", cookie)
      .expect(200)
    expect(after.body).toMatchObject({ tier: "standard", points: 0, emailVerified: false })
  })

  it("refuses an anonymous caller the profile (API5)", async () => {
    await request(server()).get("/api/v1/auth/me/profile").expect(401)
    await request(server()).patch("/api/v1/auth/me/profile").send({ city: "X" }).expect(401)
  })

  /* ============================================================= password == */

  const changePassword = (cookie: string[], body: Record<string, unknown>) =>
    request(server())
      .post("/api/v1/auth/password")
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .send(body)

  it("changes a password and lets the new one sign in", async () => {
    const cookie = await cookieOf("change@example.com")
    await changePassword(cookie, {
      currentPassword: strong,
      newPassword: "a whole new passphrase entirely",
    }).expect(201)

    await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "change@example.com", password: strong })
      .expect(401)

    await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "change@example.com", password: "a whole new passphrase entirely" })
      .expect(200)
  })

  it("demands the current password, even from a live session", async () => {
    const cookie = await cookieOf("proof@example.com")

    // An unlocked laptop IS a live session, and the whole value of changing a
    // password is that it locks out everyone who had the old one.
    await changePassword(cookie, {
      currentPassword: "not the right one",
      newPassword: "a whole new passphrase entirely",
    }).expect(401)
  })

  it("refuses a new password identical to the old", async () => {
    const cookie = await cookieOf("same@example.com")
    await changePassword(cookie, { currentPassword: strong, newPassword: strong }).expect(400)
  })

  it("signs out every OTHER device, and keeps this one (API2)", async () => {
    const first = await cookieOf("multi@example.com")
    const second = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "multi@example.com", password: strong })
      .expect(200)
    const secondCookie = second.headers["set-cookie"] as unknown as string[]

    const res = await changePassword(first, {
      currentPassword: strong,
      newPassword: "a whole new passphrase entirely",
    }).expect(201)
    expect(res.body.endedElsewhere).toBe(1)

    // The devices that matter are the ones holding the OLD password.
    await request(server()).get("/api/v1/auth/me").set("Cookie", secondCookie).expect(401)
    // And the person who did the right thing is not punished for it.
    await request(server()).get("/api/v1/auth/me").set("Cookie", first).expect(200)
  })

  /* -------------------------------------------------------- reset (rule #54) */

  const forgot = (email: string) =>
    request(server())
      .post("/api/v1/auth/password/forgot")
      .set("x-forwarded-for", freshIp())
      .send({ email })

  /**
   * The token never crosses the wire, so a test reads it the way Module 9
   * will: from the service, before anything is posted anywhere.
   */
  const tokenFor = async (email: string) => {
    const result = await authService.requestPasswordReset({ email, ip: "203.0.113.9" })
    return result.token!
  }

  const reset = (token: string, newPassword: string) =>
    request(server())
      .post("/api/v1/auth/password/reset")
      .set("x-forwarded-for", freshIp())
      .send({ token, newPassword })

  it("answers a reset request identically for a known and unknown address", async () => {
    await signup("known@example.com").expect(201)

    const a = await forgot("known@example.com").expect(201)
    const b = await forgot("nobody-at-all@example.com").expect(201)

    // A different reply turns this into a way of asking "does this person have
    // an account here".
    expect(a.body).toEqual(b.body)
    expect(a.body.message).toContain("If that address has an account")
  })

  it("never puts the token in the response", async () => {
    await signup("leak@example.com").expect(201)
    const res = await forgot("leak@example.com").expect(201)

    // It would hand a reset to anybody who can post a form.
    expect(Object.keys(res.body)).toEqual(["message"])
    expect(JSON.stringify(res.body)).not.toMatch(/[A-Za-z0-9_-]{40,}/)
  })

  it("resets the password and lets the new one in", async () => {
    await signup("forgot@example.com").expect(201)
    const token = await tokenFor("forgot@example.com")

    await reset(token, "an entirely different passphrase").expect(201)

    await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "forgot@example.com", password: "an entirely different passphrase" })
      .expect(200)
  })

  it("spends a reset link exactly once", async () => {
    await signup("once@example.com").expect(201)
    const token = await tokenFor("once@example.com")

    await reset(token, "an entirely different passphrase").expect(201)
    // A link that works twice works again after the email has been forwarded,
    // or after it has sat in a mailbox for a month.
    await reset(token, "yet another passphrase entirely").expect(400)
  })

  it("retires the previous link when a new one is asked for", async () => {
    await signup("twice@example.com").expect(201)
    const first = await tokenFor("twice@example.com")
    const second = await tokenFor("twice@example.com")

    await reset(first, "an entirely different passphrase").expect(400)
    await reset(second, "an entirely different passphrase").expect(201)
  })

  it("refuses an expired link", async () => {
    await signup("stale@example.com").expect(201)
    const token = await tokenFor("stale@example.com")
    const userId = await userIdFor("stale@example.com")

    await db
      .update(passwordResets)
      .set({ expiresAt: new Date(Date.now() - 60_000).toISOString() })
      .where(eq(passwordResets.userId, userId!))

    await reset(token, "an entirely different passphrase").expect(400)
  })

  it("refuses a token nobody issued", async () => {
    await reset("a".repeat(43), "an entirely different passphrase").expect(400)
  })

  it("signs out EVERY device on a reset, including the one asking", async () => {
    const cookie = await cookieOf("compromised@example.com")
    const token = await tokenFor("compromised@example.com")

    await reset(token, "an entirely different passphrase").expect(201)

    /*
     * A reset is what somebody does when they believe their account is
     * compromised. The point is that nothing signed in a moment ago still is —
     * a password CHANGE keeps the current device, a RESET does not.
     */
    await request(server()).get("/api/v1/auth/me").set("Cookie", cookie).expect(401)
  })

  it("stores the reset token hashed, never in the clear", async () => {
    await signup("hashed@example.com").expect(201)
    const token = await tokenFor("hashed@example.com")

    const rows = await db.select().from(passwordResets)
    // A leaked backup of plaintext reset tokens is a leaked backup of every
    // account in it.
    expect(rows[0]!.tokenHash).not.toBe(token)
    expect(rows[0]!.tokenHash).toHaveLength(64)
  })

  /* ============================================================= sessions == */

  it("lists the devices signed in, and marks this one", async () => {
    const first = await cookieOf("devices@example.com")
    await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .set("User-Agent", "Stayora/iPhone")
      .send({ email: "devices@example.com", password: strong })
      .expect(200)

    const res = await request(server())
      .get("/api/v1/auth/sessions")
      .set("Cookie", first)
      .expect(200)

    expect(res.body).toHaveLength(2)
    expect(res.body.filter((s: { current: boolean }) => s.current)).toHaveLength(1)
  })

  it("never puts a credential in the device list (API3)", async () => {
    const cookie = await cookieOf("nocreds@example.com")
    const res = await request(server())
      .get("/api/v1/auth/sessions")
      .set("Cookie", cookie)
      .expect(200)

    // Recognising your own device needs none of this.
    expect(res.body[0]).not.toHaveProperty("tokenHash")
    expect(res.body[0]).not.toHaveProperty("userId")
  })

  it("signs one device out", async () => {
    const first = await cookieOf("revoke@example.com")
    const second = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "revoke@example.com", password: strong })
      .expect(200)
    const secondCookie = second.headers["set-cookie"] as unknown as string[]

    const list = await request(server())
      .get("/api/v1/auth/sessions")
      .set("Cookie", first)
      .expect(200)
    const other = list.body.find((s: { current: boolean }) => !s.current)

    await request(server())
      .delete(`/api/v1/auth/sessions/${other.id}`)
      .set("Cookie", first)
      .expect(200)

    await request(server()).get("/api/v1/auth/me").set("Cookie", secondCookie).expect(401)
    await request(server()).get("/api/v1/auth/me").set("Cookie", first).expect(200)
  })

  it("404s somebody else's session — never 403 (API1)", async () => {
    const mine = await cookieOf("mine@example.com")
    const theirs = await cookieOf("theirs@example.com")

    const theirList = await request(server())
      .get("/api/v1/auth/sessions")
      .set("Cookie", theirs)
      .expect(200)

    // "Delete by id" without an ownership filter is a way to sign strangers out.
    await request(server())
      .delete(`/api/v1/auth/sessions/${theirList.body[0].id}`)
      .set("Cookie", mine)
      .expect(404)

    await request(server()).get("/api/v1/auth/me").set("Cookie", theirs).expect(200)
  })

  it("signs out everywhere else (API2)", async () => {
    const first = await cookieOf("everywhere@example.com")
    const others: string[][] = []
    for (let i = 0; i < 2; i++) {
      const res = await request(server())
        .post("/api/v1/auth/login")
        .set("x-forwarded-for", freshIp())
        .send({ email: "everywhere@example.com", password: strong })
        .expect(200)
      others.push(res.headers["set-cookie"] as unknown as string[])
    }

    const res = await request(server())
      .post("/api/v1/auth/sessions/revoke-others")
      .set("Cookie", first)
      .expect(201)
    expect(res.body.revoked).toBe(2)

    for (const cookie of others) {
      await request(server()).get("/api/v1/auth/me").set("Cookie", cookie).expect(401)
    }
    await request(server()).get("/api/v1/auth/me").set("Cookie", first).expect(200)
  })

  it("refuses an anonymous caller the session list (API5)", async () => {
    await request(server()).get("/api/v1/auth/sessions").expect(401)
    await request(server()).post("/api/v1/auth/sessions/revoke-others").expect(401)
  })
})
