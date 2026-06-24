import Image from "next/image"

import { bookings } from "@/data"
import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatDate } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "./status-badge"

export function RecentBookings() {
  return (
    <Card>
      <CardContent className="divide-border divide-y p-0">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={placeholderImage(booking.seed, 120, 120)}
                  alt={booking.hotel}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{booking.hotel}</p>
                <p className="text-muted-foreground text-sm">
                  {formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <span className="font-heading font-semibold">
                {formatCurrency(booking.total)}
              </span>
              <StatusBadge status={booking.status} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
