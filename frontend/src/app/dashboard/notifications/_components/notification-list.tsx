"use client"

import Link from "next/link"
import { AlertTriangle, BellOff } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import type { NotificationDto } from "@/lib/api/endpoints"
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useSession,
} from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

function NotificationRow({
  notification,
  onRead,
}: {
  notification: NotificationDto
  onRead: () => void
}) {
  const body = (
    <>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {!notification.read ? (
          <span aria-label="Unread" className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
        ) : null}

        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-heading text-sm font-semibold">{notification.title}</h3>
          <p className="text-muted-foreground text-sm">{notification.message}</p>
        </div>
      </div>

      <time className="text-muted-foreground shrink-0 text-xs sm:pt-0.5 sm:text-right">
        {formatRelativeTime(notification.createdAt)}
      </time>
    </>
  )

  const className = cn(
    "flex flex-col gap-3 px-4 py-4 transition-colors sm:flex-row sm:items-start sm:gap-4",
    notification.read ? "bg-card" : "bg-muted/40",
    notification.href && "hover:bg-accent/40"
  )

  if (notification.href) {
    return (
      <Link href={notification.href} onClick={onRead} className="block">
        <Card className={className}>{body}</Card>
      </Link>
    )
  }

  return <Card className={className}>{body}</Card>
}

/**
 * The guest's notifications, from the server.
 *
 * It read a zustand store, so "mark all as read" survived until the tab was
 * closed and the same message came back unread on the next visit — while the
 * bell in the header, reading the same store, agreed with it and both were
 * wrong about the account.
 *
 * The `audience` filter is gone: the API already returns only what belongs to
 * the person asking. Filtering by audience in the client was a guess about
 * whose messages these were.
 */
export function NotificationList() {
  const session = useSession()
  const { data, isPending, error } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  const notifications = data?.items ?? []
  const unread = data?.unread ?? 0

  function markAllAsRead() {
    if (unread === 0) {
      toast("You're all caught up — nothing left to read.")
      return
    }
    markAll.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(
          `${result.marked} ${result.marked === 1 ? "notification" : "notifications"} marked as read.`
        ),
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Notifications
        </h1>

        <Button
          variant="ghost"
          size="sm"
          onClick={markAllAsRead}
          disabled={markAll.isPending || isPending}
          className="shrink-0 border"
        >
          Mark all as read
        </Button>
      </div>

      {!session.isLoading && !session.data ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="font-medium">Sign in to see your notifications</p>
          <Button size="sm" render={<Link href="/login">Sign in</Link>} />
        </div>
      ) : error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error.message}</span>
        </div>
      ) : isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading notifications">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-muted h-20 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <BellOff className="text-muted-foreground size-8" />
          <p className="font-medium">Nothing here yet</p>
          <p className="text-muted-foreground text-sm">
            Updates about your bookings and reviews will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onRead={() => {
                // Opening one marks it. Already-read ones are left alone so a
                // second visit is not a second write.
                if (!notification.read) markRead.mutate(notification.id)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
