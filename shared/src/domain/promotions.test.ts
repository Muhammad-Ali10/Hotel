import { describe, expect, it } from "vitest"

import type { ISODate } from "../types/common"
import type { ResolvedNight } from "../types/property"
import { makeNight } from "./night.fixture"
import {
  advertisableDiscount,
  applicablePromotions,
  bestPromotion,
  channelMatches,
  isApplicable,
  nextStatusFor,
  type GuestContext,
  type PromotionQuery,
  type ScopedPromotion,
} from "./promotions"

const RITZ = "prop-ritz"
const DELUXE = "room-deluxe"
const STANDARD = "room-standard"

const stamps = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }

function promo(over: Partial<ScopedPromotion> & { id: string }): ScopedPromotion {
  return {
    name: over.id,
    kind: "seasonal_deal",
    discount: { type: "percent", value: 10 },
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    roomIds: [],
    minStay: null,
    channel: "all",
    status: "active",
    propertyIds: [RITZ],
    ...stamps,
    ...over,
  }
}

/** Three flat $725 nights. */
const flat3: ResolvedNight[] = ["2026-08-12", "2026-08-13", "2026-08-14"].map((date) =>
  makeNight({ date })
)

const stay = { roomSubtotal: 217_500, nights: flat3 }

const signedInGenius: GuestContext = { isMobile: false, tier: "genius" }
const desktopStandard: GuestContext = { isMobile: false, tier: "standard" }
const mobileGuest: GuestContext = { isMobile: true, tier: null }

function query(over: Partial<PromotionQuery> = {}): PromotionQuery {
  return {
    propertyId: RITZ,
    roomId: DELUXE,
    nights: 3,
    today: "2026-08-01",
    guest: desktopStandard,
    ...over,
  }
}

describe("channelMatches", () => {
  it("lets `all` through for everyone", () => {
    expect(channelMatches("all", desktopStandard)).toBe(true)
    expect(channelMatches("all", mobileGuest)).toBe(true)
  })

  it("gates `mobile` on the device", () => {
    expect(channelMatches("mobile", mobileGuest)).toBe(true)
    expect(channelMatches("mobile", desktopStandard)).toBe(false)
  })

  it("gates `genius` on the tier, not on being signed in", () => {
    expect(channelMatches("genius", signedInGenius)).toBe(true)
    expect(channelMatches("genius", desktopStandard)).toBe(false)
    expect(channelMatches("genius", mobileGuest)).toBe(false)
  })
})

describe("isApplicable", () => {
  it("accepts a plain live promotion", () => {
    expect(isApplicable(promo({ id: "p" }), query())).toBe(true)
  })

  it("rejects anything that is not exactly `active`", () => {
    // The Ritz's real fixtures: a paused 35% and a draft 10%.
    for (const status of ["draft", "scheduled", "paused", "ended"] as const) {
      expect(isApplicable(promo({ id: "p", status }), query())).toBe(false)
    }
  })

  it("honours the date window inclusively", () => {
    const p = promo({ id: "p", startDate: "2026-08-01", endDate: "2026-08-31" })
    expect(isApplicable(p, query({ today: "2026-08-01" }))).toBe(true)
    expect(isApplicable(p, query({ today: "2026-08-31" }))).toBe(true)
    expect(isApplicable(p, query({ today: "2026-07-31" }))).toBe(false)
    expect(isApplicable(p, query({ today: "2026-09-01" }))).toBe(false)
  })

  it("only covers the properties it lists", () => {
    const p = promo({ id: "p", propertyIds: ["prop-other"] })
    expect(isApplicable(p, query())).toBe(false)
  })

  it("treats empty roomIds as every room (rule #21)", () => {
    expect(isApplicable(promo({ id: "p", roomIds: [] }), query({ roomId: DELUXE }))).toBe(true)
  })

  it("restricts to the listed rooms when roomIds is set (rule #21)", () => {
    // This is what the free-text "Standard rooms" could never enforce — the
    // label said standard and the discount applied to suites too.
    const p = promo({ id: "p", roomIds: [STANDARD] })
    expect(isApplicable(p, query({ roomId: STANDARD }))).toBe(true)
    expect(isApplicable(p, query({ roomId: DELUXE }))).toBe(false)
  })

  it("enforces the promotion's own minimum stay (rule #22)", () => {
    // "Stay Longer, Save More" used to apply to one-night stays.
    const p = promo({ id: "stay-longer", minStay: 3 })
    expect(isApplicable(p, query({ nights: 3 }))).toBe(true)
    expect(isApplicable(p, query({ nights: 2 }))).toBe(false)
  })

  it("reaches the guest once the channel is honoured (rule #3)", () => {
    const mobileOnly = promo({ id: "mobile-only", channel: "mobile" })
    const genius = promo({ id: "genius-l2", channel: "genius" })

    // Exactly the two offers that sat live on the Ritz and reached nobody.
    expect(isApplicable(mobileOnly, query({ guest: mobileGuest }))).toBe(true)
    expect(isApplicable(mobileOnly, query({ guest: desktopStandard }))).toBe(false)
    expect(isApplicable(genius, query({ guest: signedInGenius }))).toBe(true)
    expect(isApplicable(genius, query({ guest: desktopStandard }))).toBe(false)
  })
})

