import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common"
import {
  ratePlanCreateSchema,
  occupancyPricesSchema,
  ratePlanUpdateSchema,
  roomCreateSchema,
  roomUpdateSchema,
  valueAddCreateSchema,
  valueAddUpdateSchema,
  type RatePlanCreateInput,
  type OccupancyPricesInput,
  type RatePlanUpdateInput,
  type RoomCreateInput,
  type RoomUpdateInput,
  type ValueAddCreateInput,
  type ValueAddUpdateInput,
} from "@stayora/shared"

import { CurrentUser, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import type { AuthenticatedUser } from "../auth/auth.service"
import { RoomsService } from "./rooms.service"

/**
 * A property's rooms.
 *
 * Nested under the property because a room has no meaning without one, and
 * because the ownership check then has a property to hang off (API1).
 */
@Controller("partner/properties/:propertyId/rooms")
@Roles("partner")
export class PartnerRoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@Param("propertyId") propertyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rooms.listRooms(propertyId, user)
  }

  @Post()
  create(
    @Param("propertyId") propertyId: string,
    @Body(new ZodValidationPipe(roomCreateSchema)) body: RoomCreateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.rooms.createRoom({ propertyId, body, user })
  }
}

/**
 * Every rate plan in a property, read-only.
 *
 * A plan is created and edited under its ROOM — that is where it belongs, and
 * where the role split lives. This is the other direction: the screens that
 * ask "what am I selling across this hotel" want all of them at once, and
 * fetching them room by room is a round trip per room for the same answer.
 */
@Controller("partner/properties/:propertyId/rate-plans")
@Roles("partner")
export class PartnerPropertyRatePlansController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@Param("propertyId") propertyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rooms.listRatePlansForProperty(propertyId, user)
  }
}

/**
 * The extras a guest can add to a booking.
 *
 * The quote engine has always priced these; nothing could create one. There is
 * no DELETE — a booking's add-ons reference these rows, and "what was this
 * $65 line" has to stay answerable. `active: false` retires it.
 */
@Controller("partner/properties/:propertyId/value-adds")
@Roles("partner")
export class PartnerValueAddsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@Param("propertyId") propertyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rooms.listValueAdds(propertyId, user)
  }

  @Post()
  create(
    @Param("propertyId") propertyId: string,
    @Body(new ZodValidationPipe(valueAddCreateSchema)) body: ValueAddCreateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.rooms.createValueAdd({ propertyId, body, user })
  }
}

@Controller("partner/value-adds/:valueAddId")
@Roles("partner")
export class PartnerValueAddController {
  constructor(private readonly rooms: RoomsService) {}

  @Patch()
  update(
    @Param("valueAddId") valueAddId: string,
    @Body(new ZodValidationPipe(valueAddUpdateSchema)) body: ValueAddUpdateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.rooms.updateValueAdd({ valueAddId, body, user })
  }
}

/**
 * A room, and the rate plans on it.
 *
 * Addressed by the room's own id rather than nested under the property again:
 * the id is already unique, and the ownership check walks room → property →
 * org regardless, so the extra segment would only be decoration a caller could
 * get wrong.
 */
@Controller("partner/rooms/:roomId")
@Roles("partner")
export class PartnerRoomController {
  constructor(private readonly rooms: RoomsService) {}

  /**
   * There is no DELETE, deliberately.
   *
   * Bookings, inventory rows and payout lines all point at a room. Retiring it
   * is `status: "archived"`, which stops it selling and leaves last year's
   * stays readable.
   */
  @Patch()
  update(
    @Param("roomId") roomId: string,
    @Body(new ZodValidationPipe(roomUpdateSchema)) body: RoomUpdateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.rooms.updateRoom({ roomId, body, user })
  }

  @Get("rate-plans")
  listRatePlans(@Param("roomId") roomId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rooms.listRatePlans(roomId, user)
  }

  @Post("rate-plans")
  createRatePlan(
    @Param("roomId") roomId: string,
    @Body(new ZodValidationPipe(ratePlanCreateSchema)) body: RatePlanCreateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.rooms.createRatePlan({ roomId, body, user })
  }
}

@Controller("partner/rate-plans/:ratePlanId")
@Roles("partner")
export class PartnerRatePlanController {
  constructor(private readonly rooms: RoomsService) {}

  /**
   * A manager may reprice; only an org admin may change what was promised.
   *
   * The split is enforced in the service against the fields actually sent —
   * rules #1, #42 and #47 are all enforceable against a guest's card, which is
   * a different kind of authority from choosing a nightly rate.
   */
  @Patch()
  update(
    @Param("ratePlanId") ratePlanId: string,
    @Body(new ZodValidationPipe(ratePlanUpdateSchema)) body: RatePlanUpdateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.rooms.updateRatePlan({ ratePlanId, body, user })
  }

  /* ------------------------------------------- per-guest pricing (#101) */

  @Get("occupancy-prices")
  occupancyPrices(
    @Param("ratePlanId") ratePlanId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.rooms.occupancyPrices(ratePlanId, user)
  }

  /**
   * PUT, not PATCH.
   *
   * The numbers only mean anything relative to each other, so the grid is
   * replaced whole. A half-applied matrix where three guests cost less than
   * two is a price nobody meant to publish.
   */
  @Put("occupancy-prices")
  setOccupancyPrices(
    @Param("ratePlanId") ratePlanId: string,
    @Body(new ZodValidationPipe(occupancyPricesSchema)) body: OccupancyPricesInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.rooms.setOccupancyPrices({ ratePlanId, body, user })
  }
}
