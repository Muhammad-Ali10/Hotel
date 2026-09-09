import { describe, expect, it } from "vitest"

import {
  BOOKING_REF_ALPHABET,
  formatTicketRef,
  isValidBookingRef,
  isValidTicketRef,
  makeBookingRef,
} from "./refs"

describe("BOOKING_REF_ALPHABET", () => {
  it("omits the characters that are misread aloud", () => {
    // STY-1O0I has no unambiguous reading down a phone line.
    for (const ch of ["I", "O", "0", "1"]) {
      expect(BOOKING_REF_ALPHABET).not.toContain(ch)
    }
    expect(BOOKING_REF_ALPHABET).toHaveLength(32)
  })
})

describe("makeBookingRef", () => {
  it("produces the STY-XXXXXX shape", () => {
    expect(isValidBookingRef(makeBookingRef())).toBe(true)
  })

  it("is deterministic when the source of randomness is", () => {
    const fixed = () => 0
    expect(makeBookingRef(fixed)).toBe("STY-AAAAAA")
  })

  it("does not run off the end of the alphabet when random() returns 1", () => {
    // Math.random() never returns exactly 1, but an injected source might, and
    // an out-of-range index would silently produce "undefined" in the ref.
    expect(makeBookingRef(() => 1)).toBe("STY-999999")
  })

  it("only ever emits characters from the alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const ref = makeBookingRef()
      for (const ch of ref.slice(4)) expect(BOOKING_REF_ALPHABET).toContain(ch)
    }
  })
})

describe("isValidBookingRef", () => {
  it("rejects anything that is not the exact shape", () => {
    expect(isValidBookingRef("STY-K7M2QX")).toBe(true)
    expect(isValidBookingRef("STY-K7M2Q")).toBe(false) // too short
    expect(isValidBookingRef("STY-K7M2QXX")).toBe(false) // too long
    expect(isValidBookingRef("sty-k7m2qx")).toBe(false) // lower case
    expect(isValidBookingRef("STY-K7M2Q0")).toBe(false) // excluded character
    expect(isValidBookingRef("TKT-000123")).toBe(false)
  })
})

describe("formatTicketRef", () => {
  it("pads a sequence to a stable width (rule #8)", () => {
    expect(formatTicketRef(1)).toBe("TKT-000001")
    expect(formatTicketRef(123)).toBe("TKT-000123")
  })

  it("keeps growing past six digits rather than truncating", () => {
    expect(formatTicketRef(1_234_567)).toBe("TKT-1234567")
  })

  it("refuses a sequence that cannot have come from a database", () => {
    expect(() => formatTicketRef(0)).toThrow(RangeError)
    expect(() => formatTicketRef(-1)).toThrow(RangeError)
    expect(() => formatTicketRef(1.5)).toThrow(RangeError)
  })

  it("has no random variant — a sequence cannot collide", () => {
    // The prototype drew TKT-1000…9999 at random with no uniqueness check:
    // 9,000 values, so past ~100 tickets a clash was more likely than not.
    expect(isValidTicketRef(formatTicketRef(42))).toBe(true)
    expect(isValidTicketRef("TKT-4821")).toBe(false) // the old 4-digit shape
  })
})
