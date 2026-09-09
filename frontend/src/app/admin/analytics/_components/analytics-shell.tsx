"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { AdminPageHeader, InfoNote } from "@/components/admin/shared"

const TABS = [
  { label: "Overview", href: "/admin/analytics" },
  { label: "Demand", href: "/admin/analytics/demand" },
]

/**
 * The tab bar, and nothing else.
 *
 * Six stat tiles used to live here, shared across both tabs. They cannot be:
 * each tab answers for a WINDOW its own screen chooses, so a shared strip
 * would describe one tab's window while the other was open — or, as it did,
 * describe no window at all.
 */
export function AnalyticsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Analytics"
        subtitle="What the marketplace traded, and what people searched for"
      />

      <nav
        aria-label="Analytics sections"
        className="bg-muted flex flex-wrap gap-1 rounded-lg p-1"
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

      {children}

      <InfoNote>
        GMV is what guests paid across the marketplace — passed through, not
        earned. The platform&rsquo;s own revenue is the commission inside it.
      </InfoNote>
    </div>
  )
}
