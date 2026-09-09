"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { useMyBookings, useOpenTicket, useProfile } from "@/lib/api/hooks"
import { bookingMessagesApi } from "@/lib/api/endpoints"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TicketList } from "@/components/shared/ticket-list"

/**
 * The API's own categories, not display strings.
 *
 * The form used to send "General Inquiry" and "Booking Issue" — words the
 * `guestTicketSchema` enum has never accepted. Every submission would have
 * been a 400. The label is for reading; the value is what travels.
 */
const CATEGORIES = [
  { value: "general", label: "General enquiry" },
  { value: "booking", label: "Booking issue" },
  { value: "billing", label: "Payment or refund" },
  { value: "cancellation", label: "Cancellation" },
  { value: "account", label: "My account" },
  { value: "technical", label: "Something is broken" },
] as const

export function SupportForms() {
  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-2">
        <SupportTicketForm />
        <HotelMessageForm />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">My Tickets</h2>
        <TicketList />
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

/**
 * A ticket to the PLATFORM.
 *
 * There is no priority control any more: `guestTicketSchema` has none, because
 * urgency is the desk's judgement rather than the reporter's — offered as a
 * field, every ticket is urgent and the queue stops meaning anything.
 */
function SupportTicketForm() {
  const { data: profile } = useProfile()
  const open = useOpenTicket()

  const [form, setForm] = React.useState({
    category: "general",
    subject: "",
    body: "",
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    open.mutate(
      {
        subject: form.subject.trim(),
        body: form.body.trim(),
        category: form.category,
        // Sent because the route is public (rule #85) and an anonymous ticket
        // has nowhere else to get them. For a signed-in guest the server
        // attaches the account regardless.
        email: profile?.email ?? "",
        name: profile ? `${profile.firstName} ${profile.lastName}` : "",
      },
      {
        onSuccess: (ticket) => {
          toast.success(`Ticket ${ticket.ref} submitted`, {
            description: "Our team will respond as soon as they can.",
          })
          set({ subject: "", body: "" })
        },
        onError: (error) => toast.error(error.message),
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Submit a Support Ticket</CardTitle>
        <p className="text-muted-foreground text-sm">
          For anything about your account, a payment, or the site itself.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Category">
            <Select
              items={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              value={form.category}
              onValueChange={(v) => set({ category: String(v) })}
            />
          </Field>

          <Field label="Subject *">
            <Input
              value={form.subject}
              onChange={(e) => set({ subject: e.target.value })}
              required
              minLength={3}
            />
          </Field>

          <Field label="Message *">
            <Textarea
              value={form.body}
              onChange={(e) => set({ body: e.target.value })}
              rows={5}
              required
            />
          </Field>

          <Button type="submit" disabled={open.isPending}>
            {open.isPending ? "Sending…" : "Submit ticket"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/**
 * A message to the HOTEL, about one booking (rule #89).
 *
 * This used to open a support ticket. That put the platform in the middle of a
 * conversation it is not part of — "can we have a cot in the room" is not
 * support's business, and routing it there means the desk reads every one.
 *
 * It also means the hotel sees it: `POST /bookings/:id/messages` lands in the
 * property's own inbox, where somebody who can actually answer is looking.
 *
 * A booking is REQUIRED, and that is the point. There is no channel to a hotel
 * a guest has no reservation with — the old form let them pick any hotel in the
 * catalogue and write to it.
 */
function HotelMessageForm() {
  const { data: bookings, isPending } = useMyBookings()
  const [bookingId, setBookingId] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [sending, setSending] = React.useState(false)

  // Only stays that are still live. Writing to a hotel about a booking
  // cancelled last March is a message nobody is waiting for.
  const reachable = (bookings ?? []).filter(
    (b) => b.status !== "cancelled" && b.status !== "no_show"
  )

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!bookingId) {
      toast.error("Choose which booking you're writing about.")
      return
    }
    setSending(true)
    try {
      await bookingMessagesApi.send(bookingId, message.trim())
      toast.success("Message sent", { description: "The hotel will reply here." })
      setMessage("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Message a Hotel</CardTitle>
        <p className="text-muted-foreground text-sm">
          Contact a hotel directly about a stay you have booked.
        </p>
      </CardHeader>
      <CardContent>
        {!isPending && reachable.length === 0 ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-muted-foreground text-sm">
              You can message a hotel once you have a booking with them.
            </p>
            <Button size="sm" render={<Link href="/hotels">Browse hotels</Link>} />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Which booking? *">
              <Select
                items={reachable.map((b) => ({
                  value: b.id,
                  label: `${b.ref} — ${b.propertyName}`,
                }))}
                value={bookingId}
                onValueChange={(v) => setBookingId(String(v))}
              />
            </Field>

            <Field label="Message *">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                required
                placeholder="Could we have a room on a high floor if one is free?"
              />
            </Field>

            <Button type="submit" disabled={sending || isPending}>
              {sending ? "Sending…" : "Send message"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
