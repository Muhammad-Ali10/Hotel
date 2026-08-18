"use client"

import Link from "next/link"
import {
  AlertTriangle,
  Bell,
  Building2,
  CreditCard,
  Hotel,
  Star,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import type { NotificationKind } from "@/lib/admin/types"
import {
  useMarkAllNotificationsRead,
  useNotifications,
} from "@/lib/admin/api/hooks"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/shared/data-table"

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  client: Building2,
  security: AlertTriangle,
  billing: CreditCard,
  approval: Hotel,
  review: Star,
}

/**
 * The bell popover from the Figma's overlay artboard, plus the empty state and
 * "View all" link it was missing.
 */
export function AdminNotificationsMenu() {
  const { data, isLoading } = useNotifications()
  const markAllRead = useMarkAllNotificationsRead()

  const notifications = data ?? []
  const unread = notifications.filter((n) => !n.read).length

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              unread > 0
                ? `Notifications, ${unread} unread`
                : "Notifications"
            }
          >
            <Bell className="size-4" />
            {unread > 0 ? (
              <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium tabular-nums">
                {unread}
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-heading text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => markAllRead.mutate(undefined)}
              disabled={markAllRead.isPending}
            >
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-88 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-sm">
              You&rsquo;re all caught up.
            </p>
          ) : (
            <ul>
              {notifications.map((notification) => {
                const Icon = KIND_ICONS[notification.kind]
                return (
                  <li key={notification.id}>
                    <Link
                      href={notification.href}
                      className={cn(
                        "hover:bg-muted flex gap-3 border-b px-4 py-3 transition-colors last:border-0",
                        !notification.read && "bg-accent/40"
                      )}
                    >
                      <span
                        aria-hidden
                        className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {notification.title}
                          {!notification.read ? (
                            <span className="sr-only"> (unread)</span>
                          ) : null}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {notification.detail}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {formatRelativeTime(notification.at)}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            render={<Link href="/admin/audit">View all activity</Link>}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
