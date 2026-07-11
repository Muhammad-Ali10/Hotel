"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PROPERTIES = [
  "Grand Horizon",
  "The Metropolitan",
  "Alpine Lodge Zermatt",
  "Casa del Mar",
  "Sakura Ryokan",
]

const ROOM_TYPES = [
  "Standard Room",
  "Premium King",
  "Deluxe Ocean Suite",
  "Family Suite",
  "Penthouse Suite",
]

export function NewReservationDialog() {
  const [open, setOpen] = React.useState(false)
  const [property, setProperty] = React.useState(PROPERTIES[0])
  const [roomType, setRoomType] = React.useState(ROOM_TYPES[0])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            New Reservation
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Reservation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="res-guest">Guest name *</Label>
            <Input id="res-guest" placeholder="Full name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Property</Label>
              <Select
                value={property}
                onValueChange={(v) => setProperty(String(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Room type</Label>
              <Select
                value={roomType}
                onValueChange={(v) => setRoomType(String(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="res-checkin">Check-in</Label>
              <Input id="res-checkin" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-checkout">Check-out</Label>
              <Input id="res-checkout" type="date" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-guests">Guests</Label>
            <Input id="res-guests" type="number" min={1} defaultValue={2} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
              toast.success("Reservation created")
              setOpen(false)
            }}
          >
            Create Reservation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
