"use client"

import * as React from "react"
import { MoreVertical } from "lucide-react"
import { toast } from "sonner"

import type { RatePlan } from "@/lib/extranet/types"
import { ActionButton } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const CANCELLATIONS = [
  "Free cancellation up to 24h before",
  "Free cancellation up to 48h before",
  "Non-refundable",
]
const MEAL_PLANS = ["Room only", "Breakfast included", "Half board", "Full board"]

/** Ensure the plan's own saved value is always a selectable option. */
function withValue(list: string[], value: string) {
  return list.includes(value) ? list : [value, ...list]
}

/** Controlled, prefilled edit dialog — mirrors create-plan-dialog. */
function EditPlanDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan: RatePlan
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = React.useState(plan.name)
  const [price, setPrice] = React.useState(String(plan.price))
  const [cancellation, setCancellation] = React.useState(plan.cancellation)
  const [meal, setMeal] = React.useState(plan.inclusion)

  const cancellationOptions = withValue(CANCELLATIONS, plan.cancellation)
  const mealOptions = withValue(MEAL_PLANS, plan.inclusion)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Rate Plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`edit-name-${plan.id}`}>Plan Name *</Label>
            <Input
              id={`edit-name-${plan.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-price-${plan.id}`}>
              Base Price / Night (USD) *
            </Label>
            <Input
              id={`edit-price-${plan.id}`}
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cancellation Policy</Label>
            <Select
              value={cancellation}
              onValueChange={(v) => setCancellation(String(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cancellationOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Meal Plan</Label>
            <Select value={meal} onValueChange={(v) => setMeal(String(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mealOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
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
              onOpenChange(false)
              toast.success("Rate plan updated")
            }}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Per-plan action menu (top-right of each rate-plan card): Edit / Duplicate /
 * Deactivate. Dialogs are rendered as siblings of the menu and driven by state
 * so they survive the menu closing (the same idiom as the reservations table).
 */
export function RatePlanActions({ plan }: { plan: RatePlan }) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [editNonce, setEditNonce] = React.useState(0)
  const [deactivateOpen, setDeactivateOpen] = React.useState(false)

  // Bump the key on each open so fields reset to the plan's values without a
  // synchronous setState effect.
  const openEdit = () => {
    setEditNonce((n) => n + 1)
    setEditOpen(true)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Plan actions">
              <MoreVertical className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={openEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => toast.success("Rate plan duplicated")}
          >
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeactivateOpen(true)}
          >
            Deactivate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPlanDialog
        key={editNonce}
        plan={plan}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate rate plan?</DialogTitle>
            <DialogDescription>
              &ldquo;{plan.name}&rdquo; will no longer be bookable by guests. You
              can reactivate it at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setDeactivateOpen(false)
                toast.success("Rate plan deactivated")
              }}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * The quick Edit / Duplicate buttons shown in each card's footer. Edit reuses
 * the same prefilled dialog; Duplicate is a fire-and-forget ActionButton.
 */
export function RatePlanQuickActions({ plan }: { plan: RatePlan }) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [editNonce, setEditNonce] = React.useState(0)

  const openEdit = () => {
    setEditNonce((n) => n + 1)
    setEditOpen(true)
  }

  return (
    <>
      <div className="mt-auto flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={openEdit}
        >
          Edit
        </Button>
        <ActionButton
          variant="ghost"
          size="sm"
          className="flex-1"
          toastMessage="Rate plan duplicated"
        >
          Duplicate
        </ActionButton>
      </div>

      <EditPlanDialog
        key={editNonce}
        plan={plan}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  )
}
