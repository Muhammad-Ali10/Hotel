"use client"

import Link from "next/link"
import { Bell, Hotel, Inbox, Star } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAdminCounts } from "@/lib/admin/api/hooks"
import { useAdminRole } from "@/components/admin/role-provider"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/shared/data-table"

/**
 * What is waiting for the platform.
 *
 * This was a notifications feed, and it could not be one: nothing in the
 * product sends an admin a notification. The catalogue's every template is
 * addressed to a guest or to a partner (rule #105) — there is no admin
 * audience — so the bell was reading a fixture and offering to mark it read.
 *
 * A bell means "something needs you", and for an operator that is a work
 * queue, not a message list. These three are real counts of real queues, and
 * each one links to the screen that empties it:
 *
 *   - listings waiting on a decision
 *   - reviews waiting on moderation
 *   - support tickets still open
 *
 * There is no "mark all read", because none of these clears by being looked
 * at. They clear by being done.
 */

const QUEUES = [
  {
    key: "propertiesPending" as const,
    icon: Hotel,
    title: "Listings waiting",
    detail: "Submitted by partners, not yet approved",
    href: "/admin/properties",
  },
  {
    key: "reviewsToModerate" as const,
    icon: Star,
    title: "Reviews to moderate",
    detail: "Written by guests, not yet published",
    href: "/admin/reviews",
  },
  {
    key: "inboxUnread" as const,
    icon: Inbox,
    title: "Open tickets",
    detail: "Guests and partners waiting on a reply",
    href: "/admin/inbox",
  },
]

export function AdminNotificationsMenu() {
  /*
   * The topbar renders around the route guard, not inside it, so this mounts
   * for anybody who opens `/admin` — including the guest and the partner the
   * guard is about to refuse. Ungated, it asked the API three questions on
   * their behalf and collected three 403s.
   */
  const { role } = useAdminRole()
  const { badges, isPending } = useAdminCounts(Boolean(role))

  if (!role) return null

  const waiting = QUEUES.map((queue) => ({
    ...queue,
    count: badges[queue.key],
  })).filter((queue) => queue.count > 0)

  const total = waiting.reduce((sum, queue) => sum + queue.count, 0)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              total > 0 ? `Work queue, ${total} waiting` : "Work queue"
            }
          >
            <Bell className="size-4" />
            {total > 0 ? (
              <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium tabular-nums">
                {total > 99 ? "99+" : total}
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-88 p-0">
        <div className="border-b px-4 py-3">
          <p className="font-heading text-sm font-semibold">Waiting for you</p>
        </div>

        <div className="max-h-88 overflow-y-auto">
          {isPending ? (
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
          ) : waiting.length === 0 ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-sm">
              Nothing waiting. Every queue is empty.
            </p>
          ) : (
            <ul>
              {waiting.map((queue) => {
                const Icon = queue.icon
                return (
                  <li key={queue.key}>
                    <Link
                      href={queue.href}
                      className={cn(
                        "hover:bg-muted flex items-center gap-3 border-b px-4 py-3 transition-colors last:border-0"
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
                          {queue.title}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {queue.detail}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {queue.count}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            render={<Link href="/admin/audit">See what has been done</Link>}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
