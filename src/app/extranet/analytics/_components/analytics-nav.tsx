import Link from "next/link"

import { Icon } from "@/components/extranet/shared"
import { Card, CardContent } from "@/components/ui/card"

export const analyticsNav = [
  { title: "Sales Statistics", desc: "Revenue & sales metrics", icon: "DollarSign", href: "/extranet/analytics/sales" },
  { title: "Pace of Bookings", desc: "Booking velocity vs LY", icon: "TrendingUp", href: "/extranet/analytics/pace" },
  { title: "Demand for City", desc: "Market search demand", icon: "Globe", href: "/extranet/analytics/demand" },
  { title: "Booker Insights", desc: "Who is booking & why", icon: "Users", href: "/extranet/analytics/bookers" },
  { title: "Book Window", desc: "How far in advance", icon: "CalendarRange", href: "/extranet/analytics/book-window" },
  { title: "Cancellations", desc: "Why guests cancel", icon: "CalendarClock", href: "/extranet/analytics/cancellations" },
  { title: "Comparable Properties", desc: "Benchmark vs market", icon: "Building2", href: "/extranet/analytics/comparables" },
  { title: "Genius Report", desc: "Loyalty program impact", icon: "BadgeCheck", href: "/extranet/analytics/genius" },
  { title: "Ranking", desc: "Rank within each market", icon: "Activity", href: "/extranet/analytics/ranking" },
  { title: "Performance", desc: "Per-property breakdown", icon: "BarChart3", href: "/extranet/analytics/performance" },
]

export function AnalyticsNav() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {analyticsNav.map((s) => (
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
