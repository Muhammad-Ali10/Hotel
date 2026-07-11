"use client"

import * as React from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

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

const DEFAULTS = {
  name: "Grand Horizon",
  description:
    "Perched on the cliffs of Malibu, Grand Horizon is a five-star coastal retreat where floor-to-ceiling glass frames the Pacific. Guests enjoy oceanfront suites, an award-winning spa, two infinity pools and a Michelin-starred restaurant — all moments from the beach.",
  totalRooms: "142",
  floors: "8",
  yearBuilt: "2018",
  lastRenovated: "2024",
  checkIn: "15:00",
  checkOut: "12:00",
}

export function EditDetailsDialog() {
  const [open, setOpen] = React.useState(false)

  function handleSave() {
    toast.success("Property details updated")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="shrink-0">
            <Pencil className="size-4" />
            Edit Details
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Property Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="property-name">Property Name</Label>
            <Input id="property-name" defaultValue={DEFAULTS.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="property-description">Description</Label>
            <Textarea
              id="property-description"
              rows={4}
              defaultValue={DEFAULTS.description}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="property-total-rooms">Total Rooms</Label>
              <Input
                id="property-total-rooms"
                type="number"
                defaultValue={DEFAULTS.totalRooms}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="property-floors">Floors</Label>
              <Input
                id="property-floors"
                type="number"
                defaultValue={DEFAULTS.floors}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="property-year-built">Year Built</Label>
              <Input
                id="property-year-built"
                type="number"
                defaultValue={DEFAULTS.yearBuilt}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="property-last-renovated">Last Renovated</Label>
              <Input
                id="property-last-renovated"
                type="number"
                defaultValue={DEFAULTS.lastRenovated}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="property-check-in">Check-in</Label>
              <Input
                id="property-check-in"
                type="time"
                defaultValue={DEFAULTS.checkIn}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="property-check-out">Check-out</Label>
              <Input
                id="property-check-out"
                type="time"
                defaultValue={DEFAULTS.checkOut}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
