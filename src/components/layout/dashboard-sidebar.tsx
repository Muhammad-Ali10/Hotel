"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import {
  Bell,
  CalendarCheck,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Settings,
  Star,
  User,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { avatarImage } from "@/lib/images"
import { useProfile, useUnreadCount } from "@/store/selectors"
import { Badge } from "@/components/ui/badge"

type Item = { title: string; href: string; icon: LucideIcon }

const items: Item[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "My Bookings", href: "/dashboard/bookings", icon: CalendarCheck },
  { title: "Favorites", href: "/dashboard/favorites", icon: Heart },
  { title: "Reviews", href: "/dashboard/reviews", icon: Star },
  { title: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { title: "Support", href: "/dashboard/support", icon: LifeBuoy },
  { title: "Profile", href: "/dashboard/profile", icon: User },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function DashboardSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const profile = useProfile()
  // Live count — this badge used to be the literal 2, so "mark all as read"
  // never changed it.
  const unread = useUnreadCount("customer")

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b p-4">
        <Image
          src={avatarImage(profile.avatarSeed)}
          alt={`${profile.firstName} ${profile.lastName}`}
          width={44}
          height={44}
          className="size-11 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {profile.firstName} {profile.lastName}
          </p>
          <Badge variant="secondary" className="mt-0.5">
            {profile.membership}
          </Badge>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href))
          const Icon = item.icon
          const badge = item.href === "/dashboard/notifications" ? unread : 0
          return (
            <Link
              key={item.title}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{item.title}</span>
              {badge > 0 ? (
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-xs",
                    active
                      ? "bg-primary-foreground text-primary"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
        >
          <LogOut className="size-4" />
          Sign Out
        </Link>
      </div>
    </div>
  )
}
