"use client"

import * as React from "react"
import { Inbox } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import { usePartnerTicket, usePartnerTicketActions, usePartnerTickets } from "@/lib/api/hooks"
import type { TicketStatus } from "@/types"
import { TicketStatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

/**
 * The property's own tickets with the platform.
 *
 * Not a guest inbox — that is next door, hanging off bookings. This is the
 * organisation writing to Stayora, and every member of the organisation sees
 * the same threads, because a payout question raised by one manager is not
 * private to them.
 *
 * There is no "Mark resolved" here, deliberately. Closing a ticket is the
 * platform's call: a partner closing one they still need answered simply
 * removes it from the queue that was going to answer it. A reply reopens a
 * resolved thread, which is the honest way to say "this is not finished".
 */
export function SupportView() {
  const tickets = usePartnerTickets()
  const [activeId, setActiveId] = React.useState<string | null>(null)

  const list = tickets.data ?? []
  const active = list.find((t) => t.id === activeId) ?? list[0] ?? null

  if (tickets.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]" aria-busy="true">
        <div className="bg-muted h-96 animate-pulse rounded-xl" />
        <div className="bg-muted h-96 animate-pulse rounded-xl" />
      </div>
    )
  }

  if (tickets.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {tickets.error.message}
      </div>
    )
  }

  if (!active) {
    return (
      <Card className="flex flex-col items-center gap-2 py-16 text-center">
        <Inbox className="text-muted-foreground size-7" />
        <p className="font-medium">No tickets yet</p>
        <p className="text-muted-foreground text-sm">
          Use New Ticket to raise one with Stayora support.
        </p>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="py-0">
        <ul className="divide-y">
          {list.map((ticket) => (
            <li key={ticket.id}>
              <button
                type="button"
                onClick={() => setActiveId(ticket.id)}
                className={cn(
                  "hover:bg-muted/40 w-full space-y-1.5 px-4 py-3 text-left transition-colors",
                  active.id === ticket.id && "bg-muted/60"
                )}
              >
                <p className="truncate text-sm font-medium">{ticket.subject}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <TicketStatusBadge status={ticket.status as TicketStatus} />
                  <Badge variant="outline">{ticket.category}</Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {ticket.ref} · {formatRelativeTime(ticket.lastMessageAt)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Thread key={active.id} threadId={active.id} />
    </div>
  )
}

function Thread({ threadId }: { threadId: string }) {
  const detail = usePartnerTicket(threadId)
  const { reply } = usePartnerTicketActions()
  const [draft, setDraft] = React.useState("")

  const thread = detail.data?.thread
  const messages = detail.data?.messages ?? []

  function send() {
    const body = draft.trim()
    if (body.length === 0) return

    reply.mutate(
      { threadId, body },
      {
        onSuccess: () => {
          setDraft("")
          if (thread?.status === "resolved") {
            toast.success("Reply sent", { description: "The ticket is open again." })
          }
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      {detail.isPending ? (
        <div className="bg-muted h-72 animate-pulse rounded-lg" aria-busy="true" />
      ) : detail.error ? (
        <p className="text-destructive text-sm">{detail.error.message}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
            <div>
              <h2 className="font-heading text-base font-semibold">
                {thread?.subject}
              </h2>
              <p className="text-muted-foreground text-sm">
                {thread?.ref} · opened {formatRelativeTime(thread?.createdAt ?? "")}
              </p>
            </div>
            {thread ? <TicketStatusBadge status={thread.status as TicketStatus} /> : null}
          </div>

          <div className="min-h-64 flex-1 space-y-3 overflow-y-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[80%] space-y-1 rounded-lg px-3 py-2",
                  /*
                   * `agent` is Stayora answering; `requester` is this
                   * organisation. The SERVER decides which — a client guessing
                   * from "is this my user id" gets it wrong the moment a
                   * colleague replies. An `internal` note never reaches this
                   * list at all, so there is nothing to hide here.
                   */
                  message.authorKind === "agent"
                    ? "bg-muted"
                    : "bg-primary text-primary-foreground ml-auto"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                <p className="text-xs opacity-70">
                  {message.authorName} · {formatRelativeTime(message.createdAt)}
                </p>
              </div>
            ))}
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing on this thread yet.</p>
            ) : null}
          </div>

          <div className="space-y-2 border-t pt-3">
            <Textarea
              rows={3}
              value={draft}
              placeholder={
                thread?.status === "resolved"
                  ? "Replying reopens this ticket"
                  : "Add to this ticket"
              }
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex justify-end">
              <Button onClick={send} disabled={reply.isPending || draft.trim() === ""}>
                {reply.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
