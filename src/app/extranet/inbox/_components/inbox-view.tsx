"use client"

import * as React from "react"
import { Search, Send } from "lucide-react"
import { toast } from "sonner"

import { conversations, conversationThread } from "@/data/extranet"
import { avatarImage } from "@/lib/images"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

const guestCount = conversations.filter((c) => c.kind === "guest").length
const supportCount = conversations.filter((c) => c.kind === "support").length

const tabs = [
  { key: "guest", label: "Guests", count: guestCount },
  { key: "support", label: "Support", count: supportCount },
] as const

const statusFilters = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
] as const

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
}

function guestEmail(name: string) {
  return `${name
    .toLowerCase()
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "")}@email.com`
}

export function InboxView() {
  const [activeId, setActiveId] = React.useState(conversations[0].id)
  const [tab, setTab] = React.useState<"guest" | "support">("guest")
  const [status, setStatus] = React.useState<"all" | "unread">("all")
  const [query, setQuery] = React.useState("")
  const [reply, setReply] = React.useState("")

  const list = conversations.filter((c) => {
    const matchesTab = c.kind === tab
    const matchesStatus = status === "all" || c.unread
    const matchesQuery =
      !query.trim() ||
      c.guest.toLowerCase().includes(query.trim().toLowerCase())
    return matchesTab && matchesStatus && matchesQuery
  })

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0]
  const thread =
    active.id === "c1"
      ? conversationThread
      : [{ id: "m0", from: "guest" as const, text: active.preview, time: active.time }]

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid lg:h-[640px] lg:grid-cols-[340px_1fr]">
        {/* Conversation list */}
        <div className="flex flex-col border-b lg:border-r lg:border-b-0">
          <div className="space-y-3 border-b p-3">
            <div className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    tab === t.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations…"
                className="h-9 pl-8"
              />
            </div>
            <div className="flex gap-1.5">
              {statusFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatus(f.key)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    status === f.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="max-h-[360px] flex-1 divide-y overflow-y-auto lg:max-h-none">
            {list.map((c) => {
              const activeRow = c.id === activeId
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "flex w-full items-start gap-3 p-3 text-left transition-colors",
                      activeRow ? "bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    <Avatar size="sm" className="mt-0.5">
                      <AvatarImage src={avatarImage(c.seed)} alt={c.guest} />
                      <AvatarFallback>{initials(c.guest)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm",
                            c.unread ? "font-semibold" : "font-medium"
                          )}
                        >
                          {c.guest}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {c.time}
                        </span>
                      </div>
                      <p className="text-muted-foreground truncate text-xs">
                        {c.preview}
                      </p>
                      <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                        {c.channel} · {c.property}
                      </p>
                    </div>
                    {c.unread ? (
                      <span className="bg-primary mt-1 size-2 shrink-0 rounded-full" />
                    ) : null}
                  </button>
                </li>
              )
            })}
            {list.length === 0 ? (
              <li className="text-muted-foreground p-6 text-center text-sm">
                No conversations found.
              </li>
            ) : null}
          </ul>
        </div>

        {/* Thread */}
        <div className="flex min-h-[480px] flex-col lg:min-h-0">
          <div className="flex items-center gap-3 border-b p-4">
            <Avatar>
              <AvatarImage src={avatarImage(active.seed)} alt={active.guest} />
              <AvatarFallback>{initials(active.guest)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{active.guest}</p>
              <p className="text-muted-foreground truncate text-xs">
                {guestEmail(active.guest)} · {active.channel} · {active.room} ·{" "}
                {active.property}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0"
              onClick={() => toast.success(`Ticket opened for ${active.guest}`)}
            >
              Ticket
            </Button>
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
                toast.success("Message sent")
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
