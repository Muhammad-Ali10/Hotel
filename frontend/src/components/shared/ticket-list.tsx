"use client"

import * as React from "react"
import { Inbox, MessageSquare, Send } from "lucide-react"
import { toast } from "sonner"

import type { TicketStatus } from "@/types"
import { formatRelativeTime } from "@/lib/format"
import type { TicketDto } from "@/lib/api/endpoints"
import { useMyTickets, useReplyToTicket, useSession, useTicket } from "@/lib/api/hooks"
import { TicketStatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

/**
 * A guest's own support tickets, from the server.
 *
 * Two controls are gone, and both were the same kind of lie:
 *
 *  - **Priority** was shown as a badge the guest had chosen on the form. The
 *    API refuses it (`guestTicketSchema` has no `priority`): urgency is the
 *    desk's judgement, not the reporter's, or every ticket is urgent.
 *  - **Mark resolved** let the guest close their own ticket. Only an agent can
 *    (`PATCH /admin/support/:id`), and a guest replying to a resolved thread
 *    REOPENS it — because somebody who writes after "this is closed" is
 *    telling you it is not.
 */
export function TicketList() {
  /*
   * The public support page renders this, so there may be nobody to have
   * tickets. Asking anyway was a 401 in the console of every signed-out
   * visitor — and a disabled query stays `isPending` forever, so the signed-out
   * case has to be answered before the loading one.
   */
  const session = useSession()
  const signedIn = Boolean(session.data)
  const { data: tickets, isPending, error } = useMyTickets(signedIn)

  if (!signedIn) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Inbox className="text-muted-foreground size-7" />
          <p className="font-medium">Your tickets live in your account</p>
          <p className="text-muted-foreground text-sm">
            Sign in to see the ones you have open. You can still send the form
            above without an account — we will reply by email.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading tickets">
        {[0, 1].map((i) => (
          <div key={i} className="bg-muted h-16 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive text-sm">{error.message}</p>
        </CardContent>
      </Card>
    )
  }

  if (!tickets || tickets.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Inbox className="text-muted-foreground size-7" />
          <p className="font-medium">No tickets yet</p>
          <p className="text-muted-foreground text-sm">
            Submit the form above and your ticket will show up here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Accordion className="space-y-3">
      {tickets.map((ticket) => (
        <TicketRow key={ticket.id} ticket={ticket} />
      ))}
    </Accordion>
  )
}

function TicketRow({ ticket }: { ticket: TicketDto }) {
  const [open, setOpen] = React.useState(false)
  const [reply, setReply] = React.useState("")
  const send = useReplyToTicket(ticket.id)

  /*
   * The thread is fetched only when it is opened.
   *
   * A list of twenty tickets would otherwise pull twenty conversations nobody
   * has asked to read.
   */
  const thread = useTicket(open ? ticket.id : "")

  return (
    <AccordionItem
      value={ticket.id}
      className="bg-card rounded-xl border px-4"
      onOpenChange={setOpen}
    >
      <AccordionTrigger className="hover:no-underline">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 pr-3 text-left">
          {/* The reference a guest quotes to support — TKT-000123. */}
          <span className="text-muted-foreground font-mono text-xs">{ticket.ref}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{ticket.subject}</span>
          <Badge variant="outline">{ticket.category}</Badge>
          {/* The API's statuses and the frontend's are the same three
              (open / in_progress / resolved) — this narrows the contract's
              `string` to that union. */}
          <TicketStatusBadge status={ticket.status as TicketStatus} />
          <span className="text-muted-foreground text-xs">
            {formatRelativeTime(ticket.lastMessageAt)}
          </span>
        </div>
      </AccordionTrigger>

      <AccordionContent className="space-y-4 pb-4">
        {thread.isPending ? (
          <div className="bg-muted h-16 animate-pulse rounded-lg" aria-busy="true" />
        ) : (
          <ul className="space-y-3">
            {(thread.data?.messages ?? []).map((m) => (
              <li key={m.id} className="flex gap-2.5">
                <MessageSquare className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm">
                    <span className="font-medium">{m.authorName}</span>{" "}
                    <span className="text-muted-foreground text-xs">
                      {formatRelativeTime(m.createdAt)}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-sm text-pretty">{m.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder="Add a reply…"
          />
          <Button
            size="sm"
            disabled={send.isPending}
            onClick={() => {
              if (!reply.trim()) {
                toast.error("Write something before sending.")
                return
              }
              send.mutate(reply.trim(), {
                onSuccess: () => {
                  setReply("")
                  toast.success(
                    ticket.status === "resolved"
                      ? "Reply sent — this reopens the ticket."
                      : "Reply sent."
                  )
                },
                onError: (e) => toast.error(e.message),
              })
            }}
          >
            <Send className="size-3.5" />
            Send
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
