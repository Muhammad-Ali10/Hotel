"use client"

import * as React from "react"
import Link from "next/link"
import { BedDouble, ExternalLink, Pencil, Ruler, Users } from "lucide-react"
import { toast } from "sonner"

import type { Room } from "@/types"
import type { Stat as ExtranetStat } from "@/lib/extranet/types"
import { formatCurrency } from "@/lib/format"
import { datesInRange, toISODate } from "@/lib/domain"
import { useStore } from "@/store"
import { useActiveHotel, usePartnerReservations } from "@/store/selectors"
import { PageHeader, StatGrid } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NotFoundCard } from "@/components/shared/not-found-card"

/**
 * The property's rooms — the same rooms a guest picks on the listing. The
 * partner's rooms and the public rooms used to be two different taxonomies with
 * different names, sizes and shapes, so a rate set here reached nobody.
 */
export function RoomTypesGrid() {
  const hotel = useActiveHotel()
  const reservations = usePartnerReservations()
  const [editing, setEditing] = React.useState<Room | null>(null)

  // Occupancy is counted from live reservations rather than stored per room.
  const bookedByRoom = React.useMemo(() => {
    const today = toISODate(new Date())
    const map = new Map<string, number>()
    for (const r of reservations) {
      if (!hotel || r.hotelId !== hotel.id) continue
      if (!datesInRange(r.checkIn, r.checkOut).includes(today)) continue
      map.set(r.roomId, (map.get(r.roomId) ?? 0) + 1)
    }
    return map
  }, [reservations, hotel])

  if (!hotel) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to manage its rooms."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const totalRooms = hotel.rooms.reduce((sum, r) => sum + r.units, 0)
  const booked = [...bookedByRoom.values()].reduce((a, b) => a + b, 0)

  const stats: ExtranetStat[] = [
    { label: "Total Rooms", value: String(totalRooms) },
    { label: "Occupied Tonight", value: String(booked) },
    { label: "Available", value: String(totalRooms - booked) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Room Types" subtitle={`Rooms, pricing and inventory for ${hotel.name}`}>
        <Button
          variant="outline"
          size="sm"
          render={
            <Link href={`/hotels/${hotel.id}#rooms`} target="_blank">
              <ExternalLink className="size-4" />
              View public rooms
            </Link>
          }
        />
        <Button variant="outline" size="sm" render={<Link href="/extranet/property" />}>
          Back
        </Button>
      </PageHeader>

      <StatGrid stats={stats} className="lg:grid-cols-3" />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {hotel.rooms.map((r) => {
          const roomBooked = bookedByRoom.get(r.id) ?? 0
          return (
            <Card key={r.id}>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-heading text-base font-semibold">{r.name}</h3>
                    <p className="text-muted-foreground text-sm">{r.description}</p>
                  </div>
                  <p className="font-heading shrink-0 text-right text-lg font-semibold">
                    {formatCurrency(r.pricePerNight)}
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
                    <span className="text-muted-foreground">Occupied tonight</span>
                    <span className="font-medium">
                      {roomBooked}/{r.units}
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-foreground h-full rounded-full"
                      style={{ width: `${(roomBooked / r.units) * 100}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {r.units - roomBooked} available now
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {r.features.map((a) => (
                    <Badge key={a} variant="secondary">
                      {a}
                    </Badge>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setEditing(r)}
                >
                  <Pencil className="size-3.5" />
                  Edit room
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {editing ? (
        <EditRoomDialog hotelId={hotel.id} room={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  )
}

function EditRoomDialog({
  hotelId,
  room,
  onClose,
}: {
  hotelId: string
  room: Room
  onClose: () => void
}) {
  const updateRoom = useStore((s) => s.updateRoom)
  const [form, setForm] = React.useState({
    name: room.name,
    description: room.description,
    pricePerNight: String(room.pricePerNight),
    units: String(room.units),
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {room.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="room-name">Name</Label>
            <Input
              id="room-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="room-description">Description</Label>
            <Textarea
              id="room-description"
              rows={2}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="room-price">Rate / night (USD)</Label>
              <Input
                id="room-price"
                type="number"
                value={form.pricePerNight}
                onChange={(e) => set({ pricePerNight: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-units">Units</Label>
              <Input
                id="room-units"
                type="number"
                value={form.units}
                onChange={(e) => set({ units: e.target.value })}
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            The lowest room rate becomes the “From” price on your public listing.
          </p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button
            onClick={() => {
              const price = Number(form.pricePerNight)
              if (!price) {
                toast.error("Enter a rate above zero.")
                return
              }
              updateRoom(hotelId, room.id, {
                name: form.name.trim(),
                description: form.description.trim(),
                pricePerNight: price,
                units: Number(form.units) || room.units,
              })
              toast.success(`${form.name} updated — live on your listing.`)
              onClose()
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
