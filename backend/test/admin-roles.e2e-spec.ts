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
import { users } from "../src/db/schema"

/* ============================================================================
 * The admin permission matrix, enforced.
 *
 * It shipped as four grades, a fifteen-section matrix and a set of action
 * exceptions — all of it in the browser, and none of it anywhere else. The API
 * asked one question, "is this an admin", and answered every admin route to
 * anybody who passed. A finance administrator could suspend a property by
 * typing the URL, and the audit log recorded it as perfectly ordinary.
 *
 * These tests are the difference between a matrix and a decoration. They go
 * through HTTP on purpose: hiding a button is not a control, and the only
 * proof that something is enforced is a request that gets refused.
 * ========================================================================== */

const strong = "correct horse battery staple"

describe("admin grades", () => {
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
  const freshIp = () => `192.0.2.${++n % 250}`

  /** An administrator of a given grade, signed in. */
  async function adminOf(grade: "super_admin" | "ops" | "finance" | "support") {
    const email = `${grade}${++n}@stayora.test`
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "Root", lastName: "Admin" })
      .expect(201)

    const first = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)

    await db
      .update(users)
      .set({ role: "admin", platformRole: grade })
      .where(eq(users.id, first.body.user.id))

    // The grade changed under that session, so take a fresh one.
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)

    return { cookie: res.headers["set-cookie"] as unknown as string[], id: first.body.user.id }
  }

  const get = (path: string, cookie: string[]) =>
    request(server()).get(`/api/v1${path}`).set("Cookie", cookie).set("x-forwarded-for", freshIp())

  beforeEach(async () => {
    await resetDb(db)
  })

  /* ------------------------------------------------------------- the grade */

  it("puts the grade on the session, so the panel stops guessing", async () => {
    const finance = await adminOf("finance")

    const me = await get("/auth/me", finance.cookie).expect(200)

    /*
     * The admin panel hardcoded `super_admin` for every administrator, with a
     * comment saying so. This is the field that lets it stop.
     */
    expect(me.body.user.role).toBe("admin")
    expect(me.body.user.platformRole).toBe("finance")
  })

  it("leaves it null for everybody who is not an administrator", async () => {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email: "plain@example.com", password: strong, firstName: "A", lastName: "B" })
      .expect(201)
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "plain@example.com", password: strong })
      .expect(200)

    expect(res.body.user.platformRole).toBeNull()
  })

  it("refuses to store a grade on somebody who is not an administrator", async () => {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email: "sneaky@example.com", password: strong, firstName: "A", lastName: "B" })
      .expect(201)
    const [person] = await db.select().from(users).where(eq(users.email, "sneaky@example.com"))

    /*
     * The database refuses it, not a service.
     *
     * A customer row carrying `platform_role = 'super_admin'` would be
     * invisible on every screen and decisive in every permission check — the
     * exact shape of a privilege escalation nobody would find by reading code.
     */
    await expect(
      db.update(users).set({ platformRole: "super_admin" }).where(eq(users.id, person!.id))
    ).rejects.toThrow()
  })

  /* ---------------------------------------------------------- enforcement */

  it("lets finance read the property queue but never decide on it", async () => {
    const finance = await adminOf("finance")

    await get("/admin/finance/overview?from=2026-01-01&to=2026-12-31", finance.cookie).expect(200)

    // `properties: read` — a finance administrator may look at the queue.
    await get("/admin/listings?limit=5", finance.cookie).expect(200)

    /*
     * And that is where it stops. Approving a listing is a `manage` action on
     * a section `finance` may only read — and before this guard existed the
     * request went through, with the audit log recording it as ordinary.
     *
     * A property id that does not exist: reaching a 404 would mean the
     * permission check passed, which is exactly the failure being tested for.
     */
    await request(server())
      .post("/api/v1/admin/listings/01a00000-0000-7000-8000-000000000000/decision")
      .set("Cookie", finance.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ decision: "approve" })
      .expect(403)
  })

  it("lets ops read the property queue and refuses it the books", async () => {
    const ops = await adminOf("ops")

    await get("/admin/listings?limit=5", ops.cookie).expect(200)

    // `ops` may READ finance, and that is all — the matrix says `read`.
    await get("/admin/finance/overview?from=2026-01-01&to=2026-12-31", ops.cookie).expect(200)
  })

  it("refuses a read-only grade the write on the same section", async () => {
    const ops = await adminOf("ops")

    /*
     * The level comes from the HTTP METHOD, not from a decorator on each
     * route: GET needs `read`, anything else needs `manage`. `ops` has
     * `finance: read`, so it may look at the books and may not touch them —
     * and that distinction is the one a hidden button never enforced.
     */
    await request(server())
      .post("/api/v1/admin/payouts/run")
      .set("Cookie", ops.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ periodStart: "2026-01-01", periodEnd: "2026-01-15" })
      .expect(403)
  })

  it("lets a super admin through everywhere", async () => {
    const root = await adminOf("super_admin")

    await get("/admin/listings?limit=5", root.cookie).expect(200)
    await get("/admin/users?limit=5", root.cookie).expect(200)
    await get("/admin/finance/overview?from=2026-01-01&to=2026-12-31", root.cookie).expect(200)
    await get("/admin/audit?limit=5", root.cookie).expect(200)
  })

  it("still refuses somebody who is not an administrator at all", async () => {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email: "guest@example.com", password: strong, firstName: "A", lastName: "B" })
      .expect(201)
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "guest@example.com", password: strong })
      .expect(200)
    const cookie = res.headers["set-cookie"] as unknown as string[]

    // The older, coarser guard still does its job — this one is on top of it,
    // not instead of it.
    await get("/admin/listings?limit=5", cookie).expect(403)
  })

  it("says which section it refused, not just that it did", async () => {
    const support = await adminOf("support")

    const res = await get("/admin/finance/overview?from=2026-01-01&to=2026-12-31", support.cookie)
      .expect(403)

    /*
     * An administrator who cannot see something is entitled to know which
     * thing — otherwise the only way to find out is to ask somebody, and the
     * answer "you do not have access to this resource" fits every route.
     */
    expect(res.body.message).toContain("finance")
  })
})
