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

const PROMOTION_TYPES = ["Early Booker", "Last Minute", "Free Nights"]

/** "Create Promotion" button + mock form dialog. Fires a success toast on submit. */
export function CreatePromotionDialog() {
  const [open, setOpen] = React.useState(false)
  const [type, setType] = React.useState(PROMOTION_TYPES[0])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Create Promotion
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Promotion</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="promo-name">Name *</Label>
            <Input id="promo-name" placeholder="e.g. Spring Early Bird" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(String(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROMOTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-discount">Discount (%) *</Label>
              <Input
                id="promo-discount"
                type="number"
                min={0}
                max={100}
                placeholder="20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="promo-min-stay">Min stay (nights)</Label>
              <Input id="promo-min-stay" type="number" min={1} placeholder="2" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-validity">Valid through</Label>
              <Input id="promo-validity" type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Booking window</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="date"
                aria-label="Booking window start"
              />
              <Input type="date" aria-label="Booking window end" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
              toast.success("Promotion created")
              setOpen(false)
            }}
          >
            Create Promotion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
