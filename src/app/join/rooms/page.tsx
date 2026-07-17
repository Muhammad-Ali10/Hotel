"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { Counter } from "../_components/counter"
import { useWizard } from "../_components/wizard-provider"
import type { RoomTypeDraft } from "../_lib/types"

const bedTypes = ["Single", "Twin", "Double", "Queen", "King"].map((v) => ({
  value: v,
  label: v,
}))
const guestOptions = [1, 2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: `${n} guest${n > 1 ? "s" : ""}`,
}))

export default function RoomTypesPage() {
  const { data, update } = useWizard()
  const [rooms, setRooms] = React.useState<RoomTypeDraft[]>(data.roomTypes)

  const edit = (id: string, patch: Partial<RoomTypeDraft>) =>
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const add = () =>
    setRooms((rs) => [
      ...rs,
      { id: `rt-${rs.length + 1}-${rs.length}`, name: "", bedType: "Double", maxGuests: 2, count: 1 },
    ])

  const remove = (id: string) => setRooms((rs) => rs.filter((r) => r.id !== id))

  function validate() {
    if (rooms.some((r) => !r.name.trim())) {
      toast.error("Give every room type a name")
      return false
    }
    update({ roomTypes: rooms })
    return true
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Room types matter">
          Defining clear room types helps guests choose the right option. Include
          distinguishing features in the name — like view, size, or amenities.
          You can add detailed descriptions and photos for each room type later
          in the Extranet.
        </TipPanel>
      }
    >
      <StepHeading
        title="What rooms do you offer?"
        description="Define your room types — name, bed configuration, guest capacity, and how many of each you have."
      />
      <div className="space-y-4">
        {rooms.map((room, i) => (
          <Card key={room.id}>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">Room type {i + 1}</span>
                </div>
                {rooms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(room.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove room type"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`name-${room.id}`}>
                  Room name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`name-${room.id}`}
                  placeholder="e.g. Deluxe Ocean Suite"
                  value={room.name}
                  onChange={(e) => edit(room.id, { name: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Bed type</Label>
                  <Select
                    items={bedTypes}
                    value={room.bedType}
                    onValueChange={(v) => edit(room.id, { bedType: v as string })}
                  >
                    <SelectTrigger className="w-full" size="default">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bedTypes.map((b) => (
                        <SelectItem key={b.value} value={b.value}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Max guests</Label>
                  <Select
                    items={guestOptions}
                    value={String(room.maxGuests)}
                    onValueChange={(v) => edit(room.id, { maxGuests: Number(v) })}
                  >
                    <SelectTrigger className="w-full" size="default">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {guestOptions.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>How many of this room type?</Label>
                <Counter
                  value={room.count}
                  onChange={(v) => edit(room.id, { count: v })}
                  min={1}
                  suffix="rooms"
                />
              </div>
            </CardContent>
          </Card>
        ))}

        <button
          type="button"
          onClick={add}
          className="hover:bg-muted/40 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-medium transition-colors"
        >
          <Plus className="size-4" />
          Add another room type
        </button>
      </div>

      <StepNav slug="rooms" onContinue={validate} />
    </WizardShell>
  )
}
