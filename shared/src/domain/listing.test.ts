import { describe, expect, it } from "vitest"

import {
  isPublishable,
  MATERIAL_FIELDS,
  materialChanges,
  needsReview,
  photoRejection,
  PHOTO_LIMITS,
  PUBLISH_MINIMUM,
  publishGaps,
} from "./listing"

const complete = {
  rooms: 1,
  ratePlans: 1,
  photos: 5,
  description: "x".repeat(PUBLISH_MINIMUM.descriptionChars),
}

describe("publishGaps (rule #70)", () => {
  it("lets a complete listing through", () => {
    expect(publishGaps(complete)).toEqual([])
    expect(isPublishable(complete)).toBe(true)
  })

  /*
   * Every gap, not the first. A partner told "you need photos", who adds
   * photos and is then told "you need a rate plan", learns the system will
   * keep finding new reasons — and that is how a listing gets abandoned.
   */
  it("reports every gap at once, not one at a time", () => {
    const gaps = publishGaps({ rooms: 0, ratePlans: 0, photos: 0, description: "" })
    expect(gaps.map((g) => g.code)).toEqual(["rooms", "rate_plans", "photos", "description"])
  })

  it("says how many are needed and how many there are", () => {
    const [gap] = publishGaps({ ...complete, photos: 2 })
    expect(gap).toEqual({ code: "photos", need: 5, have: 2 })
  })

  it("does not count whitespace as a description", () => {
    const gaps = publishGaps({ ...complete, description: "   \n\t  " })
    expect(gaps.map((g) => g.code)).toEqual(["description"])
  })

  it("accepts exactly the minimum", () => {
    expect(isPublishable({ rooms: 1, ratePlans: 1, photos: 5, description: "y".repeat(120) })).toBe(
      true
    )
  })
})

describe("materialChanges (rule #71)", () => {
  it("catches a change to a field the guest chooses on", () => {
    expect(materialChanges({ name: "The Plaza" }, { name: "The Plaza Hotel" })).toEqual(["name"])
  })

  /*
   * The check that keeps partners editing their listings. A form that
   * re-submits every field on every save would otherwise send a listing back
   * to review for a change nobody made.
   */
  it("ignores a field re-submitted with the same value", () => {
    expect(materialChanges({ name: "The Plaza", stars: 5 }, { name: "The Plaza", stars: 5 })).toEqual(
      []
    )
  })

  it("treats null and empty string as the same absence", () => {
    expect(materialChanges({ address: null }, { address: "" })).toEqual([])
  })

  it("ignores fields the patch does not mention", () => {
    expect(materialChanges({ name: "A", city: "B" }, { city: "B" })).toEqual([])
  })

  it("reports several at once", () => {
    expect(
      materialChanges({ name: "A", city: "B", stars: 4 }, { name: "Z", city: "Y", stars: 5 })
    ).toEqual(["name", "city", "stars"])
  })

  /*
   * The levers a property pulls daily. A hotel that could not reprice a
   * Friday night without an approval would stop using the extranet.
   */
  it("leaves the daily levers alone", () => {
    for (const field of ["basePrice", "checkInTime", "timezone", "status", "description"]) {
      expect(MATERIAL_FIELDS as readonly string[]).not.toContain(field)
    }
  })
})

describe("needsReview (rules #71, #72)", () => {
  it("sends a live listing's material edit back for approval", () => {
    expect(
      needsReview({ status: "active", current: { name: "A" }, patch: { name: "B" } })
    ).toBe(true)
  })

  it("lets a live listing's ordinary edit through immediately", () => {
    expect(
      needsReview({ status: "active", current: { name: "A" }, patch: { description: "new" } })
    ).toBe(false)
  })

  /* Nothing is published yet, so there is nothing to protect. */
  it("never asks a draft for approval", () => {
    expect(needsReview({ status: "draft", current: { name: "A" }, patch: { name: "B" } })).toBe(
      false
    )
  })

  it("never asks a listing that was sent back for changes", () => {
    expect(
      needsReview({ status: "changes_requested", current: { name: "A" }, patch: { name: "B" } })
    ).toBe(false)
  })
})

describe("photoRejection (rule #73)", () => {
  const ok = { contentType: "image/jpeg", bytes: 1_000_000, existing: 0 }

  it("accepts an ordinary photo", () => {
    expect(photoRejection(ok)).toBeNull()
  })

  it("accepts every format the product allows", () => {
    for (const contentType of PHOTO_LIMITS.contentTypes) {
      expect(photoRejection({ ...ok, contentType })).toBeNull()
    }
  })

  it("refuses anything that is not one of those three", () => {
    expect(photoRejection({ ...ok, contentType: "image/gif" })).toBe("type")
    expect(photoRejection({ ...ok, contentType: "application/pdf" })).toBe("type")
    // The classic: an executable renamed, announced as an image it is not.
    expect(photoRejection({ ...ok, contentType: "text/html" })).toBe("type")
  })

  it("refuses a file over the size limit", () => {
    expect(photoRejection({ ...ok, bytes: PHOTO_LIMITS.maxBytes + 1 })).toBe("too_large")
  })

  it("accepts a file exactly at the limit", () => {
    expect(photoRejection({ ...ok, bytes: PHOTO_LIMITS.maxBytes })).toBeNull()
  })

  it("refuses a zero-byte or negative upload", () => {
    expect(photoRejection({ ...ok, bytes: 0 })).toBe("too_large")
    expect(photoRejection({ ...ok, bytes: -1 })).toBe("too_large")
  })

  it("refuses once the gallery is full", () => {
    expect(photoRejection({ ...ok, existing: PHOTO_LIMITS.max })).toBe("too_many")
    expect(photoRejection({ ...ok, existing: PHOTO_LIMITS.max - 1 })).toBeNull()
  })

  /* Type is checked first: a 200MB HTML file is refused for what it is. */
  it("names the type problem even when the size is also wrong", () => {
    expect(photoRejection({ contentType: "text/html", bytes: 99_000_000, existing: 0 })).toBe("type")
  })
})
