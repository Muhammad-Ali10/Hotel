import { describe, expect, it } from "vitest"

import { listingScore, scoreBand, type ScoreInputs } from "./listing-score"

const perfectContent: ScoreInputs = {
  photos: 8,
  descriptionLength: 400,
  rooms: 4,
  amenities: 10,
  valueAdds: 5,
  reviewCount: 0,
  rating: 0,
  reviewsReplied: 0,
}

const find = (score: ReturnType<typeof listingScore>, key: string) =>
  score.categories.find((c) => c.key === key)!

describe("listing score", () => {
  it("gives a fully built listing full marks even with no reviews yet", () => {
    const score = listingScore(perfectContent)

    /*
     * The bug this replaces: the prototype scored an unreviewed listing `0`
     * for its rating, so a brand-new property with a perfect page was told it
     * was mediocre — for the one thing it could do nothing about on day one.
     */
    expect(score.total).toBe(100)
    expect(score.band).toBe("excellent")
    expect(find(score, "reviews").applicable).toBe(false)
    expect(find(score, "reviews").score).toBeNull()
  })

  it("renormalises the weights rather than capping the total", () => {
    const score = listingScore(perfectContent)
    const counted = score.categories.filter((c) => c.applicable)

    // Reviews and replies are 20 points between them. Left in the denominator,
    // a perfect page would top out at 80 and never reach "excellent".
    expect(counted).toHaveLength(5)
    expect(score.total).toBe(100)
  })

  it("counts the rating once there is one", () => {
    const score = listingScore({
      ...perfectContent,
      reviewCount: 10,
      rating: 4,
      reviewsReplied: 10,
    })

    expect(find(score, "reviews").applicable).toBe(true)
    // 4/5 is 80 on a category worth 10 of 100 — two points off the total.
    expect(find(score, "reviews").score).toBe(80)
    expect(score.total).toBe(98)
  })

  it("scores an empty listing at zero without dividing by nothing", () => {
    const score = listingScore({
      photos: 0,
      descriptionLength: 0,
      rooms: 0,
      amenities: 0,
      valueAdds: 0,
      reviewCount: 0,
      rating: 0,
      reviewsReplied: 0,
    })

    expect(score.total).toBe(0)
    expect(score.band).toBe("needs_work")
  })

  it("never exceeds 100 on a category that overshoots its target", () => {
    const score = listingScore({ ...perfectContent, photos: 200, amenities: 90 })

    expect(find(score, "photos").score).toBe(100)
    expect(find(score, "amenities").score).toBe(100)
    expect(score.total).toBe(100)
  })

  it("says how many are missing, not just that something is", () => {
    const score = listingScore({ ...perfectContent, photos: 3 })

    // A tip that cannot be acted on is one nobody acts on.
    expect(find(score, "photos").tip).toContain("Add 5 more photos")
  })

  it("counts unanswered reviews", () => {
    const score = listingScore({
      ...perfectContent,
      reviewCount: 4,
      rating: 5,
      reviewsReplied: 1,
    })

    expect(find(score, "responses").score).toBe(25)
    expect(find(score, "responses").tip).toContain("3 reviews are waiting")
  })

  it("uses the singular when there is one of something", () => {
    const one = listingScore({ ...perfectContent, reviewCount: 1, rating: 5, reviewsReplied: 0 })
    expect(find(one, "responses").tip).toContain("1 review is waiting")

    const missing = listingScore({ ...perfectContent, photos: 7 })
    expect(find(missing, "photos").tip).toContain("Add 1 more photo.")
  })

  it("draws the bands where the screens draw them", () => {
    expect(scoreBand(100)).toBe("excellent")
    expect(scoreBand(85)).toBe("excellent")
    expect(scoreBand(84)).toBe("good")
    expect(scoreBand(60)).toBe("good")
    expect(scoreBand(59)).toBe("needs_work")
    expect(scoreBand(0)).toBe("needs_work")
  })
})
