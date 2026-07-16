"use client"

import * as React from "react"
import { Inbox, MessageSquare, Send } from "lucide-react"
import { toast } from "sonner"

import type { NotificationAudience, SupportTicket } from "@/types"
import { formatRelativeTime } from "@/lib/format"
import { ticketPriorityLabel } from "@/lib/labels"
import { useStore } from "@/store"
import { useTickets } from "@/store/selectors"
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
 * The list every support form was missing. Tickets were submitted into a toast
 * and never appeared anywhere — this renders the same store the forms write to.
 */
export function TicketList({
  audience,
  authorName,
}: {
  audience: NotificationAudience
  authorName: string
}) {
  const tickets = useTickets(audience)

  if (tickets.length === 0) {
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
        <TicketRow key={ticket.id} ticket={ticket} authorName={authorName} />
      ))}
    </Accordion>
  )
}

function TicketRow({ ticket, authorName }: { ticket: SupportTicket; authorName: string }) {
  const replyToTicket = useStore((s) => s.replyToTicket)
  const setTicketStatus = useStore((s) => s.setTicketStatus)
  const [reply, setReply] = React.useState("")

  return (
    <AccordionItem value={ticket.id} className="bg-card rounded-xl border px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 pr-3 text-left">
          <span className="text-muted-foreground font-mono text-xs">{ticket.id}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{ticket.subject}</span>
          <Badge variant="outline">{ticket.category}</Badge>
          <Badge variant="outline">{ticketPriorityLabel[ticket.priority]}</Badge>
          <TicketStatusBadge status={ticket.status} />
          <span className="text-muted-foreground text-xs">
            {formatRelativeTime(ticket.updatedAt)}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pb-4">
        <ul className="space-y-3">
          {ticket.messages.map((m) => (
            <li key={m.id} className="flex gap-2.5">
              <MessageSquare className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm">
                  <span className="font-medium">{m.author}</span>{" "}
                  <span className="text-muted-foreground text-xs">
                    {formatRelativeTime(m.date)}
                  </span>
                </p>
                <p className="text-muted-foreground text-sm text-pretty">{m.text}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder="Add a reply…"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (!reply.trim()) {
                  toast.error("Write something before sending.")
                  return
                }
                replyToTicket(ticket.id, reply.trim(), authorName)
                setReply("")
                toast.success("Reply sent.")
              }}
            >
              <Send className="size-3.5" />
              Send
            </Button>
            {ticket.status !== "resolved" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTicketStatus(ticket.id, "resolved")
                  toast.success(`${ticket.id} marked as resolved.`)
                }}
              >
                Mark resolved
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTicketStatus(ticket.id, "open")
                  toast.success(`${ticket.id} reopened.`)
                }}
              >
                Reopen
              </Button>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
