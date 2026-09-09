import { Body, Controller, Get, Headers, Param, Post, Req } from "@nestjs/common"
import { SkipThrottle } from "@nestjs/throttler"
import { startPaymentSchema, type StartPaymentInput } from "@stayora/shared"
import type { Request } from "express"

import { CurrentUser, Public } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { BookingThrottle } from "../../common/throttling/throttling"
import type { AuthenticatedUser } from "../auth/auth.service"
import { PaymentsService } from "./payments.service"

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * Start or resume payment for a booking.
   *
   * Throttled like a booking write, and for the same reason: each call can
   * create an intent at the provider, and a flood of them is both a cost and
   * a way to look like fraud to the processor.
   */
  @Post("start")
  @BookingThrottle()
  start(
    @Body(new ZodValidationPipe(startPaymentSchema)) body: StartPaymentInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.payments.start({ ...body, user })
  }

  /** The ledger for one booking. The guest's own, or a 404. */
  @Get("booking/:bookingId")
  forBooking(@Param("bookingId") bookingId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.listForBooking(bookingId, user)
  }
}

/**
 * The provider's callback (rule #45).
 *
 * `@Public()` because the caller is a processor with no session — but it is
 * not unauthenticated: the signature over the raw body is the credential, and
 * an unsigned or wrongly signed request is refused before anything is read.
 *
 * `@SkipThrottle()` because a provider retrying a backlog after an outage
 * would trip a rate limit, and every rejected delivery is a booking left
 * unconfirmed while the guest's money has already moved.
 */
@Controller("payments/webhook")
@Public()
@SkipThrottle()
export class PaymentsWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  async handle(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers("x-payment-signature") signature: string | undefined
  ) {
    /*
     * The raw bytes, stashed by the body parser's `verify` hook in main.ts.
     *
     * If they are missing, the parser ran without the hook — never fall back
     * to re-serialising the parsed body. That would produce a buffer that
     * cannot verify, and the fix would look like "signature checking is
     * broken" rather than "the raw body was lost".
     */
    if (!request.rawBody) {
      throw new Error("Raw body missing on the webhook route — check the json() verify hook")
    }

    const result = await this.payments.handleWebhook(request.rawBody, signature)

    // 200 on a duplicate, and on an event for an intent we do not know: a
    // provider that gets anything else keeps retrying, for days.
    return { received: true, ...result }
  }
}
