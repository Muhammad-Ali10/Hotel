"use client"

import * as React from "react"
import { Info, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import { cellPad } from "@/lib/extranet/constants"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Charge = {
  id: string
  name: string
  rate: string
  appliesTo: string
  shownAs: string
  properties: string
}

const charges: Charge[] = [
  {
    id: "c1",
    name: "VAT / GST",
    rate: "10%",
    appliesTo: "Room rate + services",
    shownAs: "Displayed price",
    properties: "All properties",
  },
  {
    id: "c2",
    name: "City Tax",
    rate: "$3.50/night",
    appliesTo: "Per person, per night",
    shownAs: "Added at checkout",
    properties: "The Metropolitan, Grand Horizon",
  },
  {
    id: "c3",
    name: "Resort Fee",
    rate: "$25/night",
    appliesTo: "Per room, per night",
    shownAs: "Added at checkout",
    properties: "Casa del Mar, Sakura Ryokan",
  },
  {
    id: "c4",
    name: "Service Charge",
    rate: "5%",
    appliesTo: "Room rate only",
    shownAs: "Displayed price",
    properties: "All properties",
  },
  {
    id: "c5",
    name: "Tourism Levy",
    rate: "2%",
    appliesTo: "Total booking",
    shownAs: "Displayed price",
    properties: "Alpine Lodge Zermatt",
  },
]

function ChargeDialog({
  charge,
  trigger,
}: {
  charge?: Charge
  trigger: React.ReactElement
}) {
  const [open, setOpen] = React.useState(false)
  const editing = !!charge

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Charge" : "Add Charge"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="charge-name">Tax / Charge Name *</Label>
            <Input
              id="charge-name"
              defaultValue={charge?.name}
              placeholder="e.g. City Tax"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="charge-rate">Rate *</Label>
              <Input
                id="charge-rate"
                defaultValue={charge?.rate}
                placeholder="e.g. 10% or $3.50/night"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="charge-shown">Shown As</Label>
              <Input
                id="charge-shown"
                defaultValue={charge?.shownAs}
                placeholder="Displayed price"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="charge-applies">Applies To</Label>
            <Input
              id="charge-applies"
              defaultValue={charge?.appliesTo}
              placeholder="Room rate + services"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="charge-props">Properties</Label>
            <Input
              id="charge-props"
              defaultValue={charge?.properties}
              placeholder="All properties"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
              toast.success(editing ? "Charge updated" : "Charge added")
              setOpen(false)
            }}
          >
            {editing ? "Save Changes" : "Add Charge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function VatTaxHeaderAction() {
  return (
    <ChargeDialog
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          Add Charge
        </Button>
      }
    />
  )
}

export function VatTaxTable() {
  return (
    <div className="space-y-4">
      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Tax / Charge</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Shown As</TableHead>
              <TableHead>Properties</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {charges.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.rate}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.appliesTo}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.shownAs}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.properties}
                </TableCell>
                <TableCell className="text-right">
                  <ChargeDialog
                    charge={c}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="text-muted-foreground flex items-start gap-2 rounded-lg border bg-muted/40 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Tax laws vary by location. Ensure all rates comply with local
          regulations. Consult your accountant for verification.
        </p>
      </div>
    </div>
  )
}
