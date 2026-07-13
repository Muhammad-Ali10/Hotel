/**
 * Mock notification feed for the extranet topbar bell. Kept separate from
 * `notificationSettings` (account.ts) which is the preferences toggle list.
 */
export type NotificationKind =
  | "booking"
  | "message"
  | "review"
  | "payment"
  | "system"

export type NotificationItem = {
  id: string
  kind: NotificationKind
  title: string
  description: string
  time: string
  unread: boolean
}

export const notificationFeed: NotificationItem[] = [
  {
    id: "n1",
    kind: "booking",
    title: "New reservation",
    description: "Olivia Bennett booked a Deluxe Suite at Grand Horizon.",
    time: "5 min ago",
    unread: true,
  },
  {
    id: "n2",
    kind: "message",
    title: "New guest message",
    description: "James Carter asked about early check-in.",
    time: "22 min ago",
    unread: true,
  },
  {
    id: "n3",
    kind: "review",
    title: "New 5-star review",
    description: "Sofia Rossi left a review for Aurora Bay Resort.",
    time: "1 hour ago",
    unread: true,
  },
  {
    id: "n4",
    kind: "payment",
    title: "Payout processed",
    description: "$12,480 has been sent to your bank account.",
    time: "3 hours ago",
    unread: true,
  },
  {
    id: "n5",
    kind: "booking",
    title: "Reservation cancelled",
    description: "Booking #RSV-2041 was cancelled by the guest.",
    time: "Yesterday",
    unread: false,
  },
  {
    id: "n6",
    kind: "system",
    title: "Rate plan approved",
    description: "Your new Summer Flexible rate plan is now live.",
    time: "2 days ago",
    unread: false,
  },
]
