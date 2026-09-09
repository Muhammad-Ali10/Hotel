import Link from "next/link"

import { Icon } from "@/components/extranet/shared"
import { Card, CardContent } from "@/components/ui/card"

/** The four questions money splits into. Each has its own screen. */
export const financeNav = [
  {
    title: "Revenue",
    desc: "Net and gross over time",
    icon: "TrendingUp",
    href: "/extranet/finance/revenue",
  },
  {
    title: "Commissions",
    desc: "What each month actually charged",
    icon: "Percent",
    href: "/extranet/finance/commissions",
  },
  {
    title: "Payouts",
    desc: "Settlements, and where they go",
    icon: "Wallet",
    href: "/extranet/finance/payouts",
  },
  {
    title: "Invoices",
    desc: "Commission billed rather than deducted",
    icon: "Receipt",
    href: "/extranet/finance/invoices",
  },
]

export function FinanceNav() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {financeNav.map((s) => (
        <Link key={s.title} href={s.href}>
          <Card size="sm" className="hover:bg-muted/40 h-full transition-colors">
            <CardContent className="flex items-center gap-3">
              <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon name={s.icon} className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-muted-foreground truncate text-xs">{s.desc}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
