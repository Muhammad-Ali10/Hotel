import { of } from "rxjs"
import { describe, expect, it } from "vitest"

import { IsoTimestampsInterceptor } from "./iso-timestamps.interceptor"

/**
 * The wire format guarantee.
 *
 * These run against the interceptor directly rather than through HTTP: the
 * question is what the transformation does to a shape, and a full app would
 * only make the same assertions slower and less specific. `analytics.e2e` and
 * `bookings.e2e` cover it end to end.
 */
function through(body: unknown): unknown {
  const interceptor = new IsoTimestampsInterceptor()
  let out: unknown
  interceptor
    // The interceptor never touches the context.
    .intercept({} as never, { handle: () => of(body) })
    .subscribe((value) => {
      out = value
    })
  return out
}

const PG = "2026-08-21 13:15:28.785077+00"
const ISO = "2026-08-21T13:15:28.785Z"

describe("ISO timestamps on the wire", () => {
  it("rewrites Postgres's rendering into ISO 8601", () => {
    expect(through({ createdAt: PG })).toEqual({ createdAt: ISO })
  })

  /*
   * The condition that matters most. A check-in is a calendar DAY, not an
   * instant — promoting it to midnight UTC invites a client to render it in
   * local time and show the guest the wrong day, which is the oldest way there
   * is to get hotel dates wrong.
   */
  it("leaves a plain calendar date completely alone", () => {
    expect(through({ checkIn: "2026-08-21", checkOut: "2026-08-24" })).toEqual({
      checkIn: "2026-08-21",
      checkOut: "2026-08-24",
    })
  })

  it("leaves a value that is already ISO alone", () => {
    expect(through({ expiresAt: ISO })).toEqual({ expiresAt: ISO })
  })

  it("reaches timestamps nested inside objects and arrays", () => {
    expect(
      through({
        items: [{ booking: { createdAt: PG } }, { booking: { createdAt: PG } }],
        meta: { generatedAt: PG },
      })
    ).toEqual({
      items: [{ booking: { createdAt: ISO } }, { booking: { createdAt: ISO } }],
      meta: { generatedAt: ISO },
    })
  })

  it("passes null and undefined through untouched", () => {
    expect(through({ cancelledAt: null, roomNo: undefined })).toEqual({
      cancelledAt: null,
      roomNo: undefined,
    })
  })

  it("does not touch numbers, which is where money lives", () => {
    expect(through({ total: 217_500, nights: 3 })).toEqual({ total: 217_500, nights: 3 })
  })

  /*
   * The regex is anchored and requires a time part, so ordinary text cannot
   * be caught by it however much it resembles a date.
   */
  it("does not touch prose that merely mentions a date", () => {
    const body = {
      caption: "Rooftop bar, 2026-08-21 was the opening",
      note: "Arriving 2026-08-21 13:15",
      title: "2026-08-21 13:15:28.785077+00 and then some",
    }
    expect(through(body)).toEqual(body)
  })

  it("handles a bare string response", () => {
    expect(through(PG)).toBe(ISO)
  })

  it("handles a top-level array", () => {
    expect(through([{ createdAt: PG }])).toEqual([{ createdAt: ISO }])
  })

  /*
   * A stream or a Buffer must survive untouched — rebuilding one from its
   * enumerable keys would quietly destroy it, and a file download is not a
   * thing to guess at.
   */
  it("leaves non-plain objects exactly as they are", () => {
    const buffer = Buffer.from("hello")
    expect(through(buffer)).toBe(buffer)

    const date = new Date(ISO)
    expect(through(date)).toBe(date)
  })

  it("accepts the offset with a colon, which Postgres also produces", () => {
    expect(through({ at: "2026-08-21 13:15:28+05:30" })).toEqual({
      at: "2026-08-21T07:45:28.000Z",
    })
  })

  it("accepts a timestamp with no fractional seconds", () => {
    expect(through({ at: "2026-08-21 13:15:28+00" })).toEqual({
      at: "2026-08-21T13:15:28.000Z",
    })
  })

  /*
   * Unparseable text that merely matches the shape is returned as it came.
   * Delivering `"Invalid Date"` would look like corrupted data, which is worse
   * than delivering something a client can at least see and report.
   */
  it("returns text it cannot parse rather than inventing an error value", () => {
    const impossible = "2026-13-45 99:99:99+00"
    expect(through({ at: impossible })).toEqual({ at: impossible })
  })
})
