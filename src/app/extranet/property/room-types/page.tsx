import Link from "next/link"
import { BedDouble, ChevronLeft, Ruler, Users } from "lucide-react"

import type { Stat } from "@/lib/extranet/types"
import { roomTypes, roomTypeStats } from "@/data/extranet"
import { formatCurrency } from "@/lib/format"
import { PageHeader, StatGrid } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { AddRoomTypeDialog } from "./_components/add-room-type-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const stats: Stat[] = [
  { label: "Total Rooms", value: String(roomTypeStats.totalRooms) },
  { label: "Currently Booked", value: String(roomTypeStats.booked) },
  { label: "Available", value: String(roomTypeStats.available) },
]

export default function RoomTypesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Room Types"
        subtitle="Manage room categories, pricing, and inventory"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/property" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <AddRoomTypeDialog />
      </PageHeader>

      <StatGrid stats={stats} className="lg:grid-cols-3" />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {roomTypes.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-heading text-base font-semibold">
                    {r.name}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {r.description}
                  </p>
                </div>
                <p className="font-heading shrink-0 text-right text-lg font-semibold">
                  {formatCurrency(r.price)}
                  <span className="text-muted-foreground block text-xs font-normal">
                    per night
                  </span>
                </p>
              </div>

              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1.5">
                  <BedDouble className="size-4" />
                  {r.bed}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="size-4" />
                  {r.guests} guests
                </span>
                <span className="flex items-center gap-1.5">
                  <Ruler className="size-4" />
                  {r.size} m²
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Availability</span>
                  <span className="font-medium">
                    {r.booked}/{r.units} booked
                  </span>
                </div>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-foreground h-full rounded-full"
                    style={{ width: `${(r.booked / r.units) * 100}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  {r.available} available now
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {r.amenities.map((a) => (
                  <Badge key={a} variant="secondary">
                    {a}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
