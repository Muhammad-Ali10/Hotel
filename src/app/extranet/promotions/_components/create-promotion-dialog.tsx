"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import type { DiscountType } from "@/types"
import { addDays, formatDiscount, toISODate } from "@/lib/domain"
import { useStore } from "@/store"
import { usePartnerHotels } from "@/store/selectors"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

const typeItems: { value: DiscountType; label: string }[] = [
  { value: "percent", label: "Percentage off" },
  { value: "amount", label: "Amount off" },
  { value: "freeNight", label: "Free night" },
]

/** Creates a real promotion. Activating it puts the badge on the listing and
 *  applies the discount to the price at checkout. */
export function CreatePromotionDialog() {
  const hotels = usePartnerHotels()
  const createPromotion = useStore((s) => s.createPromotion)
  const [open, setOpen] = React.useState(false)

  const today = toISODate(new Date())
  const [form, setForm] = React.useState({
    name: "",
    type: "percent" as DiscountType,
    value: "20",
    minStay: "",
    startDate: today,
    endDate: addDays(today, 60),
    hotelIds: [] as string[],
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function create() {
    if (!form.name.trim()) {
      toast.error("Give the promotion a name.")
      return
    }
    if (form.hotelIds.length === 0) {
      toast.error("Choose at least one property.")
      return
    }
    const value = Number(form.value)
    if (!value) {
      toast.error("Set a discount above zero.")
      return
    }

    const discount = { type: form.type, value }
    createPromotion({
      id: `promo-${form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: form.name.trim(),
      hotelIds: form.hotelIds,
      discount,
      startDate: form.startDate,
      endDate: form.endDate,
      roomTypes: "All room types",
      minStay: Number(form.minStay) || undefined,
      bookings: 0,
      revenue: 0,
      status: "active",
      channel: "all",
    })

    toast.success(
      `${form.name} is live — ${formatDiscount(discount)} now shows on ${form.hotelIds.length} listing${form.hotelIds.length === 1 ? "" : "s"}.`
    )
    setOpen(false)
    set({ name: "", hotelIds: [] })
  }

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Promotion</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="promo-name">Name *</Label>
            <Input
              id="promo-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Spring Early Bird"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                items={typeItems}
                value={form.type}
                onValueChange={(v) => set({ type: v as DiscountType })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeItems.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-discount">
                {form.type === "percent"
                  ? "Discount (%) *"
                  : form.type === "amount"
                    ? "Amount off (USD) *"
                    : "Every Nth night free *"}
              </Label>
              <Input
                id="promo-discount"
                type="number"
                min={1}
                value={form.value}
                onChange={(e) => set({ value: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Properties *</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {hotels.map((h) => (
                <Label key={h.id} className="gap-2.5 font-normal">
                  <Checkbox
                    checked={form.hotelIds.includes(h.id)}
                    onCheckedChange={() =>
                      set({
                        hotelIds: form.hotelIds.includes(h.id)
                          ? form.hotelIds.filter((id) => id !== h.id)
                          : [...form.hotelIds, h.id],
                      })
                    }
                  />
                  {h.name}
                  <span className="text-muted-foreground">— {h.city}</span>
                </Label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="promo-min-stay">Min stay</Label>
              <Input
                id="promo-min-stay"
                type="number"
                min={1}
                value={form.minStay}
                onChange={(e) => set({ minStay: e.target.value })}
                placeholder="Any"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-start">Starts</Label>
              <Input
                id="promo-start"
                type="date"
                value={form.startDate}
                onChange={(e) => set({ startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-end">Ends</Label>
              <Input
                id="promo-end"
                type="date"
                value={form.endDate}
                onChange={(e) => set({ endDate: e.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={create}>Create Promotion</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
