"use client"

import Link from "next/link"
import { Bell, BellOff, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useSession,
} from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

/* ============================================================================
 * The bell.
 *
 * It read from the demo Zustand store, in three headers at once — so the badge
 * counted seeded fixtures while `/dashboard/notifications`, one click away,
 * listed the real ones from the API. The same person could be told they had
 * three unread and find none.
 *
 * There is no `audience` prop any more. The server scopes `/notifications` to
 * whoever is asking (a guest sees their bookings, a partner sees their
 * property's), so an audience passed from the header was a second opinion about
 * something the session already settles — and one that could disagree with it.
 *
 * `href` stays, because where "view all" LEADS is genuinely surface-specific:
 * the extranet's inbox and the dashboard's notification list are two pages.
 * ========================================================================== */

export function NotificationBell({
  href,
  className,
}: {
  href: string
  className?: string
}) {
  const session = useSession()
  const signedIn = Boolean(session.data)

  /*
   * Only asks once there is somebody to ask about. The bell used to render on
   * the public header beside the Register and Login buttons, where a visitor
   * with no account was shown a notification tray — and where this request
   * would be a guaranteed 401.
   */
  const notifications = useNotifications(false, signedIn)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  if (!signedIn) return null

  const unread = notifications.data?.unread ?? 0
  const recent = (notifications.data?.items ?? []).slice(0, 6)

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
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              Mark all as read
            </button>
          ) : null}
        </div>
        <Separator />

        {notifications.isPending ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 px-3 py-8 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        ) : notifications.isError ? (
          <div className="text-muted-foreground px-3 py-8 text-center text-sm">
            Couldn&apos;t load your notifications.
          </div>
        ) : recent.length === 0 ? (
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
                  onClick={() => {
                    if (!n.read) markRead.mutate(n.id)
                  }}
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
