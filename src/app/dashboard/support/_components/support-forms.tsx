"use client"

import * as React from "react"
import { Send } from "lucide-react"
import { toast } from "sonner"

import type { TicketPriority } from "@/types"
import { cn } from "@/lib/utils"
import { ticketPriorityLabel } from "@/lib/labels"
import { useStore } from "@/store"
import { useHotels, useMyBookings, useProfile } from "@/store/selectors"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TicketList } from "@/components/shared/ticket-list"

const PRIORITIES: TicketPriority[] = ["low", "medium", "high"]
const MAX = 500

const categories = [
  { value: "General Inquiry", label: "General Inquiry" },
  { value: "Booking", label: "Booking Issue" },
  { value: "Billing", label: "Payment & Refund" },
  { value: "Technical", label: "Technical Problem" },
  { value: "Other", label: "Other" },
]

const topics = [
  { value: "Booking Question", label: "Booking Question" },
  { value: "Amenities & Services", label: "Amenities & Services" },
  { value: "Special Request", label: "Special Request" },
  { value: "Complaint", label: "Complaint" },
  { value: "Other", label: "Other" },
]

export function SupportForms() {
  const profile = useProfile()

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-2">
        <SupportTicketForm />
        <HotelMessageForm />
      </section>

      {/* Both forms above land here — previously they submitted into a toast */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">My Tickets</h2>
        <TicketList audience="customer" authorName={profile.firstName} />
      </section>
    </div>
  )
}

function SupportTicketForm() {
  const profile = useProfile()
  const createTicket = useStore((s) => s.createTicket)

  const [form, setForm] = React.useState({
    name: `${profile.firstName} ${profile.lastName}`,
    email: profile.email,
    category: "General Inquiry",
    subject: "",
    message: "",
  })
  const [priority, setPriority] = React.useState<TicketPriority>("medium")
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const ticket = createTicket({
      subject: form.subject,
      category: form.category,
      priority,
      message: form.message,
      author: form.name,
      email: form.email,
      createdBy: "customer",
    })
    toast.success(`Ticket ${ticket.id} submitted`, {
      description: "Our team will respond within 24 hours.",
    })
    set({ subject: "", message: "" })
    setPriority("medium")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Submit a Support Ticket</CardTitle>
        <p className="text-muted-foreground text-sm">
          Our admin team will respond within 24 hours
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name *">
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} required />
            </Field>
            <Field label="Email Address *">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                required
              />
            </Field>
          </div>

          <Field label="Category *">
            <Select
              items={categories}
              value={form.category}
              onValueChange={(v) => set({ category: String(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <Chip key={p} selected={priority === p} onClick={() => setPriority(p)}>
                  {ticketPriorityLabel[p]}
                </Chip>
              ))}
            </div>
          </div>

          <Field label="Subject *">
            <Input
              value={form.subject}
              onChange={(e) => set({ subject: e.target.value })}
              placeholder="Brief description of your issue"
              required
            />
          </Field>

          <Field label={`Message * (${MAX - form.message.length} chars left)`}>
            <Textarea
              maxLength={MAX}
              value={form.message}
              onChange={(e) => set({ message: e.target.value })}
              placeholder="Describe your issue in detail..."
              className="min-h-28"
              required
            />
          </Field>

          <Button type="submit">
            <Send className="size-4" />
            Submit Ticket
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function HotelMessageForm() {
  const profile = useProfile()
  const hotels = useHotels()
  const bookings = useMyBookings()
  const createTicket = useStore((s) => s.createTicket)

  const [form, setForm] = React.useState({
    hotelId: "",
    bookingId: "",
    name: `${profile.firstName} ${profile.lastName}`,
    email: profile.email,
    topic: "Booking Question",
    message: "",
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const hotelItems = hotels.map((h) => ({ value: h.id, label: `${h.name} — ${h.city}` }))
  // Only the guest's own bookings — the field used to be a free-text box with a
  // placeholder from a booking-id scheme the product doesn't use.
  const bookingItems = [
    { value: "", label: "No specific booking" },
    ...bookings.map((b) => ({ value: b.id, label: `${b.id} — ${b.hotelName}` })),
  ]

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.hotelId) {
      toast.error("Please choose which hotel you're writing to.")
      return
    }
    const hotel = hotels.find((h) => h.id === form.hotelId)
    const ticket = createTicket({
      subject: `${form.topic} — ${hotel?.name ?? "Hotel"}`,
      category: form.topic,
      priority: "medium",
      message: form.message,
      author: form.name,
      email: form.email,
      createdBy: "customer",
      hotelId: form.hotelId,
      bookingId: form.bookingId || undefined,
    })
    toast.success(`Message sent (${ticket.id})`, {
      description: "The hotel will get back to you shortly.",
    })
    set({ message: "" })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Message a Hotel</CardTitle>
        <p className="text-muted-foreground text-sm">Contact a hotel directly about your stay</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Select Hotel *">
            <Select
              items={hotelItems}
              value={form.hotelId}
              onValueChange={(v) => set({ hotelId: String(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a hotel" />
              </SelectTrigger>
              <SelectContent>
                {hotelItems.map((h) => (
                  <SelectItem key={h.value} value={h.value}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Booking (optional)">
            <Select
              items={bookingItems}
              value={form.bookingId}
              onValueChange={(v) => set({ bookingId: String(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No specific booking" />
              </SelectTrigger>
              <SelectContent>
                {bookingItems.map((b) => (
                  <SelectItem key={b.value || "none"} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your Name *">
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} required />
            </Field>
            <Field label="Email Address *">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                required
              />
            </Field>
          </div>

          <Field label="Topic *">
            <Select
              items={topics}
              value={form.topic}
              onValueChange={(v) => set({ topic: String(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Message *">
            <Textarea
              value={form.message}
              onChange={(e) => set({ message: e.target.value })}
              placeholder="Write your message to the hotel..."
              className="min-h-28"
              required
            />
          </Field>

          <Button type="submit">
            <Send className="size-4" />
            Send Message
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-sm transition-colors",
        selected
          ? "bg-primary text-primary-foreground border-transparent"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
