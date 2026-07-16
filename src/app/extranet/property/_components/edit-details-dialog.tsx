"use client"

import * as React from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

import type { Hotel } from "@/types"
import { useStore } from "@/store"
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

/**
 * Edits the live property. The dialog used to carry its own hardcoded copy — a
 * second description of the same hotel that disagreed with the one on the page
 * behind it and with the one on the Descriptions screen.
 */
export function EditDetailsDialog({ hotel }: { hotel: Hotel }) {
  const [open, setOpen] = React.useState(false)
  const updateHotel = useStore((s) => s.updateHotel)
  const updatePolicies = useStore((s) => s.updatePolicies)

  const draftFrom = React.useCallback(
    () => ({
      name: hotel.name,
      description: hotel.description,
      address: hotel.address,
      checkInTime: hotel.policies.checkInTime,
      checkOutTime: hotel.policies.checkOutTime,
    }),
    [hotel]
  )

  const [form, setForm] = React.useState(draftFrom)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  /** Reloads the draft from the property each time the dialog opens, which also
   *  covers the partner switching property behind it. */
  function handleOpenChange(next: boolean) {
    if (next) setForm(draftFrom())
    setOpen(next)
  }

  function handleSave() {
    updateHotel(hotel.id, {
      name: form.name,
      description: form.description,
      address: form.address,
    })
    updatePolicies(hotel.id, {
      checkInTime: form.checkInTime,
      checkOutTime: form.checkOutTime,
    })
    toast.success("Property details updated — your listing is live with these changes.")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="shrink-0">
            <Pencil className="size-4" />
            Edit Details
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Property Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="property-name">Property Name</Label>
            <Input
              id="property-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="property-description">Description</Label>
            <Textarea
              id="property-description"
              rows={5}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
            <p className="text-muted-foreground text-xs">
              Shown under “About This Property” on your public listing.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="property-address">Address</Label>
            <Input
              id="property-address"
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="property-check-in">Check-in</Label>
              <Input
                id="property-check-in"
                type="time"
                value={form.checkInTime}
                onChange={(e) => set({ checkInTime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="property-check-out">Check-out</Label>
              <Input
                id="property-check-out"
                type="time"
                value={form.checkOutTime}
                onChange={(e) => set({ checkOutTime: e.target.value })}
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Check-in and check-out times feed your policies, the booking confirmation and
            your public house rules.
          </p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
