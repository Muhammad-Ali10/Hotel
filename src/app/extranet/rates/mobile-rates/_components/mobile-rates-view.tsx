"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import type { MobileRate } from "@/lib/extranet/types"
import { mobileRates } from "@/data/extranet"
import { StatusPill } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const roomTypeOptions = [
  "All room types",
  "Deluxe Ocean Suite, Premium King",
  "Standard Room, Accessible Room",
  "Penthouse Suite",
]
const platformOptions = ["iOS + Android", "iOS only", "Android only"]

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

/** Header action: opens a blank mobile-rate form. */
export function CreateMobileRateButton() {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Create Mobile Rate
      </Button>
      <MobileRateFormDialog
        key={open ? "open" : "closed"}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

/** Card list of mobile rates, each with an Edit action. */
export function MobileRatesList() {
  const [editing, setEditing] = React.useState<MobileRate | null>(null)

  return (
    <>
      <div className="space-y-4">
        {mobileRates.map((m) => (
          <Card key={m.id}>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-base font-semibold">
                      {m.name}
                    </h3>
                    <StatusPill status={m.status} />
                  </div>
                  <p className="font-heading text-2xl font-semibold">
                    {m.discount}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(m)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toast.success(
                        m.status === "Active"
                          ? "Mobile rate paused"
                          : "Mobile rate activated"
                      )
                    }
                  >
                    Toggle
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
                <Field label="Bookings" value={m.bookings} />
                <Field label="Room Types" value={m.roomTypes} />
                <Field label="Platform" value={m.platform} />
                <Field label="Min Stay" value={m.minStay} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <MobileRateFormDialog
        key={editing?.id ?? "none"}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        rate={editing}
      />
    </>
  )
}

function MobileRateFormDialog({
  open,
  onOpenChange,
  rate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rate?: MobileRate | null
}) {
  const isEdit = !!rate
  const [roomTypes, setRoomTypes] = React.useState(
    rate?.roomTypes ?? roomTypeOptions[0]
  )
  const [platform, setPlatform] = React.useState(
    rate?.platform ?? platformOptions[0]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Mobile Rate" : "Create Mobile Rate"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mobile-name">Name *</Label>
            <Input
              id="mobile-name"
              defaultValue={rate?.name ?? ""}
              placeholder="e.g. App Exclusive Rate"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="mobile-discount">Discount % *</Label>
              <Input
                id="mobile-discount"
                type="number"
                min="0"
                max="100"
                defaultValue={
                  rate ? rate.discount.replace(/[^0-9]/g, "") : ""
                }
                placeholder="25"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mobile-min-stay">Min Stay</Label>
              <Input
                id="mobile-min-stay"
                defaultValue={rate?.minStay ?? ""}
                placeholder="e.g. Min 1 night"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Room Types</Label>
            <Select value={roomTypes} onValueChange={(v) => setRoomTypes(String(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roomTypeOptions.map((rt) => (
                  <SelectItem key={rt} value={rt}>
                    {rt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(String(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {platformOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
              toast.success(
                isEdit ? "Mobile rate updated" : "Mobile rate created"
              )
              onOpenChange(false)
            }}
          >
            {isEdit ? "Save Changes" : "Create Rate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
