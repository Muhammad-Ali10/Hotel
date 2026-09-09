import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { z } from "zod"
import {
  agentReplySchema,
  bookingMessageSchema,
  guestTicketSchema,
  partnerTicketSchema,
  replySchema,
  supportSearchSchema,
  threadUpdateSchema,
  type AgentReplyInput,
  type BookingMessageInput,
  type GuestTicketInput,
  type PartnerTicketInput,
  type ReplyInput,
  type SupportSearchInput,
  type ThreadUpdateInput,
} from "@stayora/shared"

import { AdminResource, CurrentUser, Public, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { AuthThrottle } from "../../common/throttling/throttling"
import type { AuthenticatedUser } from "../auth/auth.service"
import { SupportService } from "./support.service"

/**
 * The guest's side of support (rules #85, #86).
 *
 * `@Public()` on the route that OPENS a ticket, and only that one. The most
 * common thing support is asked is "I cannot sign in", and a help desk behind
 * a login turns that into a closed loop. Everything else here needs a session,
 * because everything else is about a specific person's tickets.
 */
@Controller("support/tickets")
export class SupportTicketsController {
  constructor(private readonly support: SupportService) {}

  /**
   * Opening a ticket, signed in or not.
   *
   * The guard still resolves a session when one is present — a signed-in guest
   * gets their account attached, an anonymous one does not, and the difference
   * is what rule #85 is about.
   *
   * Throttled like an auth route: it accepts an email address from anybody and
   * causes mail to be sent to it.
   */
  @Post()
  @Public()
  @AuthThrottle()
  open(
    @Body(new ZodValidationPipe(guestTicketSchema)) body: GuestTicketInput,
    @CurrentUser() user: AuthenticatedUser | null
  ) {
    return this.support.openGuestTicket({ body, user })
  }

  /** This guest's own tickets — matched on the ACCOUNT, never the address. */
  @Get()
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.support.listMine(user)
  }

  @Get(":threadId")
  thread(@Param("threadId") threadId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.support.thread({ threadId, user })
  }

  /** A reply on a resolved ticket reopens it — see the service. */
  @Post(":threadId/reply")
  reply(
    @Param("threadId") threadId: string,
    @Body(new ZodValidationPipe(replySchema)) body: ReplyInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.support.reply({ threadId, body, user })
  }
}

/**
 * The partner's side (rule #88).
 *
 * A thread here discusses commission, payouts and the contract. It belongs to
 * the ORG — any of its members may read it — and it is never reachable from a
 * guest's session.
 */
@Controller("partner/support")
@Roles("partner")
export class PartnerSupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.support.listForOrg(user)
  }

  @Post()
  open(
    @Body(new ZodValidationPipe(partnerTicketSchema)) body: PartnerTicketInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.support.openPartnerTicket({ body, user })
  }

  @Get(":threadId")
  thread(@Param("threadId") threadId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.support.thread({ threadId, user })
  }

  @Post(":threadId/reply")
  reply(
    @Param("threadId") threadId: string,
    @Body(new ZodValidationPipe(replySchema)) body: ReplyInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.support.reply({ threadId, body, user })
  }
}

/**
 * The platform's inbox.
 *
 * Both audiences in one queue, ordered by longest wait — newest-first is the
 * ordering that lets a ticket sit for a week while fresh ones get answered.
 */
@Controller("admin/support")
@AdminResource("inbox")
@Roles("admin")
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  queue(@Query(new ZodValidationPipe(supportSearchSchema)) query: SupportSearchInput) {
    return this.support.queue(query)
  }

  /** Internal notes are included here, and nowhere else. */
  @Get(":threadId")
  thread(@Param("threadId") threadId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.support.thread({ threadId, user })
  }

  @Post(":threadId/reply")
  reply(
    @Param("threadId") threadId: string,
    @Body(new ZodValidationPipe(agentReplySchema)) body: AgentReplyInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.support.agentReply({ threadId, body, user })
  }

  @Patch(":threadId")
  update(
    @Param("threadId") threadId: string,
    @Body(new ZodValidationPipe(threadUpdateSchema)) body: ThreadUpdateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.support.updateThread({ threadId, body, user })
  }
}

/**
 * A guest and a property, about one booking (rule #89).
 *
 * Deliberately not under `/support` — this is not support. There is no
 * category, no priority, no assignee and no resolution: a stay ends and the
 * conversation stops. The platform is not a participant.
 *
 * Authenticated but role-free: the two sides are the guest who owns the
 * booking and somebody at the property that sold it, and the service works out
 * which one is asking. Anybody else gets a 404, never a 403 (API1).
 */
@Controller("bookings/:bookingId/messages")
export class BookingMessagesController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@Param("bookingId") bookingId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.support.bookingMessages({ bookingId, user })
  }

  @Post()
  post(
    @Param("bookingId") bookingId: string,
    @Body(new ZodValidationPipe(bookingMessageSchema)) body: BookingMessageInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.support.postBookingMessage({ bookingId, body, user })
  }
}

const conversationsSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    /** Keyset cursor: the `lastMessageAt` of the last row seen. */
    before: z.string().max(64).optional(),
  })
  .strict()

type ConversationsInput = z.infer<typeof conversationsSchema>

/**
 * A property's guest inbox.
 *
 * Reading a list lives here; reading and replying to ONE conversation stay on
 * `/bookings/:id/messages`, where both sides already meet. Giving the partner
 * its own reply route would be a second code path to the same table, and the
 * two would drift on who is allowed to write.
 */
@Controller("partner/messages")
@Roles("partner")
export class PartnerMessagesController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(conversationsSchema)) query: ConversationsInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.support.conversationsForOrg({ user, ...query })
  }
}
