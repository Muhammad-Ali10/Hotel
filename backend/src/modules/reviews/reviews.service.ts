import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import {
  REVIEW_WINDOW_DAYS,
  addDays,
  canReview,
  ratingFromTotals,
  reviewCategoriesSchema,
  toISODate,
  type BookingStatus,
  type CreateReviewInput,
  type PropertyRating,
  type RatingTotals,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { NotificationsService } from "../notifications/notifications.service"
import { ReviewsRepository, type ReviewRow } from "./reviews.repository"

const EMPTY_TOTALS: RatingTotals = { reviewCount: 0, ratingSum: 0, categorySums: {} }

@Injectable()
export class ReviewsService {
  constructor(
    private readonly repo: ReviewsRepository,
    private readonly notifications: NotificationsService
  ) {}

  /* ---------------------------------------------------------------- write */

  /**
   * Writes a review (rules #39, #40).
   *
   * Everything except the guest's words is derived here: the property, the
   * room, the author's name, the date. A client that could name the property
   * could review one it never stayed at.
   */
  async create(input: CreateReviewInput & { user: AuthenticatedUser; now?: Date }) {
    const today = toISODate(input.now ?? new Date())

    // Scoped lookup — somebody else's stay simply does not exist here (API1).
    const booking = await this.repo.findOwnedBooking({
      bookingId: input.bookingId,
      userId: input.user.id,
    })
    if (!booking) throw new NotFoundException("Booking not found")

    const alreadyReviewed = await this.repo.existsForBooking(booking.id)

    // The rule lives in the domain, where it is tested against every status.
    const eligibility = canReview(
      { status: booking.status as BookingStatus, checkOut: booking.checkOut },
      { today, alreadyReviewed }
    )
    if (!eligibility.ok) {
      throw new BadRequestException({
        message: MESSAGES[eligibility.reason],
        code: eligibility.reason,
      })
    }

    const author = await this.repo.authorDetails(input.user.id)

    const created = await this.repo.create({
      propertyId: booking.propertyId,
      bookingId: booking.id,
      authorId: input.user.id,
      author: `${author?.firstName ?? input.user.firstName} ${author?.lastName ?? input.user.lastName}`.trim(),
      authorSeed: author?.avatarSeed ?? "",
      country: booking.guestCountry || (author?.country ?? ""),
      roomName: booking.roomName,
      rating: input.rating,
      categories: input.categories,
      title: input.title,
      body: input.body,
      date: today,
    })

    if (!created) {
      // The unique index caught a review that slipped past the check above —
      // two submissions racing each other.
      throw new ConflictException("You have already reviewed this stay")
    }

    /*
     * The property hears about it (rule #40's other half).
     *
     * Publishing on write is only safe because a partner can object quickly —
     * and they can only object quickly if somebody tells them.
     */
    const owner = await this.repo.propertyOwnerEmail(booking.propertyId)
    if (owner) {
      await this.notifications.notify({
        template: "partner_new_review",
        subjectId: created.id,
        userId: owner.userId,
        toEmail: owner.email,
        payload: { author: created.author, rating: created.rating, title: created.title },
        inApp: {
          title: `New ${created.rating}-star review`,
          message: created.title,
          href: "/extranet/reviews",
        },
      })
    }

    // Published immediately (rule #40): only a completed stay can produce this
    // row at all, which is a stronger signal than a queue provides.
    return toDto(created)
  }

  /* ------------------------------------------------------------ the guest */

  /**
   * The stays this guest can still write about.
   *
   * The dashboard's "Write a review" list. The window is applied in SQL rather
   * than by fetching every completed booking and filtering in Node — a guest
   * with years of history would otherwise pull all of it on every page load.
   */
  async reviewableFor(user: AuthenticatedUser, now = new Date()) {
    const notBefore = addDays(toISODate(now), -REVIEW_WINDOW_DAYS)
    // Bounded rather than paged: the window is 90 days, so 50 unreviewed stays
    // in one quarter is beyond any real guest. If that ever stops being true
    // this needs a cursor, not a bigger number.
    return this.repo.reviewableBookings({ userId: user.id, notBefore, limit: 50 })
  }

  /**
   * A guest's own reviews, in every state.
   *
   * Including the flagged and rejected ones: they wrote it, so hiding their own
   * words from them would just look like the review vanished.
   */
  async listOwn(user: AuthenticatedUser, query: { limit: number; cursor?: string }) {
    const page = await this.repo.listByAuthor({ userId: user.id, ...query })

    /*
     * The property NAME, joined at read time.
     *
     * The review row carries only `property_id` — deliberately, because a
     * review is about the place and not about the name it had that week. But a
     * guest's own list has to say which hotel, and without this the dashboard
     * had to fetch the whole catalogue to render a heading.
     */
    const names = await this.repo.propertyNamesFor(page.rows.map((row) => row.propertyId))

    return {
      items: page.rows.map((row) => ({
        ...toDto(row),
        propertyName: names.get(row.propertyId) ?? "",
      })),
      nextCursor: page.nextCursor,
    }
  }

  /**
   * A guest taking their own review down (rule #41).
   *
   * It leaves the public list and the rating at once. What it does NOT do is
   * free the booking for a fresh review: the unique index still stands. That
   * is the whole point — a withdrawal that reopened the slot would turn into a
   * lever, with a property pressing a guest to pull the two-star and write a
   * kinder one. Take it down, yes. Trade it in, no.
   *
   * `rejected` cannot be withdrawn: it is already gone, and letting the author
   * relabel a moderator's decision as their own choice rewrites what happened.
   */
  async withdraw(input: { reviewId: string; user: AuthenticatedUser }) {
    const withdrawable = ["published", "flagged", "pending"]

    const updated = await this.repo.withdraw({
      reviewId: input.reviewId,
      userId: input.user.id,
      fromStatuses: withdrawable,
    })
    if (updated) return toDto(updated)

    // Nothing changed. Either it is not theirs, or it is not in a state that
    // can be withdrawn — and the two are answered apart so the guest is told
    // something useful without confirming a review id that is not theirs.
    const existing = await this.repo.findById(input.reviewId)
    if (!existing || existing.authorId !== input.user.id) {
      throw new NotFoundException("Review not found")
    }
    throw new BadRequestException(`A ${existing.status} review cannot be withdrawn.`)
  }

  /* ----------------------------------------------------------------- read */

  async listForPropertySlug(input: { slug: string; limit: number; cursor?: string }) {
    const property = await this.repo.findPublicPropertyBySlug(input.slug)
    if (!property) throw new NotFoundException("Property not found")

    const [page, rating] = await Promise.all([
      this.repo.listPublished({ ...input, propertyId: property.id }),
      this.ratingFor(property.id),
    ])
    return { items: page.rows.map(toPublicDto), nextCursor: page.nextCursor, rating }
  }

  /**
   * A property's headline rating.
   *
   * Derived on every read, never stored — so a moderation decision moves the
   * number the moment it is made, and no screen can show a rating that a
   * rejected review is still propping up.
   */
  async ratingFor(propertyId: string): Promise<PropertyRating> {
    const totals = await this.repo.ratingTotals([propertyId])
    return ratingFromTotals(totals.get(propertyId) ?? EMPTY_TOTALS)
  }

  /** Ratings for a page of properties, in one query rather than one each. */
  async ratingsFor(propertyIds: string[]): Promise<Map<string, PropertyRating>> {
    const totals = await this.repo.ratingTotals(propertyIds)
    const result = new Map<string, PropertyRating>()
    for (const id of propertyIds) {
      result.set(id, ratingFromTotals(totals.get(id) ?? EMPTY_TOTALS))
    }
    return result
  }

  /* -------------------------------------------------------------- partner */

  async listForPartner(user: AuthenticatedUser, query: { limit: number; cursor?: string; status?: string }) {
    const propertyIds = await this.partnerScope(user)
    const [page, counts] = await Promise.all([
      this.repo.listForProperties({ propertyIds, ...query }),
      // The status tabs carry counts, and they must count the whole set, not
      // the page — so they are a separate grouped query, not a tally of `items`.
      this.repo.countsForProperties(propertyIds),
    ])
    return { items: page.rows.map(toDto), nextCursor: page.nextCursor, counts }
  }

  async respond(input: { reviewId: string; text: string; user: AuthenticatedUser }) {
    const review = await this.assertPartnerOwns(input.reviewId, input.user)

    if (input.user.partner!.role === "staff") {
      throw new ForbiddenException("Your role cannot reply to reviews")
    }
    if (review.status === "withdrawn" || review.status === "rejected") {
      // Nobody will ever read it. Storing the reply would only leave the
      // property believing they answered in public.
      throw new BadRequestException(`A ${review.status} review cannot be replied to.`)
    }
    // A reply may be edited. It is the property's OWN words, and the
    // alternative — a typo or a wrong guest name public forever — is worse
    // than the risk of a rewritten reply, which nobody is quoting back.
    const updated = await this.repo.setResponse(review.id, input.text)
    return toDto(updated!)
  }

  /**
   * A partner objecting to a review (rule #40).
   *
   * The review leaves the public site and the rating IMMEDIATELY. That is what
   * makes publishing-on-write safe: the exposure window is however long it
   * takes the property to notice, not however long a moderator takes.
   *
   * It is deliberately not a delete — an admin decides, and the reason is
   * recorded so a mistake can be told apart from a judgement call.
   */
  async flag(input: { reviewId: string; reason: string; user: AuthenticatedUser }) {
    const review = await this.assertPartnerOwns(input.reviewId, input.user)

    if (input.user.partner!.role === "staff") {
      throw new ForbiddenException("Your role cannot flag reviews")
    }
    if (review.status !== "published") {
      throw new BadRequestException(`A ${review.status} review cannot be flagged.`)
    }

    const updated = await this.repo.setStatus({
      reviewId: review.id,
      fromStatus: "published",
      toStatus: "flagged",
      flagReason: input.reason,
    })
    if (!updated) throw new ConflictException("That review was just changed by someone else")
    return toDto(updated)
  }

  /* ---------------------------------------------------------------- admin */

  async listForModeration(query: { limit: number; cursor?: string; status?: string }) {
    // The counts drive the status tabs and the sidebar badge, so they count
    // the whole queue rather than the page somebody is looking at.
    const [page, counts] = await Promise.all([
      this.repo.listForModeration(query),
      this.repo.countsForModeration(),
    ])

    return { items: page.rows.map(toDto), nextCursor: page.nextCursor, counts }
  }

  async moderate(input: {
    reviewId: string
    status: "published" | "rejected"
    reason?: string
  }) {
    const review = await this.repo.findById(input.reviewId)
    if (!review) throw new NotFoundException("Review not found")

    if (review.status === "withdrawn") {
      // The author's decision, not a moderator's to reverse. Republishing here
      // would put words back in public that their writer took down.
      throw new BadRequestException("The author withdrew this review.")
    }
    if (review.status === input.status) {
      throw new BadRequestException(`That review is already ${input.status}.`)
    }

    const updated = await this.repo.setStatus({
      reviewId: review.id,
      fromStatus: review.status,
      toStatus: input.status,
      // Reinstating clears the objection; rejecting records why.
      flagReason: input.status === "published" ? null : (input.reason ?? review.flagReason),
    })
    if (!updated) throw new ConflictException("That review was just changed by someone else")
    return toDto(updated)
  }

  /* ----------------------------------------------------------------- authz */

  private async partnerScope(user: AuthenticatedUser): Promise<string[]> {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    return this.repo.propertyIdsForOrg(user.partner.orgId, user.partner.propertyIds)
  }

  /** 404, never 403 — a 403 would confirm the review id is real (API1). */
  private async assertPartnerOwns(reviewId: string, user: AuthenticatedUser): Promise<ReviewRow> {
    const review = await this.repo.findById(reviewId)
    if (!review) throw new NotFoundException("Review not found")

    const allowed = await this.partnerScope(user)
    if (!allowed.includes(review.propertyId)) throw new NotFoundException("Review not found")

    return review
  }
}

const MESSAGES: Record<string, string> = {
  not_stayed: "You can review a stay once it is complete.",
  already_reviewed: "You have already reviewed this stay.",
  window_closed: "The review window for this stay has closed.",
}

/**
 * What a review looks like to whoever owns it — the guest who wrote it, the
 * property it is about, an admin moderating it.
 *
 * Explicit fields, so a column added later cannot leak into a response by
 * simply existing (API3).
 */
function toDto(row: ReviewRow) {
  return {
    ...toPublicDto(row),
    status: row.status,
    /** The partner's objection, in their words. Never public — see below. */
    flagReason: row.flagReason,
  }
}

/**
 * What the open internet sees.
 *
 * `flagReason` and `status` are absent BY CONSTRUCTION rather than by being
 * null on published rows. Relying on "a published review has no flag reason"
 * would make one forgotten `flagReason: null` on a reinstatement enough to
 * publish a property's private objection — "we believe this guest is lying" —
 * underneath the guest's own review.
 */
function toPublicDto(row: ReviewRow) {
  return {
    id: row.id,
    propertyId: row.propertyId,
    author: row.author,
    authorSeed: row.authorSeed,
    country: row.country,
    roomName: row.roomName,
    rating: row.rating,
    categories: reviewCategoriesSchema.parse(row.categories),
    title: row.title,
    body: row.body,
    date: row.date,
    /** Its presence is the Verified badge — the reviewer demonstrably stayed. */
    verified: row.bookingId !== null,
    response: row.responseText ? { text: row.responseText, at: row.responseAt } : null,
    createdAt: row.createdAt,
  }
}
