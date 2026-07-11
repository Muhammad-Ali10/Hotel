"use client"

import * as React from "react"
import { MoreVertical, Plus } from "lucide-react"
import { toast } from "sonner"

import type { CountryRate } from "@/lib/extranet/types"
import { countryRates } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { StatusPill } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** Header action: opens a blank country-rate form. */
export function AddCountryButton() {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add Country
      </Button>
      <CountryFormDialog
        key={open ? "open" : "closed"}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

/** Country rates table with per-row Edit / Remove actions. */
export function CountryRatesTable() {
  const [editing, setEditing] = React.useState<CountryRate | null>(null)
  const [removing, setRemoving] = React.useState<CountryRate | null>(null)

  return (
    <>
      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Country</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Markup</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {countryRates.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">
                      {c.code}
                    </Badge>
                    <span className="font-medium">{c.country}</span>
                  </div>
                </TableCell>
                <TableCell>{c.rate}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.markup}
                </TableCell>
                <TableCell>
                  <StatusPill status={c.status} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Country actions"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => setEditing(c)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setRemoving(c)}
                      >
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CountryFormDialog
        key={editing?.id ?? "none"}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        country={editing}
      />

      <Dialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <DialogContent className="sm:max-w-md">
          {removing ? (
            <>
              <DialogHeader>
                <DialogTitle>Remove country rate?</DialogTitle>
                <DialogDescription>
                  The geo-targeted rate for {removing.country} will be removed.
                  This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={() => {
                    toast.success("Country rate removed")
                    setRemoving(null)
                  }}
                >
                  Remove
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function CountryFormDialog({
  open,
  onOpenChange,
  country,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  country?: CountryRate | null
}) {
  const isEdit = !!country

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Country Rate" : "Add Country Rate"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="country-name">Country *</Label>
              <Input
                id="country-name"
                defaultValue={country?.country ?? ""}
                placeholder="e.g. Spain"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country-code">Code</Label>
              <Input
                id="country-code"
                defaultValue={country?.code ?? ""}
                placeholder="ES"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country-rate">Rate adjustment *</Label>
            <Input
              id="country-rate"
              defaultValue={country?.rate ?? ""}
              placeholder="e.g. 189 USD"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country-markup">Markup</Label>
            <Input
              id="country-markup"
              defaultValue={country?.markup ?? ""}
              placeholder="e.g. +5% or Base"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
              toast.success(
                isEdit ? "Country rate updated" : "Country rate added"
              )
              onOpenChange(false)
            }}
          >
            {isEdit ? "Save Changes" : "Add Country"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
