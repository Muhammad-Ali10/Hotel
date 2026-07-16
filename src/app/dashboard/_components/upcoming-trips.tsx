"use client"

import Link from "next/link"
import Image from "next/image"
import { CalendarDays, Plane, Users } from "lucide-react"

import { placeholderImage } from "@/lib/images"
import { formatStay } from "@/lib/domain"
import { useMyUpcomingBookings } from "@/store/selectors"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"

/** Trips are upcoming bookings — not a separate list that could drift from them. */
export function UpcomingTrips() {
  const trips = useMyUpcomingBookings()

  if (trips.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
        <Plane className="text-muted-foreground size-8" />
        <div className="space-y-1">
          <p className="font-medium">No upcoming trips</p>
          <p className="text-muted-foreground text-sm">
            Book a stay and it will show up here.
          </p>
        </div>
        <Button size="sm" render={<Link href="/hotels">Browse hotels</Link>} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {trips.map((trip) => (
        <Card key={trip.id} className="group overflow-hidden pt-0">
          <div className="relative aspect-[2/1] w-full overflow-hidden">
            <Image
              src={placeholderImage(trip.seed, 800, 400)}
              alt={trip.hotelName}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <StatusBadge status={trip.status} className="absolute top-3 right-3 backdrop-blur" />
          </div>

          <CardContent className="space-y-2">
            <h3 className="font-heading text-lg font-semibold">{trip.hotelName}</h3>
            <p className="text-muted-foreground text-sm">{trip.roomName}</p>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 text-sm">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4" />
                {formatStay(trip.checkIn, trip.checkOut)}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-4" />
                {trip.guests} {trip.guests === 1 ? "guest" : "guests"}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
