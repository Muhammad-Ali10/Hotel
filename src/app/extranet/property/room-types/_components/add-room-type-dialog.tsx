"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const beds = ["Queen", "King", "2 Queens", "Twin", "Sofa Bed"]

export function AddRoomTypeDialog() {
  const [open, setOpen] = React.useState(false)
  const [bed, setBed] = React.useState(beds[0])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Add Room Type
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Room Type</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="room-name">Room Name *</Label>
              <Input id="room-name" placeholder="e.g. Deluxe Suite" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-price">Base Price / Night *</Label>
              <Input id="room-price" type="number" placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="room-desc">Description</Label>
            <Textarea
              id="room-desc"
              placeholder="Describe the room…"
              className="min-h-20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Bed Type</Label>
              <Select value={bed} onValueChange={(v) => setBed(String(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {beds.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-guests">Max Guests</Label>
              <Input id="room-guests" type="number" placeholder="2" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-size">Size (m²)</Label>
              <Input id="room-size" type="number" placeholder="30" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={() => setOpen(false)}>Save Room Type</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
