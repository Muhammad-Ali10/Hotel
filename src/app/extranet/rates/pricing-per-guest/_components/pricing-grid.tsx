"use client"

import * as React from "react"
import { toast } from "sonner"

import { pricingColumns, pricingPerGuest } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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

type EditingCell = {
  guests: number
  column: string
  price: number | null
}

/** Pricing matrix where every cell is clickable to edit its per-night price. */
export function PricingGrid() {
  const [editing, setEditing] = React.useState<EditingCell | null>(null)

  return (
    <>
      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Guests</TableHead>
              {pricingColumns.map((c) => (
                <TableHead key={c} className="text-right">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pricingPerGuest.map((row) => (
              <TableRow key={row.guests}>
                <TableCell className="font-medium">
                  {row.guests} {row.guests === 1 ? "guest" : "guests"}
                </TableCell>
                {row.prices.map((p, i) => (
                  <TableCell key={i} className="text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          guests: row.guests,
                          column: pricingColumns[i],
                          price: p,
                        })
                      }
                      className="hover:bg-accent hover:text-accent-foreground -my-1 w-full cursor-pointer rounded-md px-2 py-1 text-right transition-colors"
                    >
                      {p === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatCurrency(p)
                      )}
                    </button>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <PriceEditDialog
        key={editing ? `${editing.guests}-${editing.column}` : "none"}
        editing={editing}
        onClose={() => setEditing(null)}
      />
    </>
  )
}

function PriceEditDialog({
  editing,
  onClose,
}: {
  editing: EditingCell | null
  onClose: () => void
}) {
  const [value, setValue] = React.useState(
    editing?.price != null ? String(editing.price) : ""
  )

  return (
    <Dialog open={!!editing} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {editing ? (
          <>
            <DialogHeader>
              <DialogTitle>Edit Price</DialogTitle>
              <DialogDescription>
                {editing.column} · {editing.guests}{" "}
                {editing.guests === 1 ? "guest" : "guests"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="price-input">Price per night (USD)</Label>
              <Input
                id="price-input"
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                disabled={value.trim() === ""}
                onClick={() => {
                  toast.success("Price updated")
                  onClose()
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
