import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type {
  AgentReplyInput,
  BookingConversation,
  BookingMessageInput,
  BookingMessageView,
  GuestTicketInput,
  PartnerTicketInput,
  ReplyInput,
  SupportMessageView,
  SupportSearchInput,
  SupportThreadView,
  ThreadUpdateInput,
} from "@stayora/shared"
import { CONVERSATION_PREVIEW_CHARS, formatTicketRef } from "@stayora/shared"
import { sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import type { AuthenticatedUser } from "../auth/auth.service"
import { BookingsSupportRepository } from "../bookings/bookings-support.repository"
import { BookingsRepository } from "../bookings/bookings.repository"
import { SupportRepository, type MessageRow, type ThreadRow } from "./support.repository"

/**
 * How many tickets one address may open in an hour without an account.
 *
 * A number, not zero: somebody genuinely locked out may try twice, describe it
 * badly, and try again. Past this it is not a person needing help.
 */
const ANONYMOUS_HOURLY_LIMIT = 5

@Injectable()
export class SupportService {
  constructor(
    private readonly repo: SupportRepository,
    private readonly bookings: BookingsRepository,
    private readonly bookingSupport: BookingsSupportRepository,
    @Inject(DRIZZLE) private readonly db: Database
  ) {}

  /* --------------------------------------------------------- guest opens -- */

  /**
   * A guest opening a ticket, signed in or not (rule #85).
   *
   * An anonymous ticket is a lesser thing on purpose: no account attached, no
   * booking attached, and the reply goes to the address given. It exists
   * because the most common thing support is asked is "I cannot sign in", and
   * a help desk behind a login turns that into a closed loop.
   */
  async openGuestTicket(input: {
    body: GuestTicketInput
    user: AuthenticatedUser | null
  }): Promise<SupportThreadView> {
    if (!input.user) {
      const since = new Date(Date.now() - 3_600_000).toISOString()
      const recent = await this.repo.recentByEmail(input.body.email, since)
      if (recent >= ANONYMOUS_HOURLY_LIMIT) {
        throw new BadRequestException(
          "That is a lot of tickets in one hour. Check your email — we may have already replied."
        )
      }
    }

    /*
     * A booking is only ever attached for a SIGNED-IN requester who owns it.
     *
     * The database refuses an anonymous thread with a booking outright, and
     * ownership is checked here — otherwise a ticket becomes a way to ask
     * "does this reference exist" about somebody else's stay.
     */
    let bookingId: string | null = null
    if (input.body.bookingId && input.user) {
      const booking = await this.bookings.findById(input.body.bookingId)
      if (booking?.customerId === input.user.id) bookingId = booking.id
    }

    const thread = await this.repo.open({
      thread: {
        ref: await this.nextRef(),
        audience: "guest",
        requesterId: input.user?.id ?? null,
        requesterEmail: input.body.email,
        requesterName: input.body.name,
        orgId: null,
        bookingId,
        subject: input.body.subject,
        category: input.body.category,
      },
      message: {
        authorKind: "requester",
        authorId: input.user?.id ?? null,
        authorName: input.body.name,
        body: input.body.body,
      },
    })

    return toThreadDto(thread)
  }

  /* ------------------------------------------------------- partner opens -- */

  /**
   * A partner opening a ticket (rule #88).
   *
   * The org comes from the SESSION and never from the request. A thread here
   * discusses commission, payouts and the contract, and belongs to the hotel
   * rather than to whichever colleague happened to type it.
   */
  async openPartnerTicket(input: {
    body: PartnerTicketInput
    user: AuthenticatedUser
  }): Promise<SupportThreadView> {
    if (!input.user.partner) {
      throw new ForbiddenException("This account is not linked to a property")
    }

    let bookingId: string | null = null
    if (input.body.bookingId) {
      const allowed = await this.bookingSupport.propertyIdsForOrg(
        input.user.partner.orgId,
        input.user.partner.propertyIds
      )
      const booking = await this.bookings.findById(input.body.bookingId)
      if (booking && allowed.includes(booking.propertyId)) bookingId = booking.id
    }

    const thread = await this.repo.open({
      thread: {
        ref: await this.nextRef(),
        audience: "partner",
        requesterId: input.user.id,
        requesterEmail: input.user.email,
        requesterName: `${input.user.firstName} ${input.user.lastName}`.trim(),
        orgId: input.user.partner.orgId,
        bookingId,
        subject: input.body.subject,
        category: input.body.category,
      },
      message: {
        authorKind: "requester",
        authorId: input.user.id,
        authorName: `${input.user.firstName} ${input.user.lastName}`.trim(),
        body: input.body.body,
      },
    })

    return toThreadDto(thread)
  }

  /* -------------------------------------------------------------- reading -- */

  /**
   * One thread, if this caller may see it (rules #86, #88).
   *
   * Internal notes are stripped for anybody but the platform. A 404 rather
   * than a 403 for a thread that is not theirs — a 403 confirms the id is real
   * (API1).
   */
  async thread(input: { threadId: string; user: AuthenticatedUser }) {
    const thread = await this.repo.findById(input.threadId)
    if (!thread || !this.canSee(thread, input.user)) {
      throw new NotFoundException("Ticket not found")
    }

    const isAgent = input.user.role === "admin"
    const messages = await this.repo.messagesFor(thread.id, isAgent)

    return { thread: toThreadDto(thread), messages: messages.map(toMessageDto) }
  }

  listMine(user: AuthenticatedUser) {
    return this.repo
      .listForRequester(user.id, 100)
      .then((rows) => rows.map((row) => toThreadDto(row)))
  }

  /** The whole team's tickets, not just this member's (rule #88). */
  listForOrg(user: AuthenticatedUser) {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    return this.repo
      .listForOrg(user.partner.orgId, 100)
      .then((rows) => rows.map((row) => toThreadDto(row)))
  }

  /**
   * A property's guest inbox (rule #89).
   *
   * Scoped to the ORG, not the member: whoever is on the desk this morning
   * answers what came in overnight, and a conversation only the person who
   * sold the room can see is one nobody answers on their day off.
   */
  async conversationsForOrg(input: {
    user: AuthenticatedUser
    limit: number
    before?: string
  }) {
    if (!input.user.partner) {
      throw new ForbiddenException("This account is not linked to a property")
    }

    const rows = await this.repo.conversationsForOrg({
      orgId: input.user.partner.orgId,
      limit: input.limit,
      before: input.before,
    })

    const hasMore = rows.length > input.limit
    const page = hasMore ? rows.slice(0, input.limit) : rows

    const items: BookingConversation[] = page.map((row) => ({
      bookingId: row.booking_id,
      ref: row.ref,
      guestName: row.guest_name,
      propertyId: row.property_id,
      propertyName: row.property_name,
      checkIn: row.check_in,
      checkOut: row.check_out,
      status: row.status,
      preview: preview(row.last_body),
      lastSide: row.last_side as BookingConversation["lastSide"],
      lastMessageAt: row.last_at,
      // COUNT comes back as a string from node-postgres.
      unread: Number(row.unread),
    }))

    return { items, nextCursor: hasMore ? page[page.length - 1]!.last_at : null }
  }

  async queue(query: SupportSearchInput) {
    /*
     * The page and the counts, together.
     *
     * The counts are what the status tabs and the sidebar badge read, and they
     * count the WHOLE queue rather than the page — a badge that only knew
     * about the fifty rows on screen would drop to zero the moment somebody
     * filtered, which is the opposite of what a queue badge is for.
     */
    const [page, counts] = await Promise.all([
      this.repo.queue(query),
      this.repo.queueCounts(query.audience),
    ])

    return {
      items: page.items.map((row) => toThreadDto(row)),
      nextCursor: page.nextCursor,
      counts,
    }
  }

  /* ------------------------------------------------------------- replying -- */

  /**
   * The requester answering.
   *
   * A reply on a resolved thread REOPENS it. Somebody writing back after being
   * told a matter is closed is by definition telling you it is not, and leaving
   * it resolved means nobody ever looks again.
   */
  async reply(input: { threadId: string; body: ReplyInput; user: AuthenticatedUser }) {
    const thread = await this.repo.findById(input.threadId)
    if (!thread || !this.canSee(thread, input.user)) {
      throw new NotFoundException("Ticket not found")
    }
    if (input.user.role === "admin") {
      throw new BadRequestException("Use the agent reply endpoint")
    }

    const message = await this.repo.reply({
      threadId: thread.id,
      message: {
        authorKind: "requester",
        authorId: input.user.id,
        authorName: `${input.user.firstName} ${input.user.lastName}`.trim(),
        body: input.body.body,
      },
      touchesClock: true,
      reopen: thread.status === "resolved",
    })

    return toMessageDto(message)
  }

  /**
   * The platform answering.
   *
   * An agent's reply does NOT move the queue clock: `last_message_at` means
   * "waiting since", and answering a ticket must not push it back to the front
   * of the queue it was just taken off.
   */
  async agentReply(input: { threadId: string; body: AgentReplyInput; user: AuthenticatedUser }) {
    const thread = await this.repo.findById(input.threadId)
    if (!thread) throw new NotFoundException("Ticket not found")

    const message = await this.repo.reply({
      threadId: thread.id,
      message: {
        authorKind: input.body.internal ? "internal" : "agent",
        authorId: input.user.id,
        authorName: `${input.user.firstName} ${input.user.lastName}`.trim(),
        body: input.body.body,
      },
      touchesClock: false,
      reopen: false,
    })

    /*
     * Answering picks the thread up.
     *
     * An `open` thread somebody has replied to is not open any more, and
     * leaving it that way means the next person picks it up again.
     */
    if (thread.status === "open" && !input.body.internal) {
      await this.repo.updateThread(thread.id, {
        status: "in_progress",
        assigneeId: thread.assigneeId ?? input.user.id,
      })
    }

    return toMessageDto(message)
  }

  /** Status, priority, assignment — the agent's controls. */
  async updateThread(input: {
    threadId: string
    body: ThreadUpdateInput
    user: AuthenticatedUser
  }) {
    const thread = await this.repo.findById(input.threadId)
    if (!thread) throw new NotFoundException("Ticket not found")

    const patch: Record<string, unknown> = { ...input.body }
    if (input.body.status !== undefined) {
      /*
       * The CHECK insists resolved and only resolved carries a time, and the
       * time is the SERVER's. A client that could name it could resolve a
       * thread into the past and out of every report.
       */
      patch.resolvedAt = input.body.status === "resolved" ? new Date().toISOString() : null
    }

    const updated = await this.repo.updateThread(thread.id, patch)
    return toThreadDto(updated!)
  }

  /**
   * Links anonymous tickets to an account that just proved the address
   * (rule #86).
   *
   * Called on sign-in. Never by hand: support saying "this ticket belongs to
   * that person" is exactly the request social engineering is made of.
   */
  claimAnonymous(user: { id: string; email: string }) {
    return this.repo.claimAnonymous({ userId: user.id, email: user.email })
  }

  /* ----------------------------------------------------- booking messages -- */

  /**
   * A guest and a property, about one booking (rule #89).
   *
   * Not support: no category, no priority, no assignee, no resolution. The
   * platform is not a participant — it can read one for a dispute, which is
   * what the admin reservation screen is for, but it does not answer.
   */
  async postBookingMessage(input: {
    bookingId: string
    body: BookingMessageInput
    user: AuthenticatedUser
  }): Promise<BookingMessageView> {
    const side = await this.sideFor(input.bookingId, input.user)

    const created = await this.repo.addBookingMessage({
      bookingId: input.bookingId,
      authorSide: side,
      authorId: input.user.id,
      authorName: `${input.user.firstName} ${input.user.lastName}`.trim(),
      body: input.body.body,
    })

    return toBookingMessageDto(created)
  }

  async bookingMessages(input: { bookingId: string; user: AuthenticatedUser }) {
    const side = await this.sideFor(input.bookingId, input.user)
    const rows = await this.repo.bookingMessages(input.bookingId)
    // Opening the conversation is reading it; a separate "mark read" call is
    // one every client forgets.
    await this.repo.markRead({ bookingId: input.bookingId, readerSide: side })
    return { side, messages: rows.map(toBookingMessageDto) }
  }

  /* ----------------------------------------------------------------- local */

  /**
   * Which side of a booking conversation this caller is on.
   *
   * A 404 for anybody who is neither — the guest who owns it or somebody at
   * the property that sold it. A 403 would confirm the booking exists (API1).
   */
  private async sideFor(
    bookingId: string,
    user: AuthenticatedUser
  ): Promise<"guest" | "property"> {
    const booking = await this.bookings.findById(bookingId)
    if (!booking) throw new NotFoundException("Booking not found")

    if (booking.customerId === user.id) return "guest"

    if (user.partner) {
      const allowed = await this.bookingSupport.propertyIdsForOrg(
        user.partner.orgId,
        user.partner.propertyIds
      )
      if (allowed.includes(booking.propertyId)) return "property"
    }

    throw new NotFoundException("Booking not found")
  }

  /**
   * Who may see a thread (rules #86, #88).
   *
   * A partner thread belongs to the ORG, so any of its members may read it —
   * that is what makes it the hotel's conversation rather than one colleague's.
   * A guest thread is that guest's alone. The platform sees everything, which
   * is the point of a support desk.
   */
  private canSee(thread: ThreadRow, user: AuthenticatedUser): boolean {
    if (user.role === "admin") return true

    if (thread.audience === "partner") {
      return user.partner !== null && user.partner?.orgId === thread.orgId
    }

    return thread.requesterId !== null && thread.requesterId === user.id
  }

  /** `TKT-000123`, from a sequence that cannot collide (rule #8). */
  private async nextRef(): Promise<string> {
    const result = await this.db.execute<{ n: string }>(
      sql`SELECT nextval('support_ticket_seq') AS n`
    )
    return formatTicketRef(Number(result.rows[0]?.n ?? 1))
  }
}

/* ------------------------------------------------------------------- DTOs -- */

function toThreadDto(row: ThreadRow): SupportThreadView {
  return {
    id: row.id,
    ref: row.ref,
    audience: row.audience as SupportThreadView["audience"],
    subject: row.subject,
    category: row.category,
    priority: row.priority,
    status: row.status,
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail,
    requesterId: row.requesterId,
    orgId: row.orgId,
    bookingId: row.bookingId,
    assigneeId: row.assigneeId,
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  }
}

function toMessageDto(row: MessageRow): SupportMessageView {
  return {
    id: row.id,
    authorKind: row.authorKind as SupportMessageView["authorKind"],
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt,
  }
}

function toBookingMessageDto(row: {
  id: string
  authorSide: string
  authorName: string
  body: string
  readAt: string | null
  createdAt: string
}): BookingMessageView {
  return {
    id: row.id,
    side: row.authorSide as BookingMessageView["side"],
    authorName: row.authorName,
    body: row.body,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }
}

/** The first line of the last message, and no more of it. */
function preview(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim()
  return flat.length > CONVERSATION_PREVIEW_CHARS
    ? `${flat.slice(0, CONVERSATION_PREVIEW_CHARS - 1)}…`
    : flat
}
