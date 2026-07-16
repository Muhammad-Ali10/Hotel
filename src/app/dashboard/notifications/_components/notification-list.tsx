"use client"

import Link from "next/link"
import { BellOff } from "lucide-react"
import { toast } from "sonner"

import type { AppNotification } from "@/types"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import { useStore } from "@/store"
import { useNotifications, useUnreadCount } from "@/store/selectors"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

function NotificationRow({
  notification,
  onRead,
}: {
  notification: AppNotification
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

export function NotificationList() {
  const notifications = useNotifications("customer")
  const unreadCount = useUnreadCount("customer")
  const markAllRead = useStore((s) => s.markAllNotificationsRead)
  const markRead = useStore((s) => s.markNotificationRead)

  function markAllAsRead() {
    if (unreadCount === 0) {
      toast("You're all caught up — nothing left to read.")
      return
    }
    markAllRead("customer")
    toast.success("All notifications marked as read.")
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Notifications
        </h1>

        <Button variant="ghost" size="sm" onClick={markAllAsRead} className="shrink-0 border">
          Mark all as read
        </Button>
      </div>

      {notifications.length === 0 ? (
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
              onRead={() => markRead(notification.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
