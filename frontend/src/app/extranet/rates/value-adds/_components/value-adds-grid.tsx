"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLink, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import type { ValueAddDto } from "@/lib/api/endpoints"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useValueAdds, useValueAddActions } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
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

type ValueAddUnit = ValueAddDto["unit"]

/**
 * How the charge is worded beside the price.
 *
 * Typed as a total `Record`, so a unit added to the shared list stops the build
 * rather than rendering the raw `per_person_per_night` at a partner. The
 * dropdown is built from the same map — one place decides.
 */
const unitLabel: Record<ValueAddUnit, string> = {
  per_stay: "per stay",
  per_night: "per night",
  per_person: "per person",
  per_person_per_night: "per person, per night",
}

const unitItems = (Object.keys(unitLabel) as ValueAddUnit[]).map((value) => ({
  value,
  label: unitLabel[value].charAt(0).toUpperCase() + unitLabel[value].slice(1),
}))

/**
 * The extras a guest can buy at checkout.
 *
 * The quote engine has always priced these; nothing could create one, and the
 * switches here moved a browser store rather than the row a booking reads.
 *
 * **There is no delete, on purpose.** A booking’s add-ons point at these rows,
 * and "what was this $65 line" has to stay answerable long after a property
 * stops selling it. Switching one off retires it: no new booking can buy it,
 * and last year’s stay still explains itself.
 */
export function ValueAddsGrid() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const valueAdds = useValueAdds(active?.id ?? "")
  const { update } = useValueAddActions(active?.id ?? "")
  const [filter, setFilter] = React.useState("All")
  const [editing, setEditing] = React.useState<ValueAddDto | null>(null)
  const [adding, setAdding] = React.useState(false)

  if (loadingProperties || valueAdds.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-44 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (!active) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to manage its value-adds."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  if (valueAdds.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {valueAdds.error.message}
      </div>
    )
  }

  const all = valueAdds.data ?? []
  const categories = ["All", ...new Set(all.map((v) => v.category))]
  const list = filter === "All" ? all : all.filter((v) => v.category === filter)
  const hotel = active

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Active add-ons appear in the Extras step of checkout for {hotel.name}.{" "}
          <Link
            href={`/hotels/${hotel.slug}#reserve`}
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
                  disabled={update.isPending}
                  onCheckedChange={(checked) =>
                    update.mutate(
                      { valueAddId: v.id, patch: { active: checked === true } },
                      {
                        onSuccess: () =>
                          toast.success(
                            checked
                              ? `${v.name} is now offered at checkout.`
                              : `${v.name} retired.`,
                            {
                              description: checked
                                ? undefined
                                : "Bookings that already bought it are unchanged.",
                            }
                          ),
                        onError: (e) => toast.error(e.message),
                      }
                    )
                  }
                  aria-label={`${v.name} active`}
                />
              </div>
              <p className="text-muted-foreground text-sm">{v.description}</p>
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  <span className="font-heading text-base font-semibold">
                    {formatCurrency(v.price)}
                  </span>
                  <span className="text-muted-foreground"> {unitLabel[v.unit]}</span>
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

      {list.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {all.length === 0
            ? "No extras yet. Anything you add here is offered at checkout."
            : `Nothing in ${filter}.`}
        </p>
      ) : null}

      {editing ? (
        <ValueAddDialog
          propertyId={active.id}
          valueAdd={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {adding ? (
        <ValueAddDialog propertyId={active.id} onClose={() => setAdding(false)} />
      ) : null}
    </div>
  )
}

function ValueAddDialog({
  propertyId,
  valueAdd,
  onClose,
}: {
  propertyId: string
  valueAdd?: ValueAddDto
  onClose: () => void
}) {
  const { create, update } = useValueAddActions(propertyId)
  const busy = create.isPending || update.isPending

  const [form, setForm] = React.useState({
    name: valueAdd?.name ?? "",
    category: valueAdd?.category ?? "general",
    description: valueAdd?.description ?? "",
    // Cents on the wire, dollars in the field.
    price: String((valueAdd?.price ?? 2500) / 100),
    unit: valueAdd?.unit ?? ("per_stay" as ValueAddUnit),
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function save() {
    const dollars = Number(form.price)
    if (!form.name.trim()) {
      toast.error("Give the add-on a name.")
      return
    }
    // Zero IS legal: a free extra is still an extra worth listing.
    if (!Number.isFinite(dollars) || dollars < 0) {
      toast.error("Enter a price of zero or more.")
      return
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || "general",
      description: form.description.trim(),
      price: Math.round(dollars * 100),
      unit: form.unit,
    }

    const done = (verb: string) => () => {
      toast.success(`${payload.name} ${verb}.`)
      onClose()
    }
    const failed = (e: Error) => toast.error(e.message)

    if (valueAdd) {
      update.mutate(
        { valueAddId: valueAdd.id, patch: payload },
        { onSuccess: done("updated"), onError: failed }
      )
    } else {
      create.mutate(
        { ...payload, active: true },
        { onSuccess: done("is now offered at checkout"), onError: failed }
      )
    }
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
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
