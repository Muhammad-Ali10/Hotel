import { Controller, Get, Inject, VERSION_NEUTRAL } from "@nestjs/common"
import { SkipThrottle } from "@nestjs/throttler"
import { sql } from "drizzle-orm"

import { Public } from "../../common/auth/decorators"
import { DRIZZLE, type Database } from "../../db/drizzle.module"
import { env } from "../../config/env"

/**
 * Infrastructure, not API — hence `VERSION_NEUTRAL`: an orchestrator's probe
 * should not have to know which API version is current, and these routes must
 * keep working across a version bump.
 *
 * Throttling is skipped because a liveness probe hitting its own rate limit
 * would report a healthy service as down.
 */
@Controller({ path: "health", version: VERSION_NEUTRAL })
@SkipThrottle()
// An orchestrator's probe has no session and never will.
@Public()
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Liveness — is the process up. Never touches the database. */
  @Get()
  liveness() {
    return {
      ok: true,
      service: "stayora-api",
      env: env.NODE_ENV,
      version: process.env.npm_package_version ?? "0.0.0",
      /** Set by CI at build time; absent locally. */
      commit: process.env.GIT_COMMIT ?? null,
      uptime: Math.round(process.uptime()),
    }
  }

  /** Readiness — can we actually reach Postgres. */
  @Get("db")
  async readiness() {
    const startedAt = process.hrtime.bigint()
    try {
      await this.db.execute(sql`select 1`)
      const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000
      return { ok: true, latencyMs: Math.round(ms) }
    } catch (error) {
      return { ok: false, error: rootCause(error) }
    }
  }
}

/**
 * Drizzle wraps driver failures, so the top-level message is only ever
 * "Failed query: select 1". The useful part — ECONNREFUSED, password
 * authentication failed, database does not exist — sits further down the
 * `cause` chain.
 *
 * A refused connection to `localhost` arrives as an AggregateError with an
 * empty message: node tried both IPv4 and IPv6 and collected one error per
 * address. The real reason is inside `.errors`.
 */
function rootCause(error: unknown): string {
  let current: unknown = error

  for (let depth = 0; depth < 10; depth++) {
    if (current instanceof AggregateError && current.errors.length > 0) {
      current = current.errors[0]
      continue
    }
    if (current instanceof Error && current.cause !== undefined) {
      current = current.cause
      continue
    }
    break
  }

  if (current instanceof Error) {
    const code = (current as NodeJS.ErrnoException).code
    return current.message || code || current.name
  }
  return typeof current === "string" && current ? current : "unknown database error"
}
