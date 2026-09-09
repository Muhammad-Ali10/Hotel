import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import {
  createReviewSchema,
  flagReviewSchema,
  moderateReviewSchema,
  publicReviewListSchema,
  respondToReviewSchema,
  reviewListSchema,
  type CreateReviewInput,
  type FlagReviewInput,
  type ModerateReviewInput,
  type PublicReviewListInput,
  type RespondToReviewInput,
  type ReviewListInput,
} from "@stayora/shared"

import { AdminResource, CurrentUser, Public, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { ContentThrottle } from "../../common/throttling/throttling"
import type { AuthenticatedUser } from "../auth/auth.service"
import { ReviewsService } from "./reviews.service"

/**
 * The public review list for a property.
 *
 * Only `published` reviews are returned, and that is not a parameter a caller
 * can influence — a `status` filter here would be a way to read the moderation
 * queue from the open internet.
 */
@Controller("properties/:slug/reviews")
@Public()
export class PropertyReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(
    @Param("slug") slug: string,
    @Query(new ZodValidationPipe(publicReviewListSchema)) query: PublicReviewListInput
  ) {
    return this.reviews.listForPropertySlug({ slug, ...query })
  }
}

@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** The stays this guest can still write about. */
  @Get("reviewable")
  reviewable(@CurrentUser() user: AuthenticatedUser) {
    return this.reviews.reviewableFor(user)
  }

  /** The guest's own reviews, in every state — they wrote them. */
  @Get("mine")
  mine(
    @Query(new ZodValidationPipe(publicReviewListSchema)) query: PublicReviewListInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.reviews.listOwn(user, query)
  }

  /** Writing a review. Authenticated — the author is the session, not the body. */
  @Post()
  @ContentThrottle()
  create(
    @Body(new ZodValidationPipe(createReviewSchema)) body: CreateReviewInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.reviews.create({ ...body, user })
  }

  /**
   * Taking your own review down (rule #41).
   *
   * DELETE, because that is what the guest is asking for and what they will
   * see. Underneath it is a status change, not a row removal — the property's
   * reply, the moderation history and the fact that this stay was reviewed all
   * survive, and the booking does not become reviewable again.
   */
  @Delete(":id")
  withdraw(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reviews.withdraw({ reviewId: id, user })
  }
}

@Controller("partner/reviews")
@Roles("partner")
export class PartnerReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(reviewListSchema)) query: ReviewListInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.reviews.listForPartner(user, query)
  }

  @Post(":id/respond")
  @ContentThrottle()
  respond(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(respondToReviewSchema)) body: RespondToReviewInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.reviews.respond({ reviewId: id, text: body.text, user })
  }

  /**
   * Objecting to a review (rule #40) — the safety valve that makes immediate
   * publishing safe. It leaves the public site at once; an admin decides.
   */
  @Post(":id/flag")
  @ContentThrottle()
  flag(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(flagReviewSchema)) body: FlagReviewInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.reviews.flag({ reviewId: id, reason: body.reason, user })
  }
}

@Controller("admin/reviews")
@AdminResource("reviews")
@Roles("admin")
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** The queue: flagged and pending, unless a status is named. */
  @Get()
  list(@Query(new ZodValidationPipe(reviewListSchema)) query: ReviewListInput) {
    return this.reviews.listForModeration(query)
  }

  @Patch(":id")
  moderate(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(moderateReviewSchema)) body: ModerateReviewInput
  ) {
    return this.reviews.moderate({ reviewId: id, status: body.status, ...(body.reason ? { reason: body.reason } : {}) })
  }
}
