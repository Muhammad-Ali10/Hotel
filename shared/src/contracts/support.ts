import { z } from "zod"

import { emailSchema, uuidSchema } from "./common"

/* ============================================================================
 * Support (Module 13, rules #85–#90).
 * ========================================================================== */

export const SUPPORT_AUDIENCES = ["guest", "partner"] as const
export const SUPPORT_STATUSES = ["open", "in_progress", "resolved"] as const
export const SUPPORT_PRIORITIES = ["low", "medium", "high"] as const

/**
 * The categories, per audience — and they are genuinely different.
 *
 * A guest writes about a booking or a refund; a partner writes about
 * connectivity, payouts and their contract. One shared list would offer each
 * of them the other's problems, and a category nobody picks is worse than none.
 */
export const GUEST_CATEGORIES = [
  "general",
  "booking",
  "billing",
  "cancellation",
  "account",
  "technical",
] as const

export const PARTNER_CATEGORIES = [
  "general",
  "connectivity",
  "finance",
  "booking",
  "content",
  "guests",
  "technical",
] as const

const bodySchema = z
  .string()
  .trim()
  .min(10, "Say a little more — this is what somebody has to answer")
  .max(5000)

/**
 * Opening a ticket as a GUEST — signed in or not (rule #85).
 *
 * `email` and `name` are required even for a signed-in guest: somebody may
 * open a ticket from one account and need the reply where they can actually
 * read it, and it is the only handle an anonymous ticket has at all.
 *
 * `bookingId` is accepted but only HONOURED for a signed-in requester. On an
 * anonymous ticket it is dropped, and the database refuses it anyway —
 * attaching a booking to an unproven address hands somebody else's reservation
 * to whoever asked.
 */
export const guestTicketSchema = z
  .object({
    subject: z.string().trim().min(3).max(200),
    category: z.enum(GUEST_CATEGORIES).default("general"),
    body: bodySchema,
    email: emailSchema,
    name: z.string().trim().min(1).max(160),
    bookingId: uuidSchema.optional(),
  })
  .strict()

export type GuestTicketInput = z.infer<typeof guestTicketSchema>

/** Opening a ticket as a PARTNER. The org comes from the session, never here. */
export const partnerTicketSchema = z
  .object({
    subject: z.string().trim().min(3).max(200),
    category: z.enum(PARTNER_CATEGORIES).default("general"),
    body: bodySchema,
    bookingId: uuidSchema.optional(),
  })
  .strict()

export type PartnerTicketInput = z.infer<typeof partnerTicketSchema>

export const replySchema = z.object({ body: bodySchema }).strict()
export type ReplyInput = z.infer<typeof replySchema>

/**
 * An agent's reply.
 *
 * `internal` is a note the requester never sees — where somebody writes "third
 * refund this month" without saying it to the guest. It is on the same
 * endpoint deliberately: a separate route for private notes is a route
 * somebody eventually points at the wrong thread.
 */
export const agentReplySchema = z
  .object({ body: bodySchema, internal: z.boolean().default(false) })
  .strict()

export type AgentReplyInput = z.infer<typeof agentReplySchema>

/** The platform's queue. */
export const supportSearchSchema = z
  .object({
    audience: z.enum(SUPPORT_AUDIENCES).optional(),
    status: z.enum(SUPPORT_STATUSES).optional(),
    priority: z.enum(SUPPORT_PRIORITIES).optional(),
    assigneeId: uuidSchema.optional(),
    q: z.string().trim().max(160).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.string().max(64).optional(),
  })
  .strict()

export type SupportSearchInput = z.infer<typeof supportSearchSchema>

/**
 * What an agent may change.
 *
 * `status` is here and `resolvedAt` is not — the timestamp is the server's to
 * set, and a client that could name it could resolve a thread into the past.
 */
export const threadUpdateSchema = z
  .object({
    status: z.enum(SUPPORT_STATUSES),
    priority: z.enum(SUPPORT_PRIORITIES),
    /** `null` unassigns — somebody handing a thread back to the queue. */
    assigneeId: uuidSchema.nullable(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change" })

export type ThreadUpdateInput = z.infer<typeof threadUpdateSchema>

export type SupportMessageView = {
  id: string
  authorKind: "requester" | "agent" | "internal"
  authorName: string
  body: string
  createdAt: string
}

export type SupportThreadView = {
  id: string
  ref: string
  audience: "guest" | "partner"
  subject: string
  category: string
  priority: string
  status: string
  requesterName: string
  requesterEmail: string
  /** `null` on an anonymous ticket, which carries no account (rule #85). */
  requesterId: string | null
  orgId: string | null
  bookingId: string | null
  assigneeId: string | null
  lastMessageAt: string
  createdAt: string
  resolvedAt: string | null
}

/* ------------------------------------------------- booking messages (#89) */

/**
 * A guest and a property, about one booking.
 *
 * Not support: no category, no priority, no assignee, no resolution. A stay
 * ends and the conversation stops.
 */
export const bookingMessageSchema = z.object({ body: bodySchema }).strict()
export type BookingMessageInput = z.infer<typeof bookingMessageSchema>

export type BookingMessageView = {
  id: string
  side: "guest" | "property"
  authorName: string
  body: string
  readAt: string | null
  createdAt: string
}

/**
 * One row of a property's message inbox.
 *
 * A conversation, not a message: what the partner is choosing between is
 * bookings that have something to say, so the row carries who and which stay
 * alongside the last thing said.
 *
 * `preview` is trimmed server-side. Sending the whole body for a list nobody
 * has opened yet means an inbox of fifty conversations downloads fifty essays.
 */
export type BookingConversation = {
  bookingId: string
  ref: string
  guestName: string
  propertyId: string
  propertyName: string
  checkIn: string
  checkOut: string
  status: string
  preview: string
  lastSide: "guest" | "property"
  lastMessageAt: string
  /** Messages from the guest this property has not opened yet. */
  unread: number
}

/** How much of the last message a list row carries. */
export const CONVERSATION_PREVIEW_CHARS = 160
