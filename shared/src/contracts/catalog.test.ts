import { describe, expect, it } from "vitest"

import {
  RATE_PLAN_TERMS_FIELDS,
  ratePlanCreateSchema,
  ratePlanUpdateSchema,
  roomUpdateSchema,
} from "./catalog"

const validPlan = {
  name: "Flexible",
  basePrice: 72_500,
  cancelFreeUntil: "48h",
  cancelCharge: "percent",
  cancelChargeValue: 50,
}

describe("ratePlanCreateSchema", () => {
  it("accepts a plan whose charge and value agree", () => {
    expect(ratePlanCreateSchema.safeParse(validPlan).success).toBe(true)
  })

  it("refuses a percentage charge with no number", () => {
    // It would charge 0% and read as a working policy.
    const result = ratePlanCreateSchema.safeParse({ ...validPlan, cancelChargeValue: null })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["cancelChargeValue"])
  })

  it("refuses a value on a charge that is not a percentage", () => {
    const result = ratePlanCreateSchema.safeParse({
      ...validPlan,
      cancelCharge: "full",
      cancelChargeValue: 50,
    })
    expect(result.success).toBe(false)
  })

  it("applies the same pairing rule to the no-show terms (rule #47)", () => {
    expect(
      ratePlanCreateSchema.safeParse({ ...validPlan, noShowCharge: "percent" }).success
    ).toBe(false)
    expect(
      ratePlanCreateSchema.safeParse({
        ...validPlan,
        noShowCharge: "percent",
        noShowChargeValue: 100,
      }).success
    ).toBe(true)
  })

  it("refuses a no-show value with no no-show charge", () => {
    const result = ratePlanCreateSchema.safeParse({ ...validPlan, noShowChargeValue: 100 })
    expect(result.success).toBe(false)
  })

  it("refuses a non-refundable rate that takes no money up front (rule #42)", () => {
    // The database refuses it too; catching it here names the field.
    const result = ratePlanCreateSchema.safeParse({
      ...validPlan,
      cancelFreeUntil: "non_refundable",
      cancelCharge: "full",
      cancelChargeValue: null,
      paymentMode: "guarantee",
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["paymentMode"])
  })

  it("refuses a field nobody declared", () => {
    expect(
      ratePlanCreateSchema.safeParse({ ...validPlan, commissionRateBps: 0 }).success
    ).toBe(false)
  })

  it("defaults a plan that says nothing about no-shows to saying nothing", () => {
    const parsed = ratePlanCreateSchema.parse(validPlan)
    expect(parsed.noShowCharge).toBeNull()
    expect(parsed.paymentMode).toBe("prepay")
  })
})

describe("ratePlanUpdateSchema", () => {
  it("accepts a change to one field alone", () => {
    expect(ratePlanUpdateSchema.safeParse({ basePrice: 80_000 }).success).toBe(true)
    expect(ratePlanUpdateSchema.safeParse({}).success).toBe(true)
  })

  it("carries ONLY the keys that were sent", () => {
    /*
     * The bug this exists for: a `.default()` survives `.partial()`.
     *
     * With defaults left on the shared shape, a PATCH of the price alone
     * arrived carrying `paymentMode: "prepay"`, `inclusions: []` and
     * `status: "active"` — which silently reset the plan's terms, wiped what it
     * included, and un-archived it. Asserting `.success` did not notice; only
     * looking at the parsed keys does.
     */
    const parsed = ratePlanUpdateSchema.parse({ basePrice: 80_000 })
    expect(Object.keys(parsed)).toEqual(["basePrice"])

    expect(Object.keys(ratePlanUpdateSchema.parse({}))).toEqual([])
  })

  it("still checks the pair when only half of it is sent", () => {
    // `.partial()` before `.superRefine()` is what keeps this working: a
    // request that switches to `percent` and forgets the number is refused
    // here rather than at the table.
    expect(ratePlanUpdateSchema.safeParse({ cancelCharge: "percent" }).success).toBe(false)
    expect(
      ratePlanUpdateSchema.safeParse({ cancelCharge: "percent", cancelChargeValue: 25 }).success
    ).toBe(true)
  })

  it("refuses an unknown field on an update too", () => {
    expect(ratePlanUpdateSchema.safeParse({ roomId: "x" }).success).toBe(false)
  })
})

describe("RATE_PLAN_TERMS_FIELDS", () => {
  it("names every promise, and no price", () => {
    // Derived from the shape, so a term added tomorrow is admin-only from the
    // moment it exists rather than the day somebody remembers this list.
    expect([...RATE_PLAN_TERMS_FIELDS].sort()).toEqual(
      [
        "cancelCharge",
        "cancelChargeValue",
        "cancelFreeUntil",
        "noShowCharge",
        "noShowChargeValue",
        "paymentMode",
      ].sort()
    )
    expect(RATE_PLAN_TERMS_FIELDS).not.toContain("basePrice")
  })
})

describe("roomUpdateSchema", () => {
  it("accepts one field at a time", () => {
    expect(roomUpdateSchema.safeParse({ units: 4 }).success).toBe(true)
    expect(roomUpdateSchema.safeParse({ status: "archived" }).success).toBe(true)
  })

  it("carries ONLY the keys that were sent", () => {
    // Same trap: patching `units` used to arrive with `description: ""` and
    // `features: []` attached, and wipe both.
    expect(Object.keys(roomUpdateSchema.parse({ units: 4 }))).toEqual(["units"])
  })

  it("refuses a negative unit count", () => {
    expect(roomUpdateSchema.safeParse({ units: -1 }).success).toBe(false)
  })

  it("has no delete, only archive", () => {
    expect(roomUpdateSchema.safeParse({ status: "deleted" }).success).toBe(false)
  })

  it("refuses the fields a property does not own", () => {
    // `propertyId` would move a room to a competitor's hotel.
    expect(roomUpdateSchema.safeParse({ propertyId: "x" }).success).toBe(false)
    expect(roomUpdateSchema.safeParse({ seed: "x" }).success).toBe(false)
  })
})
