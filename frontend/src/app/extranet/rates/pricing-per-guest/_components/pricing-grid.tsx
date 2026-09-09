"use client"

import * as React from "react"
import { toast } from "sonner"

import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import {
  useOccupancyPrices,
  usePropertyRatePlans,
  useSetOccupancyPrices,
} from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NotFoundCard } from "@/components/shared/not-found-card"

/**
 * What the room costs at each occupancy (rule #101).
 *
 * The old grid was a matrix of guest counts against room-type columns from
 * another hotel, and every cell saved a toast. Two things were wrong under
 * that, not just the data:
 *
 *   - **the price belongs to a rate plan**, not a room type. One room sold on
 *     two plans has two of these grids, and a column headed "Premium King"
 *     could not say which.
 *   - **the levels are not free-form.** They run from one guest up to what the
 *     room actually sleeps; a price for six in a room for three is a number
 *     the quote engine will never reach.
 *
 * The save replaces the WHOLE grid, because these numbers only mean anything
 * beside each other: a half-applied matrix where three guests cost less than
 * two is a price nobody meant to publish.
 */
export function PricingGrid() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const plans = usePropertyRatePlans(active?.id ?? "")
  const [planId, setPlanId] = React.useState<string | null>(null)

  const live = React.useMemo(
    () => (plans.data ?? []).filter((p) => p.status === "active"),
    [plans.data]
  )
  const plan = live.find((p) => p.id === planId) ?? live[0] ?? null

  const grid = useOccupancyPrices(plan?.id ?? "")
  const save = useSetOccupancyPrices(plan?.id ?? "", active?.id ?? "")

  const [editing, setEditing] = React.useState<{ guests: number; price: number } | null>(
    null
  )

  if (loadingProperties || plans.isPending) {
    return <div className="bg-muted h-72 animate-pulse rounded-xl" aria-busy="true" />
  }

  if (!active) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to price its rooms per guest."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  if (!plan) {
    return (
      <NotFoundCard
        title="No rate plan yet"
        description="Per-guest pricing adjusts a rate plan's price. This property needs one first."
        href="/extranet/property/room-types"
        cta="Room types"
      />
    )
  }

  /**
   * Writes one level, sending the whole grid as the API requires.
   *
   * Two rules the server enforces and this has to respect:
   *
   *   - a non-empty grid MUST carry the base-occupancy row, because every
   *     other level is stored as a difference from it. Dropping it would be
   *     asking for prices relative to nothing, and is refused.
   *   - a grid that says nothing beyond the base is not a grid. Sending it
   *     empty is what actually clears one, rather than leaving a row behind
   *     that repeats the plan's own price back at it.
   */
  function commit(guests: number, price: number | null) {
    if (!grid.data) return
    const { baseOccupancy, basePrice } = grid.data

    const rows = grid.data.rows
      .filter((row) => (row.guests === guests ? price !== null : row.isSet))
      .map((row) => ({
        guests: row.guests,
        price: row.guests === guests ? price! : row.price,
      }))

    const meaningful = rows.filter(
      (row) => row.guests !== baseOccupancy || row.price !== basePrice
    )

    const next =
      meaningful.length === 0
        ? []
        : rows.some((row) => row.guests === baseOccupancy)
          ? rows
          : [...rows, { guests: baseOccupancy, price: basePrice }].sort(
              (a, b) => a.guests - b.guests
            )

    save.mutate(
      { baseOccupancy, prices: next },
      {
        onSuccess: () =>
          toast.success(
            price === null
              ? `${guests} ${guests === 1 ? "guest" : "guests"} back to the plan price`
              : `${guests} ${guests === 1 ? "guest" : "guests"} priced at ${formatCurrency(price)}`
          ),
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="occ-plan" className="text-xs">
              Rate plan
            </Label>
            <select
              id="occ-plan"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={plan.id}
              onChange={(e) => setPlanId(e.target.value)}
            >
              {live.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.roomName} · {p.name}
                </option>
              ))}
            </select>
          </div>
          {grid.data ? (
            <p className="text-muted-foreground flex-1 text-sm">
              Base occupancy is{" "}
              <strong className="text-foreground">
                {grid.data.baseOccupancy}{" "}
                {grid.data.baseOccupancy === 1 ? "guest" : "guests"}
              </strong>{" "}
              at {formatCurrency(grid.data.basePrice)}. Every other level is
              charged as the difference from that, so changing the plan&apos;s price
              moves them all.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {grid.isPending ? (
        <div className="bg-muted h-64 animate-pulse rounded-xl" aria-busy="true" />
      ) : grid.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {grid.error.message}
        </div>
      ) : (
        <Card className="py-0">
          <div className="overflow-x-auto">
            <Table className={cellPad}>
              <TableHeader>
                <TableRow>
                  <TableHead>Guests</TableHead>
                  <TableHead className="text-right">Price / night</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(grid.data?.rows ?? []).map((row) => (
                  <TableRow key={row.guests}>
                    <TableCell className="font-medium">
                      {row.guests} {row.guests === 1 ? "guest" : "guests"}
                      {row.guests === grid.data?.baseOccupancy ? (
                        <Badge variant="secondary" className="ml-2">
                          Base
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        disabled={save.isPending}
                        onClick={() => setEditing({ guests: row.guests, price: row.price })}
                        className="hover:bg-accent hover:text-accent-foreground -my-1 w-full cursor-pointer rounded-md px-2 py-1 text-right transition-colors disabled:cursor-default"
                      >
                        {formatCurrency(row.price)}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.isSet ? "Set here" : "From the plan"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.isSet ? (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={save.isPending}
                          onClick={() => commit(row.guests, null)}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
                {(grid.data?.rows.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                      This room has no occupancy to price.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          {editing ? (
            <PriceEditForm
              key={editing.guests}
              guests={editing.guests}
              price={editing.price}
              planName={`${plan.roomName} · ${plan.name}`}
              busy={save.isPending}
              onSave={(cents) => {
                commit(editing.guests, cents)
                setEditing(null)
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PriceEditForm({
  guests,
  price,
  planName,
  busy,
  onSave,
}: {
  guests: number
  price: number
  planName: string
  busy: boolean
  onSave: (cents: number) => void
}) {
  const [value, setValue] = React.useState(String(price / 100))

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit price</DialogTitle>
        <DialogDescription>
          {planName} · {guests} {guests === 1 ? "guest" : "guests"}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="price-input">Price per night (USD)</Label>
        <Input
          id="price-input"
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.00"
          autoFocus
        />
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button
          disabled={busy || value.trim() === ""}
          onClick={() => {
            const dollars = Number(value)
            if (!Number.isFinite(dollars) || dollars < 0) {
              toast.error("Enter a price of zero or more.")
              return
            }
            onSave(Math.round(dollars * 100))
          }}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
