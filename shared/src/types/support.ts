import type { ISODateTime, ImageSeed, Timestamps, UUID } from "./common"

/* --------------------------------------------------------- notifications -- */

export type NotificationType = "booking" | "offer" | "review" | "system" | "message"

export type NotificationAudience = "customer" | "partner" | "admin"

export type AppNotification = {
  id: UUID
  userId: UUID
  audience: NotificationAudience
  type: NotificationType
  title: string
  message: string
  /** In-app link to the referenced entity. */
  href: string | null
  read: boolean
  createdAt: ISODateTime
}

/* --------------------------------------------------------------- tickets -- */

export type TicketStatus = "open" | "in_progress" | "resolved"
export type TicketPriority = "low" | "medium" | "high"

export type TicketMessage = {
  id: UUID
  ticketId: UUID
  from: "user" | "support"
  author: string
  text: string
  createdAt: ISODateTime
}

export type SupportTicket = Timestamps & {
  id: UUID

  /**
   * Guest-facing reference, `TKT-000123`, from a database SEQUENCE (rule #8).
   *
   * The prototype generated `TKT-1000`…`TKT-9999` at random with no uniqueness
   * check at all — 9,000 possible values, and past ~100 tickets a collision is
   * more likely than not. Bookings had a retry loop; tickets had nothing.
   */
  ref: string

  subject: string
  category: string
  priority: TicketPriority
  status: TicketStatus

  createdBy: NotificationAudience
  /** Who opened it. `null` for a signed-out contact-form submission. */
  authorId: UUID | null
  authorName: string
  email: string

  propertyId: UUID | null
  bookingId: UUID | null

  seed: ImageSeed
}

/* ------------------------------------------------------------ favourites -- */

export type Favorite = {
  userId: UUID
  propertyId: UUID
  createdAt: ISODateTime
}
