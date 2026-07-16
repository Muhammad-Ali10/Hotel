"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import type { TicketPriority } from "@/types"
import { guestName } from "@/lib/domain"
import { ticketPriorityLabel } from "@/lib/labels"
import { useStore } from "@/store"
import { usePartnerHotels, usePartnerReservations } from "@/store/selectors"
import { partnerProfile } from "@/data/profile"
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
  "Connectivity",
  "Finance",
  "Booking",
  "Technical",
  "Content",
  "Other",
].map((c) => ({ value: c, label: c }))

const priorities: TicketPriority[] = ["low", "medium", "high"]
const priorityItems = priorities.map((p) => ({ value: p, label: ticketPriorityLabel[p] }))

/**
 * Creates a real ticket. The dialog used to collect a full description and fire
 * a toast — the fixed list on the Support screen never gained the ticket.
 */
export function GenerateTicketDialog() {
  const createTicket = useStore((s) => s.createTicket)
  const reservations = usePartnerReservations()
  const hotels = usePartnerHotels()

  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({
    subject: "",
    category: "Connectivity",
    priority: "medium" as TicketPriority,
    bookingId: "",
    hotelId: "",
    description: "",
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const hotelItems = [
    { value: "", label: "Not property-specific" },
    ...hotels.map((h) => ({ value: h.id, label: h.name })),
  ]
  // Only reservations that exist — the field used to be free text with an
  // RSV- placeholder from an id scheme the product no longer uses.
  const bookingItems = [
    { value: "", label: "No linked reservation" },
    ...reservations.slice(0, 20).map((b) => ({
      value: b.id,
      label: `${b.id} — ${guestName(b)}`,
    })),
  ]

  function create() {
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error("Add a subject and a description.")
      return
    }
    const ticket = createTicket({
      subject: form.subject.trim(),
      category: form.category,
      priority: form.priority,
      message: form.description.trim(),
      author: partnerProfile.name,
      email: partnerProfile.email,
      createdBy: "partner",
      hotelId: form.hotelId || undefined,
      bookingId: form.bookingId || undefined,
    })
    toast.success(`Ticket ${ticket.id} created.`)
    setForm({ ...form, subject: "", description: "", bookingId: "" })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Generate Ticket
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Support Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input
              id="ticket-subject"
              value={form.subject}
              onChange={(e) => set({ subject: e.target.value })}
              placeholder="Brief summary of the issue"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                items={categories}
                value={form.category}
                onValueChange={(v) => set({ category: String(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                items={priorityItems}
                value={form.priority}
                onValueChange={(v) => set({ priority: v as TicketPriority })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityItems.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Property (optional)</Label>
            <Select
              items={hotelItems}
              value={form.hotelId}
              onValueChange={(v) => set({ hotelId: String(v) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Not property-specific" />
              </SelectTrigger>
              <SelectContent>
                {hotelItems.map((h) => (
                  <SelectItem key={h.value || "none"} value={h.value}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Linked reservation (optional)</Label>
            <Select
              items={bookingItems}
              value={form.bookingId}
              onValueChange={(v) => set({ bookingId: String(v) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No linked reservation" />
              </SelectTrigger>
              <SelectContent>
                {bookingItems.map((b) => (
                  <SelectItem key={b.value || "none"} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ticket-description">Description</Label>
              <span className="text-muted-foreground text-xs">
                {form.description.length}/500
              </span>
            </div>
            <Textarea
              id="ticket-description"
              maxLength={500}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Detailed description of the issue…"
              className="min-h-24"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={create}>Create Ticket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
