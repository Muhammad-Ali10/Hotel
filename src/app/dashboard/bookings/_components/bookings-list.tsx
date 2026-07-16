"use client"

import Link from "next/link"
import { CalendarX } from "lucide-react"

import { useMyBookings } from "@/store/selectors"
import { Button } from "@/components/ui/button"
import { BookingCard } from "./booking-card"

export function BookingsList() {
  const bookings = useMyBookings()

  if (bookings.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <CalendarX className="text-muted-foreground size-8" />
        <div className="space-y-1">
          <p className="font-medium">No bookings yet</p>
          <p className="text-muted-foreground text-sm">
            Your reservations will appear here once you book a stay.
          </p>
        </div>
        <Button size="sm" render={<Link href="/hotels">Browse hotels</Link>} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
    </div>
  )
}
