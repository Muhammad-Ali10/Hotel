import type { Metadata } from "next"

import { BookingsList } from "./_components/bookings-list"

export const metadata: Metadata = {
  title: "My Bookings — Stayora",
  description: "View and manage your hotel reservations.",
}

export default function MyBookingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        My Bookings
      </h1>

      <BookingsList />
    </div>
  )
}
