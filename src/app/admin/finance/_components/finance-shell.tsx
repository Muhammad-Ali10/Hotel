"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { useFinanceSummary } from "@/lib/admin/api/hooks"
import { AdminPageHeader, InfoNote, StatGrid } from "@/components/admin/shared"
import { StatGridSkeleton } from "@/components/shared/data-table"
import { ErrorState } from "@/components/shared/states"

const TABS = [
  { label: "Overview", href: "/admin/finance" },
  { label: "Revenue", href: "/admin/finance/revenue" },
  { label: "Commissions", href: "/admin/finance/commissions" },
  { label: "Payouts", href: "/admin/finance/payouts" },
  { label: "Invoices", href: "/admin/finance/invoices" },
]

/**
 * The six stat tiles and tab bar persist across every Finance tab, exactly as
 * in the Figma — but the tabs are real routes so each deep-links and keeps its
 * own table state.
 */
export function FinanceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data, isLoading, error, refetch } = useFinanceSummary()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Finance"
        subtitle="Platform revenue, commissions, payouts, and invoices across all clients"
      />

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <StatGridSkeleton count={6} />
      ) : (
        <StatGrid stats={data.stats} className="lg:grid-cols-3 xl:grid-cols-6" />
      )}

      <nav
        aria-label="Finance sections"
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
        Financial data flows from each property&rsquo;s operations. Clients see
        their own breakdown in the extranet&rsquo;s Finance section. All figures
        are USD.
      </InfoNote>
    </div>
  )
}
