/**
 * One label + one colour per status value, shared by the customer dashboard and
 * the partner extranet. Previously each surface invented its own vocabulary
 * ("cancelled" vs "Cancelled" vs "No Refund"), so the same booking read
 * differently depending on who looked at it.
 */

import type {
  BookingStatus,
  PromotionStatus,
  RefundStatus,
  ReviewStatus,
  TicketPriority,
  TicketStatus,
} from "@/types"

export const bookingStatusLabel: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  checked_in: "Checked in",
  checked_out: "Checked out",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const bookingStatusStyle: Record<BookingStatus, string> = {
  confirmed: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  pending: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
  checked_in: "border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-400",
  checked_out: "border-transparent bg-violet-500/10 text-violet-700 dark:text-violet-400",
  completed: "border-transparent bg-muted text-muted-foreground",
  cancelled: "border-transparent bg-destructive/10 text-destructive",
}

export const refundStatusLabel: Record<RefundStatus, string> = {
  full: "Full refund",
  partial: "Partial refund",
  none: "No refund",
  pending: "Refund pending",
  processed: "Refund processed",
}

export const refundStatusStyle: Record<RefundStatus, string> = {
  full: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  partial: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
  none: "border-transparent bg-muted text-muted-foreground",
  pending: "border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-400",
  processed: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
}

export const reviewStatusLabel: Record<ReviewStatus, string> = {
  published: "Published",
  pending: "Pending",
  flagged: "Flagged",
  rejected: "Rejected",
}

export const reviewStatusStyle: Record<ReviewStatus, string> = {
  published: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  pending: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
  flagged: "border-transparent bg-orange-500/10 text-orange-700 dark:text-orange-400",
  rejected: "border-transparent bg-destructive/10 text-destructive",
}

export const ticketStatusLabel: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
}

export const ticketStatusStyle: Record<TicketStatus, string> = {
  open: "border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-400",
  in_progress: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
  resolved: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
}

export const ticketPriorityLabel: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
}

export const promotionStatusLabel: Record<PromotionStatus, string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
}

export const promotionStatusStyle: Record<PromotionStatus, string> = {
  active: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  paused: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
  draft: "border-transparent bg-muted text-muted-foreground",
}
