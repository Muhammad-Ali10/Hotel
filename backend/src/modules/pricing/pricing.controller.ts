import { Body, Controller, Param, Post, Req } from "@nestjs/common"
import { quoteRequestSchema, type GuestContext, type QuoteRequestInput } from "@stayora/shared"
import type { Request } from "express"

import { CurrentUser, Public } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { QuoteThrottle } from "../../common/throttling/throttling"
import type { AuthenticatedUser } from "../auth/auth.service"
import { PricingService } from "./pricing.service"

@Controller("properties")
@Public()
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  /**
   * The authoritative price for a stay.
   *
   * `POST` rather than `GET` because the body carries a list of extras, not
   * because it changes anything — it is idempotent and holds no inventory.
   *
   * Public: an anonymous guest must be able to see a price. Signing in can
   * only ever LOWER it, since `genius` promotions need a tier (rule #3).
   */
  @Post(":slug/quote")
  @QuoteThrottle()
  quote(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(quoteRequestSchema)) body: QuoteRequestInput,
    @CurrentUser() user: AuthenticatedUser | null,
    @Req() req: Request
  ) {
    return this.pricing.quote({
      slug,
      roomId: body.roomId,
      ratePlanId: body.ratePlanId,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      occupancy: { adults: body.adults, children: body.children },
      addOns: body.addOns,
      ...(body.modifyBookingId ? { modifyBookingId: body.modifyBookingId } : {}),
      guest: guestContextOf(req, user),
      userId: user?.id ?? null,
    })
  }
}

/**
 * Who is asking, resolved SERVER-side (rule #3).
 *
 * Never from the request body. A client that could declare `tier: "genius"`
 * could mint itself any discount the platform offers.
 *
 * `mobile` is derived from the user agent and is therefore spoofable — that is
 * a known and accepted limit (rule #35), not an oversight. `genius` comes from
 * the session and cannot be faked.
 */
function guestContextOf(req: Request, user: AuthenticatedUser | null): GuestContext {
  const ua = req.headers["user-agent"] ?? ""
  // The modern client hint first; the user-agent only as a fallback.
  const hint = req.headers["sec-ch-ua-mobile"]
  const isMobile = hint === "?1" || (hint === undefined && /Mobi|Android|iPhone|iPad/i.test(ua))

  return { isMobile, tier: user?.tier ?? null }
}
