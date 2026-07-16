"use client"

import Link from "next/link"
import Image from "next/image"

import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatDate } from "@/lib/format"
import { useMyBookings } from "@/store/selectors"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"

export function RecentBookings() {
  const bookings = useMyBookings().slice(0, 5)

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground text-sm">
            No bookings yet. <Link href="/hotels" className="text-primary hover:underline">
              Find a stay
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="divide-border divide-y p-0">
        {bookings.map((booking) => (
          <Link
            key={booking.id}
            href="/dashboard/bookings"
            className="hover:bg-accent/40 flex flex-col gap-3 px-5 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={placeholderImage(booking.seed, 120, 120)}
                  alt={booking.hotelName}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{booking.hotelName}</p>
                <p className="text-muted-foreground text-sm">
                  {formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <span className="font-heading font-semibold">
                {formatCurrency(booking.pricing.total)}
              </span>
              <StatusBadge status={booking.status} />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
