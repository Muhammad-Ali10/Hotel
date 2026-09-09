import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  BadRequestException,
} from "@nestjs/common"
import {
  bookingListQuerySchema,
  cancelBookingSchema,
  createBookingSchema,
  modifyBookingSchema,
  partnerBookingListQuerySchema,
  setBookingStatusSchema,
  type BookingListQuery,
  type CancelBookingInput,
  type CreateBookingInput,
  type ModifyBookingInput,
  type PartnerBookingListQuery,
  type SetBookingStatusInput,
} from "@stayora/shared"

import { CurrentUser, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { BookingThrottle } from "../../common/throttling/throttling"
import type { AuthenticatedUser } from "../auth/auth.service"
import { BookingsService } from "./bookings.service"

const IDEMPOTENCY_HEADER = "idempotency-key"

@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  /**
   * Creates a booking.
   *
   * Authenticated by default — an account is required to check out (rule #29).
   * `Idempotency-Key` is REQUIRED, not optional: a double-tapped confirm button
   * must produce one reservation, and making the client opt into that is how it
   * gets forgotten (API4).
   */
  @Post()
  @BookingThrottle()
  create(
    @Body(new ZodValidationPipe(createBookingSchema)) body: CreateBookingInput,
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new BadRequestException("An Idempotency-Key header is required")
    }
    return this.bookings.create({ ...body, idempotencyKey, user })
  }

  @Get()
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(bookingListQuerySchema)) query: BookingListQuery
  ) {
    return this.bookings.listMine(user, query)
  }

  /** 404 for a booking that is not the caller's — never 403 (API1). */
  @Get(":id")
  detail(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.detail(id, user)
  }

  /**
   * Moves a booking (rule #38).
   *
   * The client sends a FRESH quote token — the same object it used to book —
   * so the new price is one this server signed rather than one the client
   * described.
   */
  @Post(":id/modify")
  @BookingThrottle()
  modify(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(modifyBookingSchema)) body: ModifyBookingInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookings.modify({ bookingId: id, quoteToken: body.quoteToken, user })
  }

  @Post(":id/cancel")
  @BookingThrottle()
  cancel(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(cancelBookingSchema)) body: CancelBookingInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookings.cancel({ bookingId: id, reason: body.reason, user })
  }

  /** Front-desk moves. The state machine decides who may do which. */
  @Patch(":id/status")
  setStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(setBookingStatusSchema)) body: SetBookingStatusInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookings.setStatus({
      bookingId: id,
      to: body.status,
      user,
      ...(body.roomNo ? { roomNo: body.roomNo } : {}),
    })
  }
}

@Controller("partner/bookings")
@Roles("partner")
export class PartnerBookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(partnerBookingListQuerySchema)) query: PartnerBookingListQuery
  ) {
    return this.bookings.listForPartner(user, query)
  }
}
