"use client"

import * as React from "react"
import { MoreVertical, Plus } from "lucide-react"
import { toast } from "sonner"

import type { RestrictionRule } from "@/lib/extranet/types"
import { restrictionRules } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { StatusPill } from "@/components/extranet/shared"
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

const appliesToOptions = [
  "All Room Types",
  "Deluxe Ocean Suite",
  "Penthouse Suite",
  "Premium King",
  "Family Suite",
  "Standard Room",
  "Accessible Room",
]

const restrictionTypes = [
  "Min stay",
  "Max stay",
  "CTA (Closed to Arrival)",
  "CTD (Closed to Departure)",
  "Max guests",
  "Min advance booking",
]

/** Header action: opens a blank rule form. */
export function NewRuleButton() {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New Rule
      </Button>
      <RuleFormDialog
        key={open ? "open" : "closed"}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

/** Rules table with per-row Edit / Duplicate / Delete actions. */
export function RestrictionsTable() {
  const [editing, setEditing] = React.useState<RestrictionRule | null>(null)
  const [deleting, setDeleting] = React.useState<RestrictionRule | null>(null)

  return (
    <>
      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Rule Name</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {restrictionRules.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <div>{r.name}</div>
                  <div className="text-muted-foreground text-xs font-normal">
                    {r.description}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.appliesTo}
                </TableCell>
                <TableCell>{r.value}</TableCell>
                <TableCell>
                  <StatusPill status={r.status} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Rule actions"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => setEditing(r)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => toast.success("Rule duplicated")}
                      >
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleting(r)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <RuleFormDialog
        key={editing?.id ?? "none"}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        rule={editing}
      />

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent className="sm:max-w-md">
          {deleting ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete rule?</DialogTitle>
                <DialogDescription>
                  “{deleting.name}” will be permanently removed. This cannot be
                  undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={() => {
                    toast.success("Rule deleted")
                    setDeleting(null)
                  }}
                >
                  Delete
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function RuleFormDialog({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: RestrictionRule | null
}) {
  const isEdit = !!rule
  const [appliesTo, setAppliesTo] = React.useState(
    rule?.appliesTo ?? appliesToOptions[0]
  )
  const [type, setType] = React.useState(restrictionTypes[0])

  // Ensure the rule's saved "applies to" value is always a selectable option.
  const appliesToItems = appliesToOptions.includes(appliesTo)
    ? appliesToOptions
    : [appliesTo, ...appliesToOptions]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Restriction Rule" : "New Restriction Rule"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Rule Name *</Label>
            <Input
              id="rule-name"
              defaultValue={rule?.name ?? ""}
              placeholder="e.g. Minimum Stay — Weekend"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Applies To</Label>
            <Select value={appliesTo} onValueChange={(v) => setAppliesTo(String(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {appliesToItems.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Restriction Type</Label>
            <Select value={type} onValueChange={(v) => setType(String(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {restrictionTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-value">Value *</Label>
            <Input
              id="rule-value"
              defaultValue={rule?.value ?? ""}
              placeholder="e.g. 2 nights"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
              toast.success(
                isEdit ? "Rule updated" : "Restriction rule created"
              )
              onOpenChange(false)
            }}
          >
            {isEdit ? "Save Changes" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
