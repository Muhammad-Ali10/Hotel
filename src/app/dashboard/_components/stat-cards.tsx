import {
  CalendarCheck,
  Heart,
  Plane,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

import { dashboardStats } from "@/data"
import { Card, CardContent } from "@/components/ui/card"

const statIcons: Record<string, LucideIcon> = {
  Plane,
  CalendarCheck,
  Heart,
  Sparkles,
}

export function StatCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {dashboardStats.map((stat) => {
        const Icon = statIcons[stat.icon] ?? Sparkles
        return (
          <Card key={stat.label}>
            <CardContent className="space-y-4">
              <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-heading text-3xl font-semibold tracking-tight">
                  {stat.value}
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {stat.label}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
