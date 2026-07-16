import type { BookingStatus, RefundStatus, ReviewStatus, TicketStatus } from "@/types"
import { Badge } from "@/components/ui/badge"
import {
  bookingStatusLabel,
  bookingStatusStyle,
  refundStatusLabel,
  refundStatusStyle,
  reviewStatusLabel,
  reviewStatusStyle,
  ticketStatusLabel,
  ticketStatusStyle,
} from "@/lib/labels"
import { cn } from "@/lib/utils"

/** Booking status pill — identical on the dashboard and in the extranet. */
export function StatusBadge({
  status,
  className,
}: {
  status: BookingStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(bookingStatusStyle[status], className)}>
      {bookingStatusLabel[status]}
    </Badge>
  )
}

export function RefundBadge({
  status,
  className,
}: {
  status: RefundStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(refundStatusStyle[status], className)}>
      {refundStatusLabel[status]}
    </Badge>
  )
}

export function ReviewStatusBadge({
  status,
  className,
}: {
  status: ReviewStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(reviewStatusStyle[status], className)}>
      {reviewStatusLabel[status]}
    </Badge>
  )
}

export function TicketStatusBadge({
  status,
  className,
}: {
  status: TicketStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(ticketStatusStyle[status], className)}>
      {ticketStatusLabel[status]}
    </Badge>
  )
}
