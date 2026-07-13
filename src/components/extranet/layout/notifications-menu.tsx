"use client"

import * as React from "react"
import Link from "next/link"
import {
  Bell,
  CalendarCheck,
  Info,
  MessageSquare,
  Star,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  notificationFeed,
  type NotificationItem,
  type NotificationKind,
} from "@/data/extranet"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const iconFor: Record<NotificationKind, LucideIcon> = {
  booking: CalendarCheck,
  message: MessageSquare,
  review: Star,
  payment: Wallet,
  system: Info,
}

export function NotificationsMenu() {
  const [items, setItems] = React.useState<NotificationItem[]>(notificationFeed)
  const unread = items.filter((i) => i.unread).length

  function markAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, unread: false })))
    toast.success("All notifications marked as read")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            className="relative"
          >
            <Bell className="size-5" />
            {unread > 0 ? (
              <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium">
                {unread}
              </span>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-heading text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Mark all as read
            </button>
          ) : (
            <span className="text-muted-foreground text-xs">All caught up</span>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto py-1">
          {items.map((n) => {
            const Icon = iconFor[n.kind]
            return (
              <div
                key={n.id}
                className={cn(
                  "flex gap-3 px-4 py-3",
                  n.unread && "bg-muted/40"
                )}
              >
                <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {n.description}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    {n.time}
                  </p>
                </div>
                {n.unread ? (
                  <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            render={<Link href="/extranet/inbox" />}
          >
            View all in Inbox
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
