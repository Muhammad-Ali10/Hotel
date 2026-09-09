"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { formatDate } from "@/lib/format"
import { bookingMessagesApi } from "@/lib/api/endpoints"
import { keys, useMyBookings, useSession } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const MESSAGE_MAX = 500

/**
 * Messaging a property about a stay (rule #89).
 *
 * The old form let a guest pick ANY hotel from the catalogue and write to it.
 * That is not a conversation this product has: a message hangs off a BOOKING,
 * which is what decides who may read it — whoever is on the stay, and the
 * property that owns it. A guest with no booking at a hotel has no thread with
 * that hotel, and inventing one would have to invent who could see it.
 *
 * So the picker is the guest's own bookings. With none, the honest answer is
 * the support form beside this one — the platform will read that without a
 * booking, deliberately (rule #85), because "I cannot sign in" must not be
 * behind a sign-in.
 *
 * There is no topic, no priority and no category here either. Those belong to
 * a support TICKET; a message to the hotel about your room is a message.
 */
export function HotelMessageForm() {
  const session = useSession()
  const bookings = useMyBookings(Boolean(session.data))
  const client = useQueryClient()

  const [bookingId, setBookingId] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [sending, setSending] = React.useState(false)

  /*
   * Only stays that are still live.
   *
   * A cancelled booking has no conversation to continue, and a stay that ended
   * a year ago is a support question rather than a note to the front desk.
   */
  const eligible = (bookings.data ?? []).filter((b) => b.status !== "cancelled")
  const selected = eligible.find((b) => b.id === bookingId)

  if (!session.data) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Messaging a property is about one of your stays, so it needs your
          account. Anything else — including trouble signing in — goes to the
          support form beside this one, which does not.
        </p>
        <Button variant="outline" size="sm" render={<Link href="/login">Sign in</Link>} />
      </div>
    )
  }

  if (bookings.isPending) {
    return (
      <div className="bg-muted h-40 animate-pulse rounded-lg" aria-busy="true" />
    )
  }

  if (eligible.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          You have no current bookings to write about. A property can only be
          messaged about a stay — for anything else, use the support form and
          the platform will pick it up.
        </p>
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/hotels">Find somewhere to stay</Link>}
        />
      </div>
    )
  }

  const bookingItems = eligible.map((b) => ({
    value: b.id,
    label: `${b.propertyName} — ${formatDate(b.checkIn)} (${b.ref})`,
  }))

  const charsLeft = MESSAGE_MAX - message.length

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selected) {
      toast.error("Choose which stay this is about.")
      return
    }
    if (message.trim().length === 0) return

    setSending(true)
    try {
      await bookingMessagesApi.send(selected.id, message.trim())
      // The thread on the guest's own dashboard is now behind.
      void client.invalidateQueries({ queryKey: keys.bookingMessages(selected.id) })
      setMessage("")
      toast.success(`Sent to ${selected.propertyName}`, {
        description: "Their reply appears on this booking in your dashboard.",
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send.")
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="message-booking">Which stay *</Label>
        <Select
          items={bookingItems}
          value={bookingId}
          onValueChange={(v) => setBookingId(String(v))}
        >
          <SelectTrigger id="message-booking" className="w-full">
            <SelectValue placeholder="Choose a booking" />
          </SelectTrigger>
          <SelectContent>
            {bookingItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected ? (
          <p className="text-muted-foreground text-xs">
            {selected.roomName} · {formatDate(selected.checkIn)} –{" "}
            {formatDate(selected.checkOut)}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="message-body">Message *</Label>
          <span
            className={
              charsLeft < 0 ? "text-destructive text-xs" : "text-muted-foreground text-xs"
            }
          >
            {charsLeft} left
          </span>
        </div>
        <Textarea
          id="message-body"
          rows={5}
          value={message}
          maxLength={MESSAGE_MAX}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Early check-in, a quiet room, anything the property should know…"
        />
      </div>

      <Button
        type="submit"
        disabled={sending || !bookingId || message.trim().length === 0}
      >
        {sending ? "Sending…" : "Send to the property"}
      </Button>

      <p className="text-muted-foreground text-xs">
        This goes straight to the property, not to Stayora. Their reply lands on
        the booking in your dashboard.
      </p>
    </form>
  )
}
