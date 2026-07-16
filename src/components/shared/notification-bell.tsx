"use client"

import Link from "next/link"
import { Bell, BellOff } from "lucide-react"

import type { NotificationAudience } from "@/types"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import { useStore } from "@/store"
import { useNotifications, useUnreadCount } from "@/store/selectors"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

/**
 * The bell. Notifications existed from the start but there was nowhere to see
 * them from — no header carried a bell, and the sidebar's count was a literal.
 */
export function NotificationBell({
  audience,
  href,
  className,
}: {
  audience: NotificationAudience
  href: string
  className?: string
}) {
  const notifications = useNotifications(audience)
  const unread = useUnreadCount(audience)
  const markRead = useStore((s) => s.markNotificationRead)
  const markAllRead = useStore((s) => s.markAllNotificationsRead)

  const recent = notifications.slice(0, 6)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
            className={cn("relative", className)}
          >
            <Bell className="size-5" />
            {unread > 0 ? (
              <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead(audience)}
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              Mark all as read
            </button>
          ) : null}
        </div>
        <Separator />

        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <BellOff className="text-muted-foreground size-6" />
            <p className="text-muted-foreground text-sm">Nothing new right now.</p>
          </div>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {recent.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href ?? href}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    "hover:bg-accent/50 block px-3 py-2.5 transition-colors",
                    !n.read && "bg-muted/40"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.read ? (
                      <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="text-muted-foreground line-clamp-2 text-xs">{n.message}</p>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Separator />
        <Link
          href={href}
          className="text-muted-foreground hover:text-foreground block px-3 py-2.5 text-center text-sm"
        >
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  )
}
