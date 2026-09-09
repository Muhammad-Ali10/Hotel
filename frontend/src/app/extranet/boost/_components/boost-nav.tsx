import Link from "next/link"

import { Icon } from "@/components/extranet/shared"
import { Card, CardContent } from "@/components/ui/card"

/**
 * The three levers that actually exist.
 *
 * "Preferred Partner" was a fourth: a badge with invented qualifying criteria
 * and a Join button that toasted. Nothing in the product awards it, and
 * nothing in search reads it — so a property that "joined" would have got
 * exactly the visibility it had before.
 *
 * The promise underneath it was real, though. What moves a listing up the
 * results is the ranking (rule #104), and that is computed, published, and
 * broken down factor by factor. So the tile points there instead of at a
 * programme nobody runs.
 */
export const boostNav = [
  {
    title: "Genius Discounts",
    desc: "A deal only Genius members see",
    icon: "BadgeCheck",
    href: "/extranet/boost/genius",
  },
  {
    title: "Long Stays",
    desc: "A deal from N nights up",
    icon: "Calendar",
    href: "/extranet/boost/long-stays",
  },
  {
    title: "Your ranking",
    desc: "Where you sit in search, and why",
    icon: "Star",
    href: "/extranet/analytics/ranking",
  },
]

export function BoostNav() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {boostNav.map((s) => (
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
