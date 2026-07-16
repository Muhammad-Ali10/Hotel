"use client"

import * as React from "react"
import { Inbox, Send } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import { ticketPriorityLabel } from "@/lib/labels"
import { useStore } from "@/store"
import { useTickets } from "@/store/selectors"
import { partnerProfile } from "@/data/profile"
import { TicketStatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

/**
 * The partner's tickets — the same list the Generate Ticket dialog writes to.
 * This view used to render a fixed array, so a ticket the partner had just
 * created never appeared.
 */
export function SupportView() {
  const tickets = useTickets("partner")
  const replyToTicket = useStore((s) => s.replyToTicket)
  const setTicketStatus = useStore((s) => s.setTicketStatus)

  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [reply, setReply] = React.useState("")

  const active = tickets.find((t) => t.id === activeId) ?? tickets[0]

  if (tickets.length === 0 || !active) {
    return (
      <Card className="flex flex-col items-center gap-2 py-16 text-center">
        <Inbox className="text-muted-foreground size-7" />
        <p className="font-medium">No tickets yet</p>
        <p className="text-muted-foreground text-sm">
          Use Generate Ticket to raise one with Stayora support.
        </p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid lg:h-[480px] lg:grid-cols-[340px_1fr]">
        {/* Ticket list */}
        <div className="flex flex-col border-b lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between gap-2 border-b p-3">
            <span className="text-sm font-medium">All Tickets</span>
            <span className="text-muted-foreground text-xs">{tickets.length} total</span>
          </div>
          <ul className="max-h-[320px] flex-1 divide-y overflow-y-auto lg:max-h-none">
            {tickets.map((t) => {
              const activeRow = t.id === active.id
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(t.id)}
                    className={cn(
                      "hover:bg-accent/40 w-full space-y-1 p-3 text-left transition-colors",
                      activeRow && "bg-muted/60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground font-mono text-xs">{t.id}</span>
                      <TicketStatusBadge status={t.status} />
                    </div>
                    <p className="truncate text-sm font-medium">{t.subject}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t.category}</Badge>
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(t.updatedAt)}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Thread */}
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{active.subject}</p>
              <p className="text-muted-foreground text-xs">
                {active.id} · {active.category} · {ticketPriorityLabel[active.priority]} priority
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = active.status === "resolved" ? "open" : "resolved"
                setTicketStatus(active.id, next)
                toast.success(
                  next === "resolved" ? `${active.id} resolved.` : `${active.id} reopened.`
                )
              }}
            >
              {active.status === "resolved" ? "Reopen" : "Mark resolved"}
            </Button>
          </div>

          <ul className="flex-1 space-y-4 overflow-y-auto p-4">
            {active.messages.map((m) => (
              <li
                key={m.id}
                className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] space-y-1 rounded-lg px-3 py-2",
                    m.from === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  <p className="text-sm text-pretty">{m.text}</p>
                  <p className="text-xs opacity-70">
                    {m.author} · {formatRelativeTime(m.date)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-end gap-2 border-t p-3">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Reply to support…"
              className="min-h-10 flex-1"
              rows={1}
            />
            <Button
              size="icon"
              aria-label="Send reply"
              onClick={() => {
                if (!reply.trim()) {
                  toast.error("Write a reply first.")
                  return
                }
                replyToTicket(active.id, reply.trim(), partnerProfile.name)
                setReply("")
                toast.success("Reply sent.")
              }}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