describe("applicablePromotions — the Ritz fixture", () => {
  const ritzPromotions = [
    promo({ id: "last-minute", status: "paused", discount: { type: "percent", value: 35 } }),
    promo({ id: "loyalty", status: "draft", discount: { type: "percent", value: 10 } }),
    promo({ id: "mobile-only", channel: "mobile", discount: { type: "percent", value: 25 } }),
    promo({ id: "genius-l2", channel: "genius", discount: { type: "percent", value: 15 } }),
  ]

  it("still gives a desktop standard guest nothing — correctly", () => {
    // Paused and draft are the partner's own choice; the other two simply do
    // not apply to this guest. Zero here is right.
    expect(applicablePromotions(ritzPromotions, query({ guest: desktopStandard }))).toEqual([])
  })

  it("finally reaches the Genius member (rule #3)", () => {
    const applicable = applicablePromotions(ritzPromotions, query({ guest: signedInGenius }))
    expect(applicable.map((p) => p.id)).toEqual(["genius-l2"])
  })

  it("finally reaches the mobile guest (rule #3)", () => {
    const applicable = applicablePromotions(ritzPromotions, query({ guest: mobileGuest }))
    expect(applicable.map((p) => p.id)).toEqual(["mobile-only"])
  })
})

describe("bestPromotion", () => {
  it("picks the offer that actually saves the most (rule #4)", () => {
    const offers = [
      promo({ id: "twenty-pc", discount: { type: "percent", value: 20 } }), // $435
      promo({ id: "fifty-off", discount: { type: "amount", value: 5_000 } }), // $50
    ]
    const best = bestPromotion(offers, query(), stay)
    expect(best?.promotion.id).toBe("twenty-pc")
    expect(best?.saving).toBe(43_500)
  })

  it("flips the winner when the stay is small — which a fixed score cannot", () => {
    // One $200 night. The old ranking scored 5% and $50 both at 50 and could
    // hand the guest the worse of the two.
    const oneNight = [{ ...flat3[0]!, rate: 20_000 }]
    const smallStay = { roomSubtotal: 20_000, nights: oneNight }
    const offers = [
      promo({ id: "five-pc", discount: { type: "percent", value: 5 } }), // $10
      promo({ id: "fifty-off", discount: { type: "amount", value: 5_000 } }), // $50
    ]
    const best = bestPromotion(offers, query({ nights: 1 }), smallStay)
    expect(best?.promotion.id).toBe("fifty-off")
    expect(best?.saving).toBe(5_000)
  })

  it("stamps the winning promotion id onto the discount", () => {
    const best = bestPromotion([promo({ id: "genius-l2", channel: "genius" })], query({ guest: signedInGenius }), stay)
    expect(best?.discount.promotionId).toBe("genius-l2")
  })

  it("prefers the percent offer when savings tie", () => {
    // 10% of $217.50... construct an exact tie: 10% of 217500 = 21750
    const offers = [
      promo({ id: "amount", discount: { type: "amount", value: 21_750 } }),
      promo({ id: "percent", discount: { type: "percent", value: 10 } }),
    ]
    expect(bestPromotion(offers, query(), stay)?.promotion.id).toBe("percent")
  })

  it("returns null when nothing applies", () => {
    expect(bestPromotion([promo({ id: "p", status: "paused" })], query(), stay)).toBeNull()
  })

  it("ignores an applicable promotion that saves nothing", () => {
    // 3 nights cannot earn a 4th-night-free offer.
    const offers = [promo({ id: "free-4th", discount: { type: "free_night", value: 4 } })]
    expect(bestPromotion(offers, query(), stay)).toBeNull()
  })
})

