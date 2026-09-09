import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common"
import {
  availabilitySearchSchema,
  calendarQuerySchema,
  closeDatesSchema,
  copyRatesSchema,
  setRatesSchema,
  type AvailabilitySearchInput,
  type CalendarQueryInput,
  type CloseDatesInput,
  type CopyRatesInput,
  type SetRatesInput,
} from "@stayora/shared"

import { CurrentUser, Public, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { QuoteThrottle } from "../../common/throttling/throttling"
import type { AuthenticatedUser } from "../auth/auth.service"
import { InventoryService } from "./inventory.service"

@Controller("properties")
@Public()
export class AvailabilityController {
  constructor(private readonly inventory: InventoryService) {}

  /**
   * Availability for a stay.
   *
   * Rate-limited to the `quote` bucket: this is the most expensive read in the
   * product, and a competitor walking a rate calendar looks exactly like a
   * keen guest (API6).
   */
  @Get(":slug/availability")
  @QuoteThrottle()
  availability(
    @Param("slug") slug: string,
    @Query(new ZodValidationPipe(availabilitySearchSchema)) query: AvailabilitySearchInput
  ) {
    return this.inventory.availability({
      slug,
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      occupancy: { adults: query.adults, children: query.children },
    })
  }
}

@Controller("partner/inventory")
@Roles("partner")
export class PartnerInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  /** Bulk open/close. No `roomIds` = the whole property (rule #32). */
  /**
   * The partner's own calendar.
   *
   * A GET at last: rates and closures could be written and never read back,
   * so a partner had no way of seeing what they had set.
   */
  @Get("calendar/:propertyId")
  calendar(
    @Param("propertyId") propertyId: string,
    @Query(new ZodValidationPipe(calendarQuerySchema)) query: CalendarQueryInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.inventory.calendar({ propertyId, ...query, user })
  }

  @Post("close")
  close(
    @Body(new ZodValidationPipe(closeDatesSchema)) body: CloseDatesInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.inventory.setClosed(body, user)
  }

  @Post("rates")
  rates(
    @Body(new ZodValidationPipe(setRatesSchema)) body: SetRatesInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const { ratePlanId, from, to, ...patch } = body
    return this.inventory.setRates({ ratePlanId, from, to, patch }, user)
  }

  /**
   * Last June onto this June (rule #100).
   *
   * A separate route rather than a flag on `rates`, because the two take
   * different things: one carries the values to write, this one carries where
   * to read them from.
   */
  @Post("rates/copy")
  copy(
    @Body(new ZodValidationPipe(copyRatesSchema)) body: CopyRatesInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.inventory.copyRates(body, user)
  }
}
