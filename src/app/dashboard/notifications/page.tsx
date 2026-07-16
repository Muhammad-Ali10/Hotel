import type { Metadata } from "next"

import { NotificationList } from "./_components/notification-list"

export const metadata: Metadata = {
  title: "Notifications — Stayora",
  description: "Updates about your bookings, reviews and offers.",
}

export default function NotificationsPage() {
  return <NotificationList />
}
