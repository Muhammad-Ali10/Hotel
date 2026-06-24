"use client"

import * as React from "react"
import { toast } from "sonner"

import type { AppNotification } from "@/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

function NotificationRow({ notification }: { notification: AppNotification }) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-3 px-4 py-4 transition-colors sm:flex-row sm:items-start sm:gap-4",
        notification.read ? "bg-card" : "bg-muted/40"
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {!notification.read ? (
          <span
            aria-label="Unread"
            className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
          />
        ) : null}

        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-heading text-sm font-semibold">
            {notification.title}
          </h3>
          <p className="text-muted-foreground text-sm">
            {notification.message}
          </p>
        </div>
      </div>

      <time className="text-muted-foreground shrink-0 text-xs sm:pt-0.5 sm:text-right">
        {notification.time}
      </time>
    </Card>
  )
}

export function NotificationList({ items }: { items: AppNotification[] }) {
  const [notifications, setNotifications] = React.useState(items)

  const unreadCount = notifications.filter((n) => !n.read).length

  function markAllAsRead() {
    if (unreadCount === 0) {
      toast("You're all caught up — nothing left to read.")
      return
    }
    setNotifications((current) => current.map((n) => ({ ...n, read: true })))
    toast.success("All notifications marked as read.")
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
          className="border shrink-0"
        >
          Mark all as read
        </Button>
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <NotificationRow key={notification.id} notification={notification} />
        ))}
      </div>
    </div>
  )
}
