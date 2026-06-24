import Image from "next/image"
import { CalendarDays, Users } from "lucide-react"

import { upcomingTrips } from "@/data"
import { placeholderImage } from "@/lib/images"
import { formatDate } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "./status-badge"

export function UpcomingTrips() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {upcomingTrips.map((trip) => (
        <Card key={trip.id} className="group overflow-hidden pt-0">
          <div className="relative aspect-[2/1] w-full overflow-hidden">
            <Image
              src={placeholderImage(trip.seed, 800, 400)}
              alt={trip.hotel}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <StatusBadge
              status={trip.status}
              className="absolute top-3 right-3 backdrop-blur"
            />
          </div>

          <CardContent className="space-y-2">
            <h3 className="font-heading text-lg font-semibold">{trip.hotel}</h3>
            <p className="text-muted-foreground text-sm">{trip.room}</p>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 text-sm">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4" />
                {formatDate(trip.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-4" />
                {trip.guests} guests
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
