import type { Stat } from "@/lib/extranet/types"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { DeltaBadge } from "./delta-badge"
import { Icon } from "./icon"

export function StatCard({ stat }: { stat: Stat }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground text-sm">{stat.label}</span>
          {stat.icon ? (
            <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Icon name={stat.icon} className="size-4" />
            </span>
          ) : null}
        </div>
        <p className="font-heading text-2xl font-semibold tracking-tight">
          {stat.value}
        </p>
        {stat.delta || stat.caption ? (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {stat.delta ? (
              <DeltaBadge delta={stat.delta} trend={stat.trend} />
            ) : null}
            {stat.caption ? (
              <span className="text-muted-foreground text-xs">
                {stat.caption}
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function StatGrid({
  stats,
  className,
}: {
  stats: Stat[]
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)}>
      {stats.map((s) => (
        <StatCard key={s.label} stat={s} />
      ))}
    </div>
  )
}
