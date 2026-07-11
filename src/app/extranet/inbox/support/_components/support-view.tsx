"use client"

import * as React from "react"
import { Send } from "lucide-react"
import { toast } from "sonner"

import { supportThreads, supportTickets } from "@/data/extranet"
import { cn } from "@/lib/utils"
import { StatusPill } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export function SupportView() {
  const [activeId, setActiveId] = React.useState(supportTickets[0].id)
  const [reply, setReply] = React.useState("")

  const active =
    supportTickets.find((t) => t.id === activeId) ?? supportTickets[0]
  const thread = supportThreads[active.id] ?? []

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid lg:h-[480px] lg:grid-cols-[340px_1fr]">
        {/* Ticket list */}
        <div className="flex flex-col border-b lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between gap-2 border-b p-3">
            <span className="text-sm font-medium">All Tickets</span>
            <span className="text-muted-foreground text-xs">
              {supportTickets.length} total
            </span>
          </div>
          <ul className="max-h-[320px] flex-1 divide-y overflow-y-auto lg:max-h-none">
            {supportTickets.map((t) => {
              const activeRow = t.id === activeId
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(t.id)}
                    className={cn(
                      "w-full space-y-1.5 p-3 text-left transition-colors",
                      activeRow ? "bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-xs font-medium">
                        {t.id}
                      </span>
                      <StatusPill status={t.status} />
                    </div>
                    <p className="text-sm font-medium">{t.subject}</p>
                    <p className="text-muted-foreground text-xs">
                      {t.guest} · {t.category} · {t.priority} priority
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Thread */}
        <div className="flex min-h-[360px] flex-col lg:min-h-0">
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{active.subject}</p>
              <p className="text-muted-foreground truncate text-xs">
                {active.id} · {active.guest}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusPill status={active.status} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.success(`Viewing ticket ${active.id}`)}
              >
                Ticket
              </Button>
            </div>
          </div>
          <div className="bg-muted/20 flex-1 space-y-3 overflow-y-auto p-4">
            {thread.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.from === "host" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                    m.from === "host"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card rounded-bl-sm ring-1 ring-foreground/10"
                  )}
                >
                  <p>{m.text}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      m.from === "host"
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {m.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-2 border-t p-3">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply…"
              className="max-h-32 min-h-10"
              rows={1}
            />
            <Button
              size="icon"
              aria-label="Send"
              disabled={!reply.trim()}
              onClick={() => {
                toast.success("Reply sent")
                setReply("")
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
