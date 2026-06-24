import type { Metadata } from "next"

import { bookings } from "@/data"
import { BookingCard } from "./_components/booking-card"

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

      <div className="space-y-4">
        {bookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
      </div>
    </div>
  )
}
