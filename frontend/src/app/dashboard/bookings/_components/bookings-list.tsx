"use client"

import Link from "next/link"
import { AlertTriangle, CalendarX } from "lucide-react"

import { useMyBookings, useSession } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BookingCard } from "./booking-card"

/**
 * The guest's own bookings, from the server.
 *
 * It read a zustand store filled from a fixture, which meant a guest who had
 * just booked through the real checkout arrived here and saw somebody else's
 * reservations — and never their own.
 */
export function BookingsList() {
  const session = useSession()
  const { data, isLoading, error } = useMyBookings()

  const bookings = data ?? []

  if (!session.isLoading && !session.data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <p className="font-heading text-lg font-semibold">Sign in to see your bookings</p>
          <Button render={<Link href="/login">Sign in</Link>} />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          {error.message}
          {error.isRetryable ? " Try again in a moment." : null}
        </span>
      </div>
    )
  }

  /*
   * Loading is its own state, not "no bookings".
   *
   * The store was always populated so there was no in-between. Over a network
   * there is, and showing "No bookings yet" for the second before the response
   * lands tells a guest their reservation is gone.
   */
  if (isLoading || session.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading bookings">
        {[0, 1].map((i) => (
          <div key={i} className="bg-muted h-48 w-full animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

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
