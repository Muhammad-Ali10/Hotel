import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { sql } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { PostgresThrottlerStorage } from "../src/common/throttling/postgres-throttler.storage"
import { env } from "../src/config/env"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"

/* ============================================================================
 * The rate limiter's counters live in Postgres, not in this process.
 *
 * The whole point is what happens with more than one instance, and that is the
 * one thing a single-process test cannot show by making requests. So the
 * storage is exercised DIRECTLY as well: two callers sharing a key is exactly
 * what two containers sharing a database are.
 * ========================================================================== */

describe("rate limiting (shared counters)", () => {
  let app: NestExpressApplication
  let db: Database
  let storage: PostgresThrottlerStorage

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
    storage = moduleRef.get(PostgresThrottlerStorage)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM rate_limits`)
    await app?.close()
  })

  beforeEach(() => db.execute(sql`DELETE FROM rate_limits`))

  const server = () => app.getHttpServer()

  /** `db.execute` answers differently across drivers; read it in one place. */
  async function countRows(): Promise<number> {
    const result = (await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM rate_limits`
    )) as unknown as { rows?: { n: number }[] } | { n: number }[]
    const rows = Array.isArray(result) ? result : (result.rows ?? [])
    return Number(rows[0]?.n ?? 0)
  }

  /* ------------------------------------------------------------- the store */

  it("counts, and keeps counting across callers sharing a key", async () => {
    const key = `test:${Date.now()}`

    const first = await storage.increment(key, 60_000, 5, 0, "default")
    expect(first.totalHits).toBe(1)

    /*
     * Two instances hitting the same key. In the in-memory store each would
     * start from one and the limit would be twice what it says.
     */
    const second = await storage.increment(key, 60_000, 5, 0, "default")
    const third = await storage.increment(key, 60_000, 5, 0, "default")

    expect(second.totalHits).toBe(2)
    expect(third.totalHits).toBe(3)
  })

  it("counts concurrent callers exactly, with no lost updates", async () => {
    const key = `race:${Date.now()}`

    /*
     * The reason this is one statement rather than a read and a write. Twenty
     * at once through a read-then-write would land somewhere under twenty —
     * and would do it precisely under the load an attacker creates.
     */
    const results = await Promise.all(
      Array.from({ length: 20 }, () => storage.increment(key, 60_000, 100, 0, "default"))
    )

    const counts = results.map((r) => r.totalHits).sort((a, b) => a - b)
    expect(counts).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it("starts again when the window has closed", async () => {
    const key = `window:${Date.now()}`

    await storage.increment(key, 50, 5, 0, "default")
    const before = await storage.increment(key, 50, 5, 0, "default")
    expect(before.totalHits).toBe(2)

    await new Promise((resolve) => setTimeout(resolve, 120))

    const after = await storage.increment(key, 50, 5, 0, "default")
    expect(after.totalHits).toBe(1)
  })

  it("holds a block past the end of the window", async () => {
    const key = `block:${Date.now()}`

    // Limit 2, so the third call trips the block.
    await storage.increment(key, 50, 2, 5_000, "default")
    await storage.increment(key, 50, 2, 5_000, "default")
    const tripped = await storage.increment(key, 50, 2, 5_000, "default")
    expect(tripped.isBlocked).toBe(true)

    /*
     * The window is 50ms and the block is five seconds. A block that ended
     * with the window would let a caller who is over the limit back in on the
     * next tick, which is the opposite of what a block is for.
     */
    await new Promise((resolve) => setTimeout(resolve, 120))

    const still = await storage.increment(key, 50, 2, 5_000, "default")
    expect(still.isBlocked).toBe(true)
  })

  it("forgets counters nobody will read again", async () => {
    await db.execute(sql`
      INSERT INTO rate_limits (key, hits, expires_at, blocked_until)
      VALUES ('stale', 9, now() - interval '1 hour', NULL)
    `)

    expect(await countRows()).toBe(1)

    const removed = await storage.sweep()
    expect(removed).toBeGreaterThanOrEqual(1)
    expect(await countRows()).toBe(0)
  })

  /* -------------------------------------------------------- through an API */

  it("refuses a caller who is over the limit, and only that caller", async () => {
    const attacker = "203.0.113.7"
    const bystander = "203.0.113.8"

    /*
     * Login is the tightest bucket in the product (5/min) because it is the
     * one an attacker walks a password list through.
     */
    let refused = 0
    for (let i = 0; i < 8; i++) {
      const res = await request(server())
        .post("/api/v1/auth/login")
        .set("x-forwarded-for", attacker)
        .send({ email: "nobody@example.test", password: "wrong password here" })
      if (res.status === 429) refused += 1
    }
    expect(refused).toBeGreaterThan(0)

    /* A limiter that blocks everyone because one caller misbehaved is an outage. */
    const other = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", bystander)
      .send({ email: "nobody@example.test", password: "wrong password here" })
    expect(other.status).not.toBe(429)
  })

  it("writes the counter where another instance would find it", async () => {
    /*
     * The row is the whole point: an in-memory store would serve this request
     * identically and leave the table empty, and the next instance would start
     * its own count from one.
     *
     * Matched on the throttler name rather than the address — the guard hashes
     * the tracker into the key, so the IP never appears in it.
     */
    await request(server())
      .get("/api/v1/destinations")
      .set("x-forwarded-for", "203.0.113.9")
      .expect(200)

    expect(await countRows()).toBeGreaterThan(0)
  })
})
