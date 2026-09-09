"use client"

import * as React from "react"
import Link from "next/link"
import { BedDouble, ExternalLink, Pencil, Ruler, Users } from "lucide-react"
import { toast } from "sonner"

import type { Stat as ExtranetStat } from "@/lib/extranet/types"
import type { RoomDto } from "@/lib/api/endpoints"
import { roomsApi } from "@/lib/api/endpoints"
import { formatCurrency } from "@/lib/format"
import { toISODate } from "@/lib/domain"
import { keys, useCalendar, useRooms, useUpdateRoom } from "@/lib/api/hooks"
import { useQueryClient } from "@tanstack/react-query"
import { useActiveProperty } from "@/components/extranet/active-property"
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
 * The property's rooms — the same rooms a guest picks on the listing.
 *
 * Two things on this screen used to be invented in the browser:
 *
 *   - **the rate.** A room has no price (rule #27); a RATE PLAN does, and one
 *     room can be sold on several at different prices. The number shown is the
 *     default plan's, and editing it writes there.
 *   - **"occupied tonight".** It was counted by walking the partner's
 *     reservations client-side, which quietly disagreed with the inventory
 *     ledger — the row the booking transaction actually locks — the moment a
 *     booking was held, cancelled or moved. It now reads that ledger.
 */
export function RoomTypesGrid() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const rooms = useRooms(active?.id ?? "")
  const [editing, setEditing] = React.useState<RoomDto | null>(null)

  // One night: tonight. `to` is inclusive, so from === to is a single date.
  const today = React.useMemo(() => toISODate(new Date()), [])
  const calendar = useCalendar(active?.id ?? "", { from: today, to: today })

  /** Units sold for tonight, straight off the inventory row. */
  const bookedByRoom = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const room of calendar.data?.rooms ?? []) {
      map.set(room.id, room.stock[0]?.bookedUnits ?? 0)
    }
    return map
  }, [calendar.data])

  if (loadingProperties || rooms.isPending) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-72 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (!active) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to manage its rooms."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  if (rooms.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {rooms.error.message}
      </div>
    )
  }

  const list = rooms.data ?? []
  const totalRooms = list.reduce((sum, r) => sum + r.units, 0)
  const booked = [...bookedByRoom.values()].reduce((a, b) => a + b, 0)

  const stats: ExtranetStat[] = [
    { label: "Total Rooms", value: String(totalRooms) },
    {
      label: "Occupied Tonight",
      // Never guess: an unloaded calendar says so rather than showing a zero.
      value: calendar.isPending ? "—" : String(booked),
    },
    {
      label: "Available",
      value: calendar.isPending ? "—" : String(totalRooms - booked),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Room Types" subtitle={`Rooms, pricing and inventory for ${active.name}`}>
        <Button
          variant="outline"
          size="sm"
          render={
            <Link href={`/hotels/${active.slug}#rooms`} target="_blank">
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

      {list.length === 0 ? (
        <NotFoundCard
          title="No rooms yet"
          description="A property needs at least one room before it can be sold."
          href="/extranet/property"
          cta="Property setup"
        />
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => {
          const roomBooked = bookedByRoom.get(r.id) ?? 0
          const pct = r.units > 0 ? (roomBooked / r.units) * 100 : 0
          return (
            <Card key={r.id}>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-heading text-base font-semibold">{r.name}</h3>
                    <p className="text-muted-foreground text-sm">{r.description}</p>
                  </div>
                  <p className="font-heading shrink-0 text-right text-lg font-semibold">
                    {r.basePrice === null ? "—" : formatCurrency(r.basePrice)}
                    <span className="text-muted-foreground block text-xs font-normal">
                      {r.basePrice === null
                        ? "no rate plan"
                        : r.ratePlans > 1
                          ? `from ${r.ratePlans} plans`
                          : "per night"}
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
                    {r.maxOccupancy} guests
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
                      {calendar.isPending ? "—" : `${roomBooked}/${r.units}`}
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-foreground h-full rounded-full"
                      style={{ width: `${calendar.isPending ? 0 : pct}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {calendar.isPending
                      ? "Loading tonight’s inventory…"
                      : `${r.units - roomBooked} available now`}
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
        <EditRoomDialog
          propertyId={active.id}
          room={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

function EditRoomDialog({
  propertyId,
  room,
  onClose,
}: {
  propertyId: string
  room: RoomDto
  onClose: () => void
}) {
  const update = useUpdateRoom(propertyId)
  const client = useQueryClient()
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({
    name: room.name,
    description: room.description,
    // Cents on the wire, dollars in the field.
    basePrice: room.basePrice === null ? "" : String(room.basePrice / 100),
    units: String(room.units),
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  /**
   * Two writes, because they land in two places.
   *
   * The name, the description and the unit count belong to the room; the rate
   * belongs to its default plan. The rate goes second: if it is refused —
   * a manager may reprice, but the plan may be another org's — the room edit
   * has already been saved rather than lost with it.
   */
  async function save() {
    const units = Number(form.units)
    if (!Number.isInteger(units) || units < 1) {
      toast.error("A room needs at least one unit.")
      return
    }

    const priceChanged = form.basePrice !== (room.basePrice === null ? "" : String(room.basePrice / 100))
    const dollars = Number(form.basePrice)
    if (priceChanged && (!Number.isFinite(dollars) || dollars <= 0)) {
      toast.error("Enter a rate above zero.")
      return
    }
    if (priceChanged && room.defaultRatePlanId === null) {
      toast.error("This room has no rate plan yet.", {
        description: "Create one under Rates before setting a price.",
      })
      return
    }

    setSaving(true)
    try {
      const result = await update.mutateAsync({
        roomId: room.id,
        patch: {
          name: form.name.trim(),
          description: form.description.trim(),
          units,
        },
      })

      if (priceChanged && room.defaultRatePlanId) {
        await roomsApi.updateRatePlan(room.defaultRatePlanId, {
          basePrice: Math.round(dollars * 100),
        })
        void client.invalidateQueries({ queryKey: keys.rooms(propertyId) })
      }

      /*
       * Say so when the calendar could not follow.
       *
       * Lowering the unit count leaves any date that already holds more
       * bookings on the old number — that is the overbooking guard doing its
       * job, and a partner needs to know which weeks are still selling six.
       */
      const blocked = result.units?.blocked ?? []
      if (blocked.length > 0) {
        toast.warning(
          `${blocked.length} ${blocked.length === 1 ? "date" : "dates"} kept the old unit count`,
          {
            description: `Already booked beyond ${units}: ${blocked.slice(0, 3).join(", ")}${
              blocked.length > 3 ? `, +${blocked.length - 3} more` : ""
            }`,
          }
        )
      } else {
        toast.success(`${form.name.trim() || room.name} updated`, {
          description: "A material change goes to the platform before it is live.",
        })
      }
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the room.")
    } finally {
      setSaving(false)
    }
  }

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
                min={1}
                step="0.01"
                value={form.basePrice}
                disabled={room.defaultRatePlanId === null}
                placeholder={room.defaultRatePlanId === null ? "No rate plan" : undefined}
                onChange={(e) => set({ basePrice: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-units">Units</Label>
              <Input
                id="room-units"
                type="number"
                min={1}
                value={form.units}
                onChange={(e) => set({ units: e.target.value })}
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            The rate belongs to this room’s default plan
            {room.ratePlans > 1
              ? ` — ${room.ratePlans - 1} other ${room.ratePlans === 2 ? "plan" : "plans"} on this room keep their own price.`
              : "."}{" "}
            Lowering the unit count below what is already sold is refused.
          </p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