describe("advertisableDiscount", () => {
  const ad = (guest: GuestContext) =>
    advertisableDiscount(
      [
        promo({ id: "twenty-pc", discount: { type: "percent", value: 20 } }),
        promo({ id: "genius-l2", channel: "genius", discount: { type: "percent", value: 15 } }),
      ],
      { propertyId: RITZ, today: "2026-08-01", guest }
    )

  it("advertises the strongest offer the guest could actually use", () => {
    expect(ad(desktopStandard)).toMatchObject({ type: "percent", value: 20, promotionId: "twenty-pc" })
  })

  it("refuses to advertise an offer with strings attached", () => {
    // A room-restricted or minimum-stay offer cannot honestly be shown on a
    // card where no room and no dates have been chosen yet.
    const restricted = [
      promo({ id: "suites-only", roomIds: [STANDARD] }),
      promo({ id: "stay-3", minStay: 3 }),
    ]
    expect(
      advertisableDiscount(restricted, { propertyId: RITZ, today: "2026-08-01", guest: desktopStandard })
    ).toBeNull()
  })

  it("respects the channel on the card too", () => {
    const geniusOnly = [promo({ id: "genius-l2", channel: "genius" })]
    const input = { propertyId: RITZ, today: "2026-08-01" }
    expect(advertisableDiscount(geniusOnly, { ...input, guest: signedInGenius })).not.toBeNull()
    expect(advertisableDiscount(geniusOnly, { ...input, guest: desktopStandard })).toBeNull()
  })
})

describe("nextStatusFor", () => {
  const window = { startDate: "2026-09-10" as ISODate, endDate: "2026-09-20" as ISODate }
  const at = (status: string, today: string) =>
    nextStatusFor({ ...window, status: status as never }, today as ISODate)

  it("opens a scheduled promotion on its first day", () => {
    // `isApplicable` insists on exactly `active` and refuses to infer it from
    // the window, so something has to do this. Nothing did.
    expect(at("scheduled", "2026-09-09")).toBeNull()
    expect(at("scheduled", "2026-09-10")).toBe("active")
    expect(at("scheduled", "2026-09-15")).toBe("active")
  })

  it("closes an active promotion the day after its last", () => {
    expect(at("active", "2026-09-20")).toBeNull()
    expect(at("active", "2026-09-21")).toBe("ended")
  })

  it("closes a scheduled promotion whose window passed while the job was down", () => {
    // Ending wins over starting. Otherwise a week of downtime publishes a
    // promotion whose window is already over.
    expect(at("scheduled", "2026-10-01")).toBe("ended")
  })

  it("never publishes a draft", () => {
    // A window opening does not mean a partner finished writing it — and
    // publishing it for them is the one mistake they cannot undo.
    expect(at("draft", "2026-09-15")).toBeNull()
    expect(at("draft", "2026-10-01")).toBeNull()
  })

  it("never un-pauses", () => {
    // A pause is a human decision; only a human reverses it.
    expect(at("paused", "2026-09-15")).toBeNull()
    expect(at("paused", "2026-10-01")).toBeNull()
  })

  it("leaves an ended promotion ended", () => {
    expect(at("ended", "2026-09-15")).toBeNull()
    expect(at("ended", "2026-10-01")).toBeNull()
  })

  it("leaves a hand-published promotion alone before its window", () => {
    // Pricing already refuses it on the date check, so there is nothing to fix.
    expect(at("active", "2026-09-01")).toBeNull()
  })
})
