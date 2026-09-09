import { describe, expect, it } from "vitest"

import type { Review, ReviewCategories, ReviewStatus } from "../types/review"
import {
  REVIEW_WINDOW_DAYS,
  canReview,
  categoryAverage,
  deriveRating,
  emptyRating,
  isValidCategories,
  isValidRating,
  isVerified,
  ratingFromTotals,
} from "./reviews"

const cats = (v: number): ReviewCategories => ({
  cleanliness: v,
  comfort: v,
  location: v,
  facilities: v,
  staff: v,
})

const review = (rating: number, status: ReviewStatus = "published") => ({
  status,
  rating,
  categories: cats(rating),
})

describe("deriveRating", () => {
  it("returns an empty rating when there is nothing published", () => {
    expect(deriveRating([])).toEqual({
      rating: 0,
      reviewCount: 0,
      categories: cats(0),
    })
  })

  it("averages the published reviews to one decimal place", () => {
    const rating = deriveRating([review(5), review(4), review(4)])
    expect(rating.rating).toBe(4.3) // 13/3 = 4.333…
    expect(rating.reviewCount).toBe(3)
  })

  it("excludes everything a moderator has not cleared", () => {
    // A pending or flagged review must not move a property up the listings
    // while it waits — and a rejected one never should.
    const rating = deriveRating([
      review(5),
      review(1, "pending"),
      review(1, "flagged"),
      review(1, "rejected"),
      review(1, "withdrawn"),
    ])
    expect(rating.rating).toBe(5)
    expect(rating.reviewCount).toBe(1)
  })

  it("drops a withdrawn review from the average at once (rule #41)", () => {
    const before = deriveRating([review(5), review(1)])
    expect(before).toMatchObject({ rating: 3, reviewCount: 2 })

    const after = deriveRating([review(5), review(1, "withdrawn")])
    expect(after).toMatchObject({ rating: 5, reviewCount: 1 })
  })

  it("averages each category independently", () => {
    const rating = deriveRating([
      { status: "published", rating: 5, categories: { ...cats(5), location: 3 } },
      { status: "published", rating: 4, categories: { ...cats(4), location: 4 } },
    ])
    expect(rating.categories.cleanliness).toBe(4.5)
    expect(rating.categories.location).toBe(3.5)
  })

  it("counts only published reviews, not all of them", () => {
    const rating = deriveRating([review(5), review(5, "pending"), review(5, "pending")])
    expect(rating.reviewCount).toBe(1)
  })
})

describe("ratingFromTotals", () => {
  it("matches deriveRating on the same reviews", () => {
    // The API sums in SQL and calls this; deriveRating counts rows and calls
    // the same function. If these two ever disagree, a property's rating
    // depends on which code path asked for it.
    const reviews = [review(5), review(4), review(4)]
    const totals = {
      reviewCount: reviews.length,
      ratingSum: reviews.reduce((sum, r) => sum + r.rating, 0),
      categorySums: {
        cleanliness: reviews.reduce((sum, r) => sum + r.categories.cleanliness, 0),
        comfort: reviews.reduce((sum, r) => sum + r.categories.comfort, 0),
        location: reviews.reduce((sum, r) => sum + r.categories.location, 0),
        facilities: reviews.reduce((sum, r) => sum + r.categories.facilities, 0),
        staff: reviews.reduce((sum, r) => sum + r.categories.staff, 0),
      },
    }

    expect(ratingFromTotals(totals)).toEqual(deriveRating(reviews))
    expect(ratingFromTotals(totals).rating).toBe(4.3)
  })

  it("treats a category SQL summed as NULL the same as a missing one", () => {
    // SUM skips NULLs, so an absent key arrives as 0 — which is what the
    // in-memory path does with `?? 0`. The two must not diverge here.
    const rating = ratingFromTotals({
      reviewCount: 2,
      ratingSum: 8,
      categorySums: { cleanliness: 8 },
    })
    expect(rating).toMatchObject({ rating: 4, reviewCount: 2 })
    expect(rating.categories).toEqual({
      cleanliness: 4,
      comfort: 0,
      location: 0,
      facilities: 0,
      staff: 0,
    })
  })

  it("is empty when nothing is published", () => {
    expect(ratingFromTotals({ reviewCount: 0, ratingSum: 0, categorySums: {} })).toEqual(
      emptyRating()
    )
  })
})

describe("categoryAverage", () => {
  it("averages one review's five categories", () => {
    expect(categoryAverage(cats(4))).toBe(4)
    expect(categoryAverage({ ...cats(5), staff: 3 })).toBe(4.6) // 23/5
  })
})

describe("canReview", () => {
  const stayed = { status: "completed" as const, checkOut: "2026-08-15" }

  it("allows a completed stay inside the window", () => {
    expect(canReview(stayed, { today: "2026-08-20", alreadyReviewed: false })).toEqual({
      ok: true,
    })
  })

  it("refuses a stay that has not happened", () => {
    // Otherwise a booking could be rated before, or instead of, being taken.
    for (const status of ["pending", "confirmed", "checked_in", "cancelled", "no_show"] as const) {
      expect(
        canReview({ status, checkOut: "2026-08-15" }, { today: "2026-08-20", alreadyReviewed: false })
      ).toMatchObject({ ok: false, reason: "not_stayed" })
    }
  })

  it("allows only one review per booking", () => {
    expect(canReview(stayed, { today: "2026-08-20", alreadyReviewed: true })).toMatchObject({
      ok: false,
      reason: "already_reviewed",
    })
  })

  it("closes the window after 90 days", () => {
    const lastDay = "2026-11-13" // 90 days after 2026-08-15
    expect(canReview(stayed, { today: lastDay, alreadyReviewed: false })).toEqual({ ok: true })
    expect(canReview(stayed, { today: "2026-11-14", alreadyReviewed: false })).toMatchObject({
      ok: false,
      reason: "window_closed",
    })
  })

  it("uses the documented window length", () => {
    expect(REVIEW_WINDOW_DAYS).toBe(90)
  })
})

describe("isVerified", () => {
  it("is verified when the review is tied to a real stay", () => {
    expect(isVerified({ bookingId: "bk-1" } as Pick<Review, "bookingId">)).toBe(true)
    // Imported / OTA reviews carry no booking, so no badge.
    expect(isVerified({ bookingId: null } as Pick<Review, "bookingId">)).toBe(false)
  })
})

describe("validation", () => {
  it("accepts only whole 1–5 ratings", () => {
    expect(isValidRating(1)).toBe(true)
    expect(isValidRating(5)).toBe(true)
    expect(isValidRating(0)).toBe(false)
    expect(isValidRating(6)).toBe(false)
    expect(isValidRating(4.5)).toBe(false)
  })

  it("requires every category to be present and valid", () => {
    expect(isValidCategories(cats(4))).toBe(true)
    expect(isValidCategories({ ...cats(4), staff: undefined })).toBe(false)
    expect(isValidCategories({ ...cats(4), staff: 9 })).toBe(false)
  })
})
