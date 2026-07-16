"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLink, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import type { ValueAdd, ValueAddUnit } from "@/types"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useStore } from "@/store"
import { useActiveHotel } from "@/store/selectors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NotFoundCard } from "@/components/shared/not-found-card"

const unitItems: { value: ValueAddUnit; label: string }[] = [
  { value: "per stay", label: "Per stay" },
  { value: "per night", label: "Per night" },
  { value: "per person", label: "Per person" },
]

/**
 * Value-adds are the add-ons a guest can buy at checkout. The partner has been
 * able to define them all along, but the public flow had no step to sell them —
 * switching one on here now puts it in front of guests.
 */
export function ValueAddsGrid() {
  const hotel = useActiveHotel()
  const updateValueAdd = useStore((s) => s.updateValueAdd)
  const [filter, setFilter] = React.useState("All")
  const [editing, setEditing] = React.useState<ValueAdd | null>(null)
  const [adding, setAdding] = React.useState(false)

  if (!hotel) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to manage its value-adds."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const categories = ["All", ...new Set(hotel.valueAdds.map((v) => v.category))]
  const list =
    filter === "All" ? hotel.valueAdds : hotel.valueAdds.filter((v) => v.category === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Active add-ons appear in the Extras step of checkout for {hotel.name}.{" "}
          <Link
            href={`/hotels/${hotel.id}#reserve`}
            target="_blank"
            className="text-foreground inline-flex items-center gap-1 hover:underline"
          >
            Preview <ExternalLink className="size-3" />
          </Link>
        </p>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Add value-add
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === c
                ? "bg-primary text-primary-foreground border-transparent"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((v) => (
          <Card key={v.id} className={v.active ? undefined : "opacity-60"}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="font-heading text-sm font-semibold">{v.name}</p>
                  <Badge variant="outline">{v.category}</Badge>
                </div>
                <Switch
                  checked={v.active}
                  onCheckedChange={(checked) => {
                    updateValueAdd(hotel.id, v.id, { active: checked === true })
                    toast.success(
                      checked
                        ? `${v.name} is now offered at checkout.`
                        : `${v.name} removed from checkout.`
                    )
                  }}
                  aria-label={`${v.name} active`}
                />
              </div>
              <p className="text-muted-foreground text-sm">{v.description}</p>
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  <span className="font-heading text-base font-semibold">
                    {formatCurrency(v.price)}
                  </span>
                  <span className="text-muted-foreground"> {v.unit}</span>
                </p>
                <Button variant="ghost" size="sm" onClick={() => setEditing(v)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing ? (
        <ValueAddDialog hotelId={hotel.id} valueAdd={editing} onClose={() => setEditing(null)} />
      ) : null}
      {adding ? <ValueAddDialog hotelId={hotel.id} onClose={() => setAdding(false)} /> : null}
    </div>
  )
}

function ValueAddDialog({
  hotelId,
  valueAdd,
  onClose,
}: {
  hotelId: string
  valueAdd?: ValueAdd
  onClose: () => void
}) {
  const updateValueAdd = useStore((s) => s.updateValueAdd)
  const addValueAdd = useStore((s) => s.addValueAdd)

  const [form, setForm] = React.useState({
    name: valueAdd?.name ?? "",
    category: valueAdd?.category ?? "Convenience",
    description: valueAdd?.description ?? "",
    price: String(valueAdd?.price ?? 25),
    unit: valueAdd?.unit ?? ("per stay" as ValueAddUnit),
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function save() {
    if (!form.name.trim() || !Number(form.price)) {
      toast.error("Give the add-on a name and a price above zero.")
      return
    }
    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      price: Number(form.price),
      unit: form.unit,
    }
    if (valueAdd) {
      updateValueAdd(hotelId, valueAdd.id, payload)
      toast.success(`${payload.name} updated.`)
    } else {
      addValueAdd(hotelId, {
        id: payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        active: true,
        ...payload,
      })
      toast.success(`${payload.name} is now offered at checkout.`)
    }
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{valueAdd ? `Edit ${valueAdd.name}` : "Add a value-add"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="va-name">Name</Label>
            <Input
              id="va-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Airport transfer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="va-category">Category</Label>
            <Input
              id="va-category"
              value={form.category}
              onChange={(e) => set({ category: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="va-description">Description</Label>
            <Textarea
              id="va-description"
              rows={2}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="What the guest gets."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="va-price">Price (USD)</Label>
              <Input
                id="va-price"
                type="number"
                value={form.price}
                onChange={(e) => set({ price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Charged</Label>
              <Select
                items={unitItems}
                value={form.unit}
                onValueChange={(v) => set({ unit: v as ValueAddUnit })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitItems.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
