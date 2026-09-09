import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common"
import {
  promotionCreateSchema,
  promotionListSchema,
  promotionUpdateSchema,
  type PromotionCreateInput,
  type PromotionListInput,
  type PromotionUpdateInput,
} from "@stayora/shared"

import { AdminResource, CurrentUser, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import type { AuthenticatedUser } from "../auth/auth.service"
import { PromotionsService } from "./promotions.service"

/**
 * A property's own promotions.
 *
 * The org comes from the session, never a parameter. The properties a
 * promotion covers ARE in the body — and every one of them is checked against
 * the database, because a caller who could name any id could put a 90%
 * discount on a competitor's hotel (API1).
 */
@Controller("partner/promotions")
@Roles("partner")
export class PartnerPromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(promotionListSchema)) query: PromotionListInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.promotions.listForPartner(user, query)
  }

  @Get(":id")
  detail(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.promotions.detailForPartner(id, user)
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(promotionCreateSchema)) body: PromotionCreateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.promotions.createForPartner({ body, user })
  }

  /**
   * There is no DELETE.
   *
   * A promotion is referenced by every booking it discounted — `bookings.
   * promotion_id` — and "why was this stay $400 cheaper" has to stay
   * answerable. `status: "ended"` retires it.
   */
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(promotionUpdateSchema)) body: PromotionUpdateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.promotions.updateForPartner({ promotionId: id, body, user })
  }
}

@Controller("admin/promotions")
@AdminResource("promotions")
@Roles("admin")
export class AdminPromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(promotionListSchema)) query: PromotionListInput) {
    return this.promotions.listAll(query)
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.promotions.detailForAdmin(id)
  }

  /** Runs the lifecycle sweep now, for one the scheduler missed. */
  @Post("sweep")
  sweep() {
    return this.promotions.sweepStatuses()
  }
}
