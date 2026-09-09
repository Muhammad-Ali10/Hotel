import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common"
import { Injectable } from "@nestjs/common"
import { map, type Observable } from "rxjs"

/* ============================================================================
 * Timestamps leave this API as ISO 8601. Always.
 *
 * Postgres renders a `timestamptz` as `2026-08-21 13:15:28.785077+00` — a
 * space instead of `T`, `+00` instead of `Z`. Drizzle's `mode: "string"` hands
 * that text through untouched and `JSON.stringify` puts it on the wire
 * verbatim, so every timestamp this API has ever returned has been in that
 * shape.
 *
 * It looked fine because it IS fine in V8: Node and Chrome parse the space form
 * through implementation-defined fallback. That form is **outside the
 * ECMAScript Date Time String Format**, so no other engine is obliged to —
 * Safari has historically answered `Invalid Date` for exactly this.
 *
 * The proof that settles it is closer to home: `z.iso.datetime()` REJECTS it.
 * The shared contracts would refuse this API's own output the moment anything
 * validated a response.
 *
 * Five hundred tests never caught it, because tests compare these strings to
 * other strings and never ask a browser to parse one.
 *
 * ── Why here, and not somewhere better ──────────────────────────────────────
 *
 * **At the driver** was the first attempt and it cannot work: drizzle-orm's
 * node-postgres session installs its own `getTypeParser` on every query and
 * hard-codes `(val) => val` for TIMESTAMPTZ, TIMESTAMP, DATE and INTERVAL. A
 * global `types.setTypeParser` is overridden before it is ever consulted.
 *
 * **In the schema**, as a `customType` per column, is the most principled
 * place — but the timestamp columns are scattered across eleven modules, and
 * one missed column fails silently in exactly the way this bug already did.
 *
 * **In each DTO** is reliable only for as long as everybody remembers, in
 * every module written from here on. That is not an invariant, it is a habit.
 *
 * So: at the wire, which is the only place the guarantee actually has to hold,
 * and the one place it cannot be forgotten.
 * ========================================================================== */

/**
 * Postgres's timestamp rendering, and nothing else.
 *
 * Anchored, and a TIME PART IS REQUIRED. That second condition is what keeps a
 * plain `2026-08-21` — a check-in date — from being touched: a calendar day is
 * not an instant, and promoting it to `2026-08-21T00:00:00Z` invites a client
 * to render it in local time and show the guest the wrong day. That is the
 * oldest way there is to get hotel dates wrong.
 */
const PG_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}(:?\d{2})?)?$/

/** Depth cap, so a cyclic or pathological payload cannot spin here. */
const MAX_DEPTH = 12

@Injectable()
export class IsoTimestampsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((body) => normalise(body, 0)))
  }
}

function normalise(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return value

  if (typeof value === "string") {
    if (!PG_TIMESTAMP.test(value)) return value
    const parsed = new Date(value)
    // Unparseable text that merely looks like a timestamp is returned as it
    // came. Delivering `"Invalid Date"` would look like corrupted data.
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
  }

  if (Array.isArray(value)) return value.map((item) => normalise(item, depth + 1))

  /*
   * Only plain objects are walked. A `Date`, a `Buffer` or a stream is left
   * exactly as it is — rebuilding one of those from its enumerable keys would
   * quietly destroy it, and a file download is not a thing to guess at.
   */
  if (value !== null && typeof value === "object" && isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) out[key] = normalise(item, depth + 1)
    return out
  }

  return value
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}
