"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLink, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import type { TaxKind, TaxLine } from "@/types"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import { useStore } from "@/store"
import { useActiveHotel } from "@/store/selectors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NotFoundCard } from "@/components/shared/not-found-card"

const kindItems: { value: TaxKind; label: string }[] = [
  { value: "percent", label: "Percentage of the booking" },
  { value: "perNight", label: "Fixed amount per night" },
  { value: "perPersonPerNight", label: "Fixed amount per guest, per night" },
]

function describeKind(line: TaxLine) {
  switch (line.kind) {
    case "percent":
      return `${line.value}% of the booking`
    case "perNight":
      return `${formatCurrency(line.value)} per night`
    case "perPersonPerNight":
      return `${formatCurrency(line.value)} per guest, per night`
  }
}

/**
 * The property's charge configuration — and the only tax model in the product.
 * The public reserve card, checkout, confirmation and the invoices all price
 * from these lines; they used to hardcode a flat 12% that matched nothing here.
 */
export function VatTaxView() {
  const hotel = useActiveHotel()
  const updateTaxLine = useStore((s) => s.updateTaxLine)
  const [editing, setEditing] = React.useState<TaxLine | null>(null)
  const [adding, setAdding] = React.useState(false)

  if (!hotel) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to manage its charges."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Charges for {hotel.name}. Guests see these itemised at checkout.{" "}
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
          Add charge
        </Button>
      </div>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table className={cellPad}>
            <TableHeader>
              <TableRow>
                <TableHead>Charge</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Shown as</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {hotel.taxLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">{line.label}</TableCell>
                  <TableCell className="text-muted-foreground">{describeKind(line)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {line.includedInDisplayPrice ? "Displayed price" : "Added at checkout"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={line.active}
                      onCheckedChange={(checked) => {
                        updateTaxLine(hotel.id, line.id, { active: checked === true })
                        toast.success(
                          `${line.label} ${checked ? "applied to" : "removed from"} new bookings.`
                        )
                      }}
                      aria-label={`${line.label} active`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${line.label}`}
                      onClick={() => setEditing(line)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {editing ? (
        <ChargeDialog
          hotelId={hotel.id}
          line={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {adding ? <ChargeDialog hotelId={hotel.id} onClose={() => setAdding(false)} /> : null}
    </div>
  )
}

function ChargeDialog({
  hotelId,
  line,
  onClose,
}: {
  hotelId: string
  line?: TaxLine
  onClose: () => void
}) {
  const updateTaxLine = useStore((s) => s.updateTaxLine)
  const addTaxLine = useStore((s) => s.addTaxLine)

  const [form, setForm] = React.useState({
    label: line?.label ?? "",
    kind: line?.kind ?? ("percent" as TaxKind),
    value: String(line?.value ?? 10),
    includedInDisplayPrice: line?.includedInDisplayPrice ?? false,
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function save() {
    if (!form.label.trim() || !Number(form.value)) {
      toast.error("Give the charge a name and a rate above zero.")
      return
    }
    const payload = {
      label: form.label.trim(),
      kind: form.kind,
      value: Number(form.value),
      includedInDisplayPrice: form.includedInDisplayPrice,
    }
    if (line) {
      updateTaxLine(hotelId, line.id, payload)
      toast.success(`${payload.label} updated — new bookings price with it.`)
    } else {
      addTaxLine(hotelId, {
        id: payload.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        active: true,
        ...payload,
      })
      toast.success(`${payload.label} added to ${hotelId}.`)
    }
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{line ? `Edit ${line.label}` : "Add a charge"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="charge-label">Name</Label>
            <Input
              id="charge-label"
              value={form.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="e.g. City tax"
            />
          </div>
          <div className="space-y-1.5">
            <Label>How it&apos;s calculated</Label>
            <Select
              items={kindItems}
              value={form.kind}
              onValueChange={(v) => set({ kind: v as TaxKind })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kindItems.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="charge-value">
              {form.kind === "percent" ? "Percentage" : "Amount (USD)"}
            </Label>
            <Input
              id="charge-value"
              type="number"
              step="0.5"
              value={form.value}
              onChange={(e) => set({ value: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Include in the displayed price</p>
              <p className="text-muted-foreground text-xs">
                Off means it shows as a separate line at checkout.
              </p>
            </div>
            <Switch
              checked={form.includedInDisplayPrice}
              onCheckedChange={(v) => set({ includedInDisplayPrice: v === true })}
              aria-label="Include in displayed price"
            />
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
