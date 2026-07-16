"use client"

import * as React from "react"
import { toast } from "sonner"

import type { TicketPriority } from "@/types"
import { ticketPriorityLabel } from "@/lib/labels"
import { useStore } from "@/store"
import { useProfile } from "@/store/selectors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const categories = [
  "Booking & Reservations",
  "Payments & Billing",
  "Account & Profile",
  "Cancellations & Changes",
  "Rewards & Loyalty",
  "Other",
]

const categoryItems = categories.map((c) => ({ value: c, label: c }))
const priorities: TicketPriority[] = ["low", "medium", "high"]

const MESSAGE_MAX = 500

/** Submits into the ticket store, which the list underneath reads — the form
 *  used to fire a toast and drop everything the user had typed. */
export function SupportTicketForm() {
  const profile = useProfile()
  const createTicket = useStore((s) => s.createTicket)

  const [form, setForm] = React.useState({
    name: `${profile.firstName} ${profile.lastName}`,
    email: profile.email,
    category: "",
    subject: "",
    message: "",
  })
  const [priority, setPriority] = React.useState<TicketPriority>("medium")
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const charsLeft = MESSAGE_MAX - form.message.length

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.category) {
      toast.error("Please choose a category.")
      return
    }
    const ticket = createTicket({
      subject: form.subject,
      category: form.category,
      priority,
      message: form.message,
      author: form.name,
      email: form.email,
      createdBy: "customer",
    })
    toast.success(`Ticket ${ticket.id} submitted. We'll reply within 24 hours.`)
    setForm({ ...form, category: "", subject: "", message: "" })
    setPriority("medium")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ticket-name">Full Name *</Label>
          <Input
            id="ticket-name"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ticket-email">Email Address *</Label>
          <Input
            id="ticket-email"
            type="email"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ticket-category">Category *</Label>
          <Select
            items={categoryItems}
            value={form.category}
            onValueChange={(v) => set({ category: String(v) })}
          >
            <SelectTrigger id="ticket-category" className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categoryItems.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <div className="flex flex-wrap gap-2">
            {priorities.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                aria-pressed={priority === p}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  priority === p
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {ticketPriorityLabel[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-subject">Subject *</Label>
        <Input
          id="ticket-subject"
          value={form.subject}
          onChange={(e) => set({ subject: e.target.value })}
          placeholder="Brief description of your issue"
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="ticket-message">Message *</Label>
          <span className="text-muted-foreground text-xs">{charsLeft} chars left</span>
        </div>
        <Textarea
          id="ticket-message"
          value={form.message}
          onChange={(e) => set({ message: e.target.value.slice(0, MESSAGE_MAX) })}
          maxLength={MESSAGE_MAX}
          placeholder="Describe your issue in detail..."
          className="min-h-28"
          required
        />
      </div>

      <Button type="submit" className="w-full">
        Submit Ticket
      </Button>
    </form>
  )
}
