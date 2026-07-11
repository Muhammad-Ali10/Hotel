"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
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

const cancellations = [
  "Free cancellation up to 24h before",
  "Free cancellation up to 48h before",
  "Non-refundable",
]
const mealPlans = ["Room only", "Breakfast included", "Half board", "Full board"]

export function CreatePlanDialog() {
  const [open, setOpen] = React.useState(false)
  const [cancellation, setCancellation] = React.useState(cancellations[0])
  const [meal, setMeal] = React.useState(mealPlans[0])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Create Plan
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Rate Plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Plan Name *</Label>
            <Input id="plan-name" placeholder="e.g. Summer Special Rate" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-price">Base Price / Night (USD) *</Label>
            <Input id="plan-price" type="number" placeholder="0.00" />
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
                {cancellations.map((c) => (
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
                {mealPlans.map((m) => (
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
          <Button onClick={() => setOpen(false)}>Create Plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
