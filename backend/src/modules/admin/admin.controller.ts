import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common"
import {
  adminBookingSearchSchema,
  adminOfferSchema,
  adminRefundSchema,
  adminTransitionSchema,
  adminUserSearchSchema,
  adminUserUpdateSchema,
  auditSearchSchema,
  type AdminBookingSearchInput,
  type AdminOfferInput,
  type AdminRefundRequest,
  type AdminTransitionInput,
  type AdminUserSearchInput,
  type AdminUserUpdateInput,
  type AuditSearchInput,
} from "@stayora/shared"

import { AdminResource, CurrentUser, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import type { AuthenticatedUser } from "../auth/auth.service"
import { NotificationsService } from "../notifications/notifications.service"
import { AdminService } from "./admin.service"
import { AuditService } from "./audit.service"

/** Same header, same rule as `POST /bookings` (rule #23). */
const IDEMPOTENCY_HEADER = "idempotency-key"

/**
 * The platform's own surface (Module 11).
 *
 * Unscoped reads: this is the one caller that legitimately sees every booking
 * and every account. That is exactly why every route is `@Roles("admin")` and
 * every write lands in the audit log (rule #77).
 */
@Controller("admin/reservations")
@AdminResource("reservations")
@Roles("admin")
export class AdminReservationsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  search(@Query(new ZodValidationPipe(adminBookingSearchSchema)) query: AdminBookingSearchInput) {
    return this.admin.searchBookings(query)
  }

  /** One booking, with its money and its history — the support screen. */
  @Get(":bookingId")
  detail(@Param("bookingId") bookingId: string) {
    return this.admin.booking(bookingId)
  }

  /**
   * Refunding (rules #76, #78).
   *
   * `Idempotency-Key` is REQUIRED, and not for the usual reason. A retried
   * request must replay rather than send a second refund — but the key also
   * has to tell two DIFFERENT goodwill refunds of the same amount apart, which
   * the previous key, derived from the amount, could not do.
   */
  @Post(":bookingId/refund")
  refund(
    @Param("bookingId") bookingId: string,
    @Body(new ZodValidationPipe(adminRefundSchema)) body: AdminRefundRequest,
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new BadRequestException("An Idempotency-Key header is required")
    }
    return this.admin.refund({ bookingId, body, user, idempotencyKey, ip })
  }

  /** Forcing a status. The state machine still applies (rule #6). */
  @Post(":bookingId/status")
  transition(
    @Param("bookingId") bookingId: string,
    @Body(new ZodValidationPipe(adminTransitionSchema)) body: AdminTransitionInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    return this.admin.transition({ bookingId, body, user, ip })
  }
}

@Controller("admin/users")
@AdminResource("users")
@Roles("admin")
export class AdminUsersController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  search(@Query(new ZodValidationPipe(adminUserSearchSchema)) query: AdminUserSearchInput) {
    return this.admin.searchUsers(query)
  }

  /**
   * One account, with its history (rule #80).
   *
   * Enough to answer a complaint and no more: no password hash, which lives in
   * its own table precisely so a profile query cannot return one, and no card
   * details, which this system has never held (rule #43).
   */
  @Get(":userId")
  detail(@Param("userId") userId: string) {
    return this.admin.guest(userId)
  }

  /**
   * Role and status (rules #79, #81).
   *
   * There is no DELETE here and there will not be. Bookings, reviews and
   * payouts all point at a user; removing one makes every record they touched
   * anonymous. `suspended` stops them signing in, which is the actual want.
   */
  @Patch(":userId")
  update(
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(adminUserUpdateSchema)) body: AdminUserUpdateInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    return this.admin.updateUser({ userId, body, user, ip })
  }
}

/**
 * The audit log (rule #77).
 *
 * Read-only, and there is no route that writes one directly — a line is only
 * ever written beside the action it describes. An endpoint that could append
 * to this table on its own would be a way to put words in somebody's mouth.
 */
@Controller("admin/audit")
@AdminResource("audit")
@Roles("admin")
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query(new ZodValidationPipe(auditSearchSchema)) query: AuditSearchInput) {
    return this.audit.list(query)
  }
}

/**
 * Announcements to customers.
 *
 * Lives in the admin module rather than beside the notification routes it
 * uses, because `AdminModule` already imports `NotificationsModule` — putting
 * it the other way round would make the two modules import each other, and a
 * `forwardRef` is a lot of machinery for a single endpoint.
 *
 * The `offer` template has existed since the notification registry was
 * written, with a subject, a body and a marketing class, and nothing has ever
 * sent one. This is the trigger it was missing.
 */
@Controller("admin/offers")
@AdminResource("content")
@Roles("admin")
export class AdminOffersController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  /**
   * `Idempotency-Key` is REQUIRED, and for a sharper reason than usual.
   *
   * A retried refund pays somebody twice; a retried campaign mails thousands
   * of people twice, and the second copy is the one they remember. The key is
   * what makes a repeat a no-op — and what keeps a genuinely NEW announcement
   * distinguishable from a retry of the last one, which hashing the text could
   * not do, since sending the same offer again next month is a real thing to
   * want.
   *
   * The audience is not in the request and cannot be widened by any caller:
   * active customers, verified addresses, and the marketing switch each of
   * them set for themselves.
   */
  @Post()
  async send(
    @Body(new ZodValidationPipe(adminOfferSchema)) body: AdminOfferInput,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new BadRequestException("An Idempotency-Key header is required")
    }

    const result = await this.notifications.sendOffer({ ...body, idempotencyKey })

    /*
     * Recorded after the queueing, and never swallowed (rule #77). A message
     * that reached every customer on the platform is exactly the kind of
     * action that has to be attributable to a person by name.
     */
    await this.audit.record({
      actor: user,
      action: "notification.offer_sent",
      subjectType: "notification",
      subjectId: null,
      reason: body.title,
      metadata: { queued: result.queued, idempotencyKey },
      ip,
    })

    return result
  }
}
