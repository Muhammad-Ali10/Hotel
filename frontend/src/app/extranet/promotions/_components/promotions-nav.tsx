import Link from "next/link"

import { Icon } from "@/components/extranet/shared"
import { Card, CardContent } from "@/components/ui/card"

export const promotionsNav = [
  { title: "Choose Promotion", desc: "Apply a new promotion", icon: "Tag", href: "/extranet/promotions/choose" },
  { title: "Simulate Discount", desc: "Test discount profitability", icon: "Percent", href: "/extranet/promotions/simulate" },
]

export function PromotionsNav() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {promotionsNav.map((s) => (
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
