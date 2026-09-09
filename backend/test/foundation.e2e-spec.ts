import { Controller, Get, Post, Body, VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import express from "express"
import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { env } from "../src/config/env"
import { Public } from "../src/common/auth/decorators"
import { AuthThrottle } from "../src/common/throttling/throttling"

/**
 * A stand-in for the endpoints Module 1 will add, so the foundation can be
 * proved before any of them exist. Without it, rate limiting and versioning
 * would go untested until something happened to need them — which is exactly
 * when a gap is most expensive to find.
 */
@Controller("probe")
// Authentication is default-deny (API5), so a probe has to say it is open —
// which is itself worth demonstrating: these routes started returning 401 the
// moment the global AuthGuard was registered, exactly as intended.
@Public()
class ProbeController {
  @Get()
  versioned() {
    return { ok: true }
  }

  @Post("echo")
  echo(@Body() body: unknown) {
    return { received: body }
  }

  /** Mirrors what /auth/login will carry. */
  @Post("login")
  @AuthThrottle()
  login() {
    return { ok: true }
  }
}

const BODY_LIMIT = "256kb"

describe("foundation", () => {
  let app: NestExpressApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile()

    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false })

    // Mirrors main.ts. Kept in step deliberately: if the two drift, this suite
    // stops testing what actually runs.
    app.setGlobalPrefix("api")
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" })
    app.set("trust proxy", 1)
    app.use(cookieParser(env.SESSION_SECRET))
    app.disable("x-powered-by")
    app.use(express.json({ limit: BODY_LIMIT }))
    app.use(express.urlencoded({ extended: false, limit: BODY_LIMIT }))
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
  })

  afterAll(async () => {
    await app?.close()
  })

  /* ------------------------------------------------------------ versioning */

  it("serves the API under /api/v1", async () => {
    await request(app.getHttpServer()).get("/api/v1/probe").expect(200, { ok: true })
  })

  it("does not serve a versioned route without its version", async () => {
    await request(app.getHttpServer()).get("/api/probe").expect(404)
  })

  it("keeps health version-neutral, so a probe survives a version bump", async () => {
    const res = await request(app.getHttpServer()).get("/api/health").expect(200)
    expect(res.body).toMatchObject({ ok: true, service: "stayora-api" })
    // ...and it must NOT also appear under the version.
    await request(app.getHttpServer()).get("/api/v1/health").expect(404)
  })

  /* ----------------------------------------------------------- request ids */

  it("issues a request id when the caller sends none", async () => {
    const res = await request(app.getHttpServer()).get("/api/health").expect(200)
    expect(res.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it("honours a caller's id so a trace can span the proxy", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/health")
      .set("x-request-id", "trace-abc-123")
      .expect(200)
    expect(res.headers["x-request-id"]).toBe("trace-abc-123")
  })

  it("refuses an id that could forge log lines", async () => {
    // The value is echoed into a header AND written into every log line. A
    // newline here would let a caller inject fabricated entries.
    const res = await request(app.getHttpServer())
      .get("/api/health")
      .set("x-request-id", "abc def")
      .expect(200)
    expect(res.headers["x-request-id"]).not.toBe("abc def")
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("refuses an absurdly long id", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/health")
      .set("x-request-id", "a".repeat(500))
      .expect(200)
    expect(res.headers["x-request-id"]).toHaveLength(36)
  })

  /* --------------------------------------------------------------- headers */

  it("does not advertise the server framework", async () => {
    const res = await request(app.getHttpServer()).get("/api/health").expect(200)
    expect(res.headers["x-powered-by"]).toBeUndefined()
  })

  /* ------------------------------------------------------------ body limit */

  it("accepts a normal body", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/probe/echo")
      .send({ hello: "world" })
      .expect(201)
  })

  it("refuses a body over the limit (API4)", async () => {
    // 512 KB against a 256 KB cap.
    const huge = { blob: "x".repeat(512 * 1024) }
    const res = await request(app.getHttpServer()).post("/api/v1/probe/echo").send(huge)
    expect(res.status).toBe(413)
  })

  /* --------------------------------------------------------- rate limiting */

  it("rate-limits the auth bucket at 5 a minute (API4)", async () => {
    const server = app.getHttpServer()
    const statuses: number[] = []
    for (let i = 0; i < 7; i++) {
      const res = await request(server)
        .post("/api/v1/probe/login")
        // A distinct client, so this test cannot be tripped by its neighbours.
        .set("x-forwarded-for", "203.0.113.10")
      statuses.push(res.status)
    }
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true)
    expect(statuses[5]).toBe(429)
    expect(statuses[6]).toBe(429)
  })

  it("keys the limit on the forwarded client, not the proxy", async () => {
    // Without this, every guest behind the Next proxy shares one bucket and
    // the first noisy client locks the whole platform out.
    const server = app.getHttpServer()
    for (let i = 0; i < 6; i++) {
      await request(server).post("/api/v1/probe/login").set("x-forwarded-for", "203.0.113.20")
    }
    // A different client is untouched by the first one's exhaustion.
    await request(server)
      .post("/api/v1/probe/login")
      .set("x-forwarded-for", "203.0.113.21")
      .expect(201)
  })

  it("never rate-limits the health probe", async () => {
    // A liveness check hitting its own limit would report a healthy service
    // as down.
    const server = app.getHttpServer()
    for (let i = 0; i < 30; i++) {
      await request(server).get("/api/health").set("x-forwarded-for", "203.0.113.30").expect(200)
    }
  })

  /* ------------------------------------------------------------ error shape */

  it("returns one error shape for an unknown route", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/nope").expect(404)
    expect(res.body).toMatchObject({
      statusCode: 404,
      code: "not_found",
      path: "/api/v1/nope",
    })
    expect(typeof res.body.message).toBe("string")
  })
})
