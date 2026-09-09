"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { formatDate } from "@/lib/format"
import { usePartnerConversations } from "@/lib/api/hooks"
import { bookingMessagesApi } from "@/lib/api/endpoints"
import { keys } from "@/lib/api/hooks"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/**
 * The guest inbox, one conversation per booking.
 *
 * A conversation is not a free-standing thing here: it hangs off a stay, which
 * is what lets the property see the dates, the room and the reference beside
 * every message. That also settles who may read it — whoever is on the booking
 * and whoever owns the property, and nobody else.
 *
 * Replies go to `/bookings/:id/messages`, the same route the guest's own
 * dashboard posts to. One table, one code path, one set of rules about who is
 * allowed to write.
 */
export function InboxView() {
  const conversations = usePartnerConversations()
  const [openId, setOpenId] = React.useState<string | null>(null)

  const items = conversations.data?.items ?? []

  /*
   * The selection is resolved, not stored.
   *
   * Keeping only the id and reading the row out of the list means a refresh
   * that drops a conversation cannot leave a stale copy of it on screen.
   */
  const selected = items.find((c) => c.bookingId === openId) ?? items[0] ?? null

  if (conversations.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]" aria-busy="true">
        <div className="bg-muted h-96 animate-pulse rounded-xl" />
        <div className="bg-muted h-96 animate-pulse rounded-xl" />
      </div>
    )
  }

  if (conversations.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {conversations.error.message}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground text-sm">
          No guest has written yet. A conversation starts when somebody with a booking
          sends a message about it.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="py-0">
        <ul className="divide-y">
          {items.map((c) => (
            <li key={c.bookingId}>
              <button
                type="button"
                onClick={() => setOpenId(c.bookingId)}
                className={cn(
                  "hover:bg-muted/40 w-full space-y-1 px-4 py-3 text-left transition-colors",
                  selected?.bookingId === c.bookingId && "bg-muted/60"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{c.guestName}</p>
                  {c.unread > 0 ? (
                    <Badge className="shrink-0">{c.unread}</Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  {c.ref} · {formatDate(c.checkIn)}
                </p>
                <p className="text-muted-foreground line-clamp-2 text-xs">
                  {c.lastSide === "property" ? "You: " : ""}
                  {c.preview}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {selected ? (
        <Conversation
          key={selected.bookingId}
          bookingId={selected.bookingId}
          guestName={selected.guestName}
          reference={selected.ref}
          propertyName={selected.propertyName}
          checkIn={selected.checkIn}
          checkOut={selected.checkOut}
        />
      ) : null}
    </div>
  )
}

function Conversation({
  bookingId,
  guestName,
  reference,
  propertyName,
  checkIn,
  checkOut,
}: {
  bookingId: string
  guestName: string
  reference: string
  propertyName: string
  checkIn: string
  checkOut: string
}) {
  const client = useQueryClient()
  const [draft, setDraft] = React.useState("")
  const [sending, setSending] = React.useState(false)

  const messages = useQuery({
    queryKey: keys.bookingMessages(bookingId),
    queryFn: () => bookingMessagesApi.list(bookingId),
    retry: false,
  })

  /*
   * `side` comes from the SERVER, not from which screen is open.
   *
   * The same route serves the guest's dashboard and this inbox, and it tells
   * each caller which side they are — so a partner reading their own thread
   * and a guest reading it see the same messages aligned opposite ways,
   * without either client deciding for itself.
   */
  const mySide = messages.data?.side ?? "property"
  const list = messages.data?.messages ?? []

  async function send() {
    const body = draft.trim()
    if (body.length === 0) return

    setSending(true)
    try {
      await bookingMessagesApi.send(bookingId, body)
      setDraft("")
      void client.invalidateQueries({ queryKey: keys.bookingMessages(bookingId) })
      // The list row carries the preview and the unread count; both moved.
      void client.invalidateQueries({ queryKey: keys.partnerConversations })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
          <div>
            <h2 className="font-heading text-base font-semibold">{guestName}</h2>
            <p className="text-muted-foreground text-sm">
              {reference} · {propertyName} · {formatDate(checkIn)} –{" "}
              {formatDate(checkOut)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/extranet/reservations">Open booking</Link>}
          />
        </div>

        <div className="min-h-64 flex-1 space-y-3 overflow-y-auto">
          {messages.isPending ? (
            <div className="bg-muted h-32 animate-pulse rounded-lg" aria-busy="true" />
          ) : messages.error ? (
            <p className="text-destructive text-sm">{messages.error.message}</p>
          ) : list.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing said yet. Whatever you write here reaches the guest on their own
              booking.
            </p>
          ) : (
            list.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[80%] space-y-1 rounded-lg px-3 py-2",
                  message.side === mySide
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                <p className="text-xs opacity-70">
                  {message.authorName} · {formatDate(message.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <Textarea
            rows={3}
            value={draft}
            placeholder={`Reply to ${guestName}`}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={send} disabled={sending || draft.trim().length === 0}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
