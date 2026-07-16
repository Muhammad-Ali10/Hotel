"use client"

import { NotificationBell } from "@/components/shared/notification-bell"

/**
 * The partner's bell. It now reads the shared notification feed, so a booking
 * taken on the public site or a guest cancellation raises an alert here — the
 * old feed was a fixed list that named a property outside the portfolio and
 * renamed guests who appeared elsewhere in the extranet.
 */
export function NotificationsMenu() {
  return <NotificationBell audience="partner" href="/extranet/inbox" />
}
