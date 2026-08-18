"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const TABS = [
  { label: "All reservations", href: "/admin/reservations" },
  { label: "Cancellations", href: "/admin/reservations/cancellations" },
]

/** The Figma's two-tab switch, implemented as routes so both deep-link. */
export function ReservationsTabs() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Reservation views"
      className="bg-muted inline-flex gap-1 rounded-lg p-1"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring/50 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
