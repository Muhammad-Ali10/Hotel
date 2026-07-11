"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { valueAddCategories } from "@/data/extranet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

const categories = valueAddCategories.filter((c) => c !== "All")

/** Header action + dialog to create a new value add. Mock — no persistence. */
export function AddValueAddDialog() {
  const [open, setOpen] = React.useState(false)
  const [category, setCategory] = React.useState(categories[0])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Add Value Add
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Value Add</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="value-add-name">Name *</Label>
            <Input id="value-add-name" placeholder="e.g. Airport Transfer" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(String(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="value-add-price">Price *</Label>
              <Input id="value-add-price" placeholder="e.g. $65 or $30/hr" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="value-add-description">Description</Label>
            <Textarea
              id="value-add-description"
              placeholder="Short description shown to guests…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
              toast.success("Value add created")
              setOpen(false)
            }}
          >
            Create Value Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
