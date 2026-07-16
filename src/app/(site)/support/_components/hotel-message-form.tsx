"use client"

import * as React from "react"
import { toast } from "sonner"

import { useStore } from "@/store"
import { useHotels, useMyBookings, useProfile } from "@/store/selectors"
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

const topics = [
  "Room amenities",
  "Special requests",
  "Early check-in / late check-out",
  "Accessibility",
  "Billing question",
  "Other",
].map((t) => ({ value: t, label: t }))

const MESSAGE_MAX = 500

/**
 * Writes to the ticket store, so the message lands in the My Tickets list below
 * this form. This copy of the form used to toast and reset — its twin on the
 * dashboard saved properly, so the same feature worked or didn't depending on
 * which page you were standing on.
 */
export function HotelMessageForm() {
  const profile = useProfile()
  const hotels = useHotels()
  const bookings = useMyBookings()
  const createTicket = useStore((s) => s.createTicket)

  const [form, setForm] = React.useState({
    hotelId: "",
    bookingId: "",
    topic: "",
    name: `${profile.firstName} ${profile.lastName}`,
    email: profile.email,
    message: "",
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const charsLeft = MESSAGE_MAX - form.message.length

  const hotelItems = hotels.map((h) => ({ value: h.id, label: h.name }))
  const bookingItems = [
    { value: "", label: "No specific booking" },
    ...bookings.map((b) => ({ value: b.id, label: `${b.id} — ${b.hotelName}` })),
  ]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.hotelId || !form.topic) {
      toast.error("Please choose a hotel and a topic.")
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
    toast.success(`Message sent (${ticket.id}). The hotel will reply to your email shortly.`)
    set({ message: "", topic: "" })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="hotel-select">Select Hotel *</Label>
        <Select
          items={hotelItems}
          value={form.hotelId}
          onValueChange={(v) => set({ hotelId: String(v) })}
        >
          <SelectTrigger id="hotel-select" className="w-full">
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hotel-booking">Booking (optional)</Label>
          <Select
            items={bookingItems}
            value={form.bookingId}
            onValueChange={(v) => set({ bookingId: String(v) })}
          >
            <SelectTrigger id="hotel-booking" className="w-full">
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="hotel-topic">Topic *</Label>
          <Select items={topics} value={form.topic} onValueChange={(v) => set({ topic: String(v) })}>
            <SelectTrigger id="hotel-topic" className="w-full">
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hotel-name">Your Name *</Label>
          <Input
            id="hotel-name"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hotel-email">Email Address *</Label>
          <Input
            id="hotel-email"
            type="email"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="hotel-message">Message *</Label>
          <span className="text-muted-foreground text-xs">{charsLeft} chars left</span>
        </div>
        <Textarea
          id="hotel-message"
          value={form.message}
          onChange={(e) => set({ message: e.target.value.slice(0, MESSAGE_MAX) })}
          maxLength={MESSAGE_MAX}
          placeholder="Write your message to the hotel..."
          className="min-h-28"
          required
        />
      </div>

      <Button type="submit" className="w-full">
        Send Message
      </Button>
    </form>
  )
}
