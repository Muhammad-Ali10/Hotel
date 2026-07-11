"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

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

const categories = [
  "Booking issue",
  "Payment",
  "Technical",
  "Guest complaint",
  "Other",
]
const priorities = ["Low", "Medium", "High"]

export function GenerateTicketDialog() {
  const [open, setOpen] = React.useState(false)
  const [category, setCategory] = React.useState(categories[0])
  const [priority, setPriority] = React.useState("Medium")
  const [description, setDescription] = React.useState("")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus className="size-4" />
            Generate Ticket
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Support Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input
              id="ticket-subject"
              placeholder="Brief summary of the issue…"
            />
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
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(String(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-guest">Linked Guest (optional)</Label>
            <Input id="ticket-guest" placeholder="Guest name…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-reservation">
              Reservation ID (optional)
            </Label>
            <Input id="ticket-reservation" placeholder="e.g. RSV-8842…" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ticket-description">Description</Label>
              <span className="text-muted-foreground text-xs">
                {description.length}/500
              </span>
            </div>
            <Textarea
              id="ticket-description"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the issue…"
              className="min-h-24"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
              toast.success("Support ticket created")
              setDescription("")
              setOpen(false)
            }}
          >
            Create Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
