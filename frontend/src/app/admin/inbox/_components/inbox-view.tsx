"use client"

import * as React from "react"
import Link from "next/link"
import { Lock, Send } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import { useReplyToThread, useThread, useThreads, useUpdateThread } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import { AdminPageHeader, StatGrid, StatusPill } from "@/components/admin/shared"
import { EmptyState, ErrorState, NothingSelected } from "@/components/shared/states"
import { Skeleton } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Audience = "guest" | "partner"

const STATUSES = ["open", "in_progress", "resolved"] as const
const PRIORITIES = ["low", "medium", "high"] as const

/**
 * The platform's support queue.
 *
 * Two audiences, one queue: a guest writing in and a partner writing in are
 * different populations with different categories, but the same people answer
 * both — so the tabs split them and the ordering does not.
 *
 * **Guest↔property messages are not here, and must not be.** The mock's inbox
 * had a second channel for them; those conversations belong to a booking and
 * are readable by the guest on it and the property that owns it, and by
 * nobody else. The platform reading a hotel's private correspondence with its
 * guests is not a feature, it is a leak.
 *
 * There is no "mark as read" either. A ticket is not read or unread; it is
 * open, being worked on, or resolved — and those are the platform's own
 * states, moved deliberately rather than by somebody glancing at a list.
 */
export function InboxView() {
  const can = useCan()
  const [audience, setAudience] = React.useState<Audience>("guest")
  const [search, setSearch] = React.useState("")

  /*
   * Selection is kept per tab.
   *
   * Switching audience does not need an effect to clear it, and coming back
   * restores whatever was being read.
   */
  const [selectionByAudience, setSelectionByAudience] = React.useState<
    Record<Audience, string | null>
  >({ guest: null, partner: null })
  const selectedId = selectionByAudience[audience]

  const query = React.useMemo(
    () => ({ audience, ...(search.trim() ? { q: search.trim() } : {}), limit: 50 }),
    [audience, search]
  )

  const { data, isLoading, error, refetch } = useThreads(query)
  const detail = useThread(selectedId)
  const reply = useReplyToThread()
  const update = useUpdateThread()

  const canReply = can.manage("inbox")
  const threads = data?.items ?? []
  const counts = data?.counts ?? {}

  function select(id: string | null) {
    setSelectionByAudience((prev) => ({ ...prev, [audience]: id }))
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Support Inbox"
        subtitle="Tickets from guests and from partners, oldest wait first"
      />

      <StatGrid
        className="lg:grid-cols-3"
        stats={[
          {
            label: "Open",
            value: isLoading ? "—" : String(counts.open ?? 0),
            caption: "nobody has started",
            icon: "Inbox",
          },
          {
            label: "In progress",
            value: isLoading ? "—" : String(counts.in_progress ?? 0),
            icon: "Clock",
          },
          {
            label: "Resolved",
            value: isLoading ? "—" : String(counts.resolved ?? 0),
            icon: "CheckCircle2",
          },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Who wrote in"
          className="bg-muted flex gap-1 rounded-lg p-1"
        >
          {(["guest", "partner"] as Audience[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={audience === value}
              onClick={() => setAudience(value)}
              className={cn(
                "focus-visible:ring-ring/50 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
                audience === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {value === "guest" ? "From guests" : "From partners"}
            </button>
          ))}
        </div>

        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference, subject or email…"
          aria-label="Search tickets"
          className="sm:max-w-xs"
        />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} variant="page" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <Card className="py-0">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : threads.length === 0 ? (
              <EmptyState
                filtered={search.trim().length > 0}
                onClearFilters={() => setSearch("")}
                title="Nothing waiting"
                description={
                  audience === "guest"
                    ? "No guest has written in."
                    : "No partner has written in."
                }
              />
            ) : (
              <ul className="divide-y">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => select(thread.id)}
                      className={cn(
                        "hover:bg-muted/40 w-full space-y-1.5 px-4 py-3 text-left transition-colors",
                        selectedId === thread.id && "bg-muted/60"
                      )}
                    >
                      <p className="truncate text-sm font-medium">{thread.subject}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusPill status={thread.status} />
                        <Badge variant="outline">{thread.category}</Badge>
                        {thread.priority === "high" ? (
                          <Badge variant="destructive">high</Badge>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground truncate text-xs">
                        {thread.ref} · {thread.requesterName} ·{" "}
                        {formatRelativeTime(thread.lastMessageAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {selectedId === null ? (
            <NothingSelected
              title="No ticket selected"
              description="Choose one from the list to read it and reply."
            />
          ) : detail.isLoading || !detail.data ? (
            <Card className="space-y-3 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </Card>
          ) : (
            <ThreadPane
              thread={detail.data.thread}
              messages={detail.data.messages}
              canReply={canReply}
              onSend={(body, internal) =>
                reply.mutate({ threadId: detail.data!.thread.id, body, internal })
              }
              sending={reply.isPending}
              onUpdate={(patch) =>
                update.mutate({ threadId: detail.data!.thread.id, patch })
              }
              updating={update.isPending}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ThreadPane({
  thread,
  messages,
  canReply,
  onSend,
  sending,
  onUpdate,
  updating,
}: {
  thread: import("@/lib/admin/api/endpoints").AdminThread
  messages: import("@/lib/admin/api/endpoints").AdminThreadMessage[]
  canReply: boolean
  onSend: (body: string, internal: boolean) => void
  sending: boolean
  onUpdate: (patch: Record<string, unknown>) => void
  updating: boolean
}) {
  const [draft, setDraft] = React.useState("")
  const [internal, setInternal] = React.useState(false)

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold">{thread.subject}</h2>
          <p className="text-muted-foreground text-sm">
            {thread.ref} · {thread.requesterName} ·{" "}
            <a href={`mailto:${thread.requesterEmail}`} className="hover:underline">
              {thread.requesterEmail}
            </a>
          </p>
          {thread.bookingId ? (
            <Link
              href={`/admin/reservations?focus=${thread.bookingId}`}
              className="text-muted-foreground text-xs underline-offset-2 hover:underline"
            >
              About a booking — open it
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Status"
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
            value={thread.status}
            disabled={!canReply || updating}
            onChange={(e) => onUpdate({ status: e.target.value })}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            aria-label="Priority"
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
            value={thread.priority}
            disabled={!canReply || updating}
            onChange={(e) => onUpdate({ priority: e.target.value })}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-h-64 flex-1 space-y-3 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[80%] space-y-1 rounded-lg px-3 py-2",
              message.authorKind === "requester"
                ? "bg-muted"
                : message.authorKind === "internal"
                  ? /*
                     * An internal note. Marked, not hidden — the person who
                     * wrote it needs to see it, and needs to be sure the
                     * requester cannot.
                     */
                    "bg-amber-500/10 ml-auto border border-amber-500/30"
                  : "bg-primary text-primary-foreground ml-auto"
            )}
          >
            {message.authorKind === "internal" ? (
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <Lock className="size-3" />
                Internal — the requester never sees this
              </p>
            ) : null}
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

      {canReply ? (
        <div className="space-y-2 border-t pt-3">
          <Textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              internal
                ? "A note for the team — the requester never sees this"
                : `Reply to ${thread.requesterName}`
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
              />
              Internal note
            </label>
            <Button
              disabled={sending || draft.trim().length === 0}
              onClick={() => {
                onSend(draft.trim(), internal)
                setDraft("")
              }}
            >
              <Send className="size-4" />
              {sending ? "Sending…" : internal ? "Add note" : "Reply"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground border-t pt-3 text-sm">
          Your role can read this queue but not reply to it.
        </p>
      )}
    </Card>
  )
}
