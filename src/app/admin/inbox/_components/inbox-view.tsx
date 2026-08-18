"use client"

import * as React from "react"
import { Headphones, MessageSquare, Search, Send } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import type { InboxThread } from "@/lib/admin/types"
import { propertyName } from "@/data/admin"
import {
  useMarkThreadRead,
  useReplyToThread,
  useSetThreadStatus,
  useThread,
  useThreads,
} from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import { AdminPageHeader, StatGrid, StatusPill } from "@/components/admin/shared"
import {
  EmptyState,
  ErrorState,
  NothingSelected,
} from "@/components/shared/states"
import { Skeleton } from "@/components/shared/data-table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Kind = InboxThread["kind"]

export function InboxView() {
  const can = useCan()
  const [kind, setKind] = React.useState<Kind>("ticket")
  const [query, setQuery] = React.useState("")
  // Selection is kept per channel, so switching tabs doesn't need an effect to
  // clear it — and returning to a channel restores what you were reading.
  const [selectionByKind, setSelectionByKind] = React.useState<
    Record<Kind, string | null>
  >({ ticket: null, guest: null })
  const selectedId = selectionByKind[kind]
  const markRead = useMarkThreadRead()

  function setSelectedId(id: string | null) {
    setSelectionByKind((prev) => ({ ...prev, [kind]: id }))
  }

  /** Opening a thread clears its unread flag and refreshes the sidebar badge. */
  function openThread(id: string, unread: boolean) {
    setSelectedId(id)
    if (unread) markRead.mutate(id)
  }

  const { data: allThreads } = useThreads()
  const { data: threads, isLoading, error, refetch } = useThreads(kind)
  const { data: thread, isLoading: threadLoading } = useThread(selectedId)

  const canReply = can.manage("inbox")

  const term = query.trim().toLowerCase()
  const visible = (threads ?? []).filter(
    (t) =>
      !term ||
      t.subject.toLowerCase().includes(term) ||
      t.guestName.toLowerCase().includes(term) ||
      t.bookingRef.toLowerCase().includes(term)
  )

  const tickets = (allThreads ?? []).filter((t) => t.kind === "ticket")
  const guestMessages = (allThreads ?? []).filter((t) => t.kind === "guest")
  const counts = {
    open: (allThreads ?? []).filter((t) => t.status === "Open").length,
    inProgress: (allThreads ?? []).filter((t) => t.status === "In Progress")
      .length,
    unread: (allThreads ?? []).filter((t) => t.unread).length,
    resolved: (allThreads ?? []).filter((t) => t.status === "Resolved").length,
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Inbox"
        subtitle={`All conversations across properties · ${counts.unread} unread`}
      />

      <StatGrid
        stats={[
          { label: "Open", value: String(counts.open), icon: "Inbox" },
          {
            label: "In Progress",
            value: String(counts.inProgress),
            icon: "Clock",
          },
          { label: "Unread", value: String(counts.unread), icon: "Mail" },
          {
            label: "Resolved",
            value: String(counts.resolved),
            icon: "CheckCircle2",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="overflow-hidden p-0">
          <div className="space-y-3 border-b p-3">
            <div
              role="tablist"
              aria-label="Conversation channel"
              className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1"
            >
              <ChannelTab
                icon={Headphones}
                label="Support"
                count={tickets.length}
                active={kind === "ticket"}
                onSelect={() => setKind("ticket")}
              />
              <ChannelTab
                icon={MessageSquare}
                label="Guests"
                count={guestMessages.length}
                active={kind === "guest"}
                onSelect={() => setKind("guest")}
              />
            </div>

            <div className="relative">
              <Search
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations…"
                aria-label="Search conversations"
                className="pl-8"
              />
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {error ? (
              <ErrorState error={error} onRetry={() => void refetch()} />
            ) : isLoading ? (
              <div className="space-y-4 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                filtered={Boolean(term)}
                onClearFilters={() => setQuery("")}
                title="No conversations"
                description="Messages from guests and support tickets land here."
              />
            ) : (
              <ul>
                {visible.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openThread(item.id, item.unread)}
                      aria-current={selectedId === item.id ? "true" : undefined}
                      className={cn(
                        "hover:bg-muted focus-visible:ring-ring/50 w-full border-b px-4 py-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-inset",
                        selectedId === item.id && "bg-accent"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {initials(item.guestName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium">
                              {item.guestName}
                            </span>
                            <span className="text-muted-foreground shrink-0 text-xs">
                              {formatRelativeTime(item.updatedAt)}
                            </span>
                          </div>
                          <p className="truncate text-sm">{item.subject}</p>
                          <p className="text-muted-foreground truncate text-xs">
                            {item.messages[item.messages.length - 1]?.body}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-muted-foreground text-xs">
                              {propertyName(item.propertyId)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {item.bookingRef}
                            </Badge>
                            <StatusPill status={item.status} />
                            {item.unread ? (
                              <span className="bg-primary size-1.5 rounded-full">
                                <span className="sr-only">Unread</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="flex min-h-[500px] flex-col overflow-hidden p-0">
          {!selectedId ? (
            <NothingSelected
              icon={kind === "ticket" ? Headphones : MessageSquare}
              title={
                kind === "ticket"
                  ? "Select a support ticket"
                  : "Select a conversation"
              }
              description="Open a thread to read the full history, change its status, and respond as admin."
              className="flex-1"
            />
          ) : threadLoading || !thread ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            // Keyed so switching threads remounts the composer with an empty
            // draft rather than syncing it in an effect.
            <ThreadPane key={thread.id} thread={thread} canReply={canReply} />
          )}
        </Card>
      </div>
    </div>
  )
}

function ChannelTab({
  icon: Icon,
  label,
  count,
  active,
  onSelect,
}: {
  icon: typeof Headphones
  label: string
  count: number
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "focus-visible:ring-ring/50 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon aria-hidden className="size-4" />
      {label}
      <span className="tabular-nums">({count})</span>
    </button>
  )
}

function ThreadPane({
  thread,
  canReply,
}: {
  thread: InboxThread
  canReply: boolean
}) {
  const [draft, setDraft] = React.useState("")
  const reply = useReplyToThread()
  const setStatus = useSetThreadStatus()

  function send() {
    const body = draft.trim()
    if (!body) return
    reply.mutate({ id: thread.id, body }, { onSuccess: () => setDraft("") })
  }

  return (
    <>
      <header className="space-y-2 border-b p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold">
              {thread.subject}
            </h2>
            <p className="text-muted-foreground text-xs">
              {thread.guestName} · {thread.guestEmail} ·{" "}
              {propertyName(thread.propertyId)} · {thread.room} ·{" "}
              {thread.bookingRef}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline">{thread.priority}</Badge>
            <StatusPill status={thread.status} />
          </div>
        </div>

        {canReply && thread.status !== "Resolved" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={setStatus.isPending}
            onClick={() =>
              setStatus.mutate({ id: thread.id, status: "Resolved" })
            }
          >
            Mark resolved
          </Button>
        ) : null}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {thread.messages.map((message) =>
          message.authorRole === "system" ? (
            <p
              key={message.id}
              className="text-muted-foreground bg-muted mx-auto w-fit rounded-full px-3 py-1 text-xs"
            >
              {message.body}
            </p>
          ) : (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.authorRole === "guest" ? "" : "flex-row-reverse"
              )}
            >
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {initials(message.author)}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "max-w-[75%] space-y-1",
                  message.authorRole !== "guest" && "items-end text-right"
                )}
              >
                <p className="text-muted-foreground text-xs">
                  {message.author} · {formatRelativeTime(message.at)}
                </p>
                <p
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm text-pretty",
                    message.authorRole === "guest"
                      ? "bg-muted"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {message.body}
                </p>
              </div>
            </div>
          )
        )}
      </div>

      <div className="border-t p-3">
        {canReply ? (
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send()
              }}
              rows={2}
              aria-label={`Reply to ${thread.guestName}`}
              placeholder={`Reply as admin to ${thread.guestName}…`}
              className="min-h-16 resize-none"
            />
            <Button
              size="icon"
              aria-label="Send reply"
              disabled={!draft.trim() || reply.isPending}
              onClick={send}
            >
              <Send className="size-4" />
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground py-2 text-center text-sm">
            Your role can read this conversation but not reply.
          </p>
        )}
      </div>
    </>
  )
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}
