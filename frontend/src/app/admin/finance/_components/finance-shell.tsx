"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { AdminPageHeader, InfoNote } from "@/components/admin/shared"

const TABS = [
  { label: "Overview", href: "/admin/finance" },
  { label: "Revenue", href: "/admin/finance/revenue" },
  { label: "Commissions", href: "/admin/finance/commissions" },
  { label: "Payouts", href: "/admin/finance/payouts" },
  { label: "Invoices", href: "/admin/finance/invoices" },
]

/**
 * The tab bar, and nothing else.
 *
 * Six stat tiles used to live here too, shared across every tab. They cannot
 * be: each tab answers for a WINDOW that its own screen chooses, so a shared
 * strip of numbers would either describe one tab's window while another was
 * open, or describe no window at all — which is what it did.
 */
export function FinanceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Finance"
        subtitle="Revenue, commission, payouts and invoices across every client"
      />

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
        Gross is what guests paid, commission is what the platform kept, net is
        what reached the property. They are three numbers and none of these
        screens uses one where it means another. All figures are USD.
      </InfoNote>
    </div>
  )
}
