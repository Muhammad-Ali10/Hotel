"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

type Destination = { title: string; href: string; group: string }

/** Searchable jump-to targets across the extranet. */
const destinations: Destination[] = [
  { title: "Dashboard", href: "/extranet", group: "Overview" },
  { title: "Reservations", href: "/extranet/reservations", group: "Reservations" },
  { title: "Cancellations", href: "/extranet/reservations/cancellations", group: "Reservations" },
  { title: "Properties", href: "/extranet/properties", group: "Property" },
  { title: "Property Info", href: "/extranet/property", group: "Property" },
  { title: "Room Types", href: "/extranet/property/room-types", group: "Property" },
  { title: "Amenities", href: "/extranet/property/amenities", group: "Property" },
  { title: "Photos", href: "/extranet/property/photos", group: "Property" },
  { title: "Messaging Preferences", href: "/extranet/property/messaging", group: "Property" },
  { title: "Rate Plans", href: "/extranet/rates", group: "Rates" },
  { title: "Calendar", href: "/extranet/rates/calendar", group: "Rates" },
  { title: "Availability Planner", href: "/extranet/rates/availability", group: "Rates" },
  { title: "Promotions", href: "/extranet/promotions", group: "Promotions" },
  { title: "Boost Performance", href: "/extranet/boost", group: "Boost" },
  { title: "Inbox", href: "/extranet/inbox", group: "Inbox" },
  { title: "Guest Reviews", href: "/extranet/reviews", group: "Reviews" },
  { title: "Finance", href: "/extranet/finance", group: "Finance" },
  { title: "Revenue Tracking", href: "/extranet/finance/revenue", group: "Finance" },
  { title: "Payouts", href: "/extranet/finance/payouts", group: "Finance" },
  { title: "Invoices", href: "/extranet/finance/invoices", group: "Finance" },
  { title: "Analytics", href: "/extranet/analytics", group: "Analytics" },
  { title: "Account & Team", href: "/extranet/account", group: "Account" },
]

export function TopbarSearch() {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)

  const q = query.trim().toLowerCase()
  const results = q
    ? destinations
        .filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            d.group.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : []

  function go(href: string) {
    setQuery("")
    setOpen(false)
    router.push(href)
  }

  return (
    <div className="relative hidden flex-1 md:block">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) go(results[0].href)
          if (e.key === "Escape") setOpen(false)
        }}
        placeholder="Search reservations, guests…"
        className="bg-muted/40 h-9 max-w-md pl-8"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="topbar-search-results"
      />

      {open && q ? (
        <div
          id="topbar-search-results"
          role="listbox"
          className="bg-popover text-popover-foreground absolute z-50 mt-1 w-full max-w-md overflow-hidden rounded-lg border shadow-md"
        >
          {results.length > 0 ? (
            results.map((d) => (
              <button
                key={d.href}
                type="button"
                role="option"
                aria-selected={false}
                // Prevent the input's onBlur from firing before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(d.href)}
                className={cn(
                  "hover:bg-muted flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors"
                )}
              >
                <span className="truncate font-medium">{d.title}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {d.group}
                </span>
              </button>
            ))
          ) : (
            <p className="text-muted-foreground px-3 py-3 text-sm">
              No matches for “{query.trim()}”
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
