import type { Trend } from "@/lib/extranet/types"
import { cn } from "@/lib/utils"
import { Icon } from "./icon"

/** Coloured up/down delta indicator, e.g. "▲ +14.3%". */
export function DeltaBadge({
  delta,
  trend,
  className,
}: {
  delta: string
  trend?: Trend
  className?: string
}) {
  const tone =
    trend === "down"
      ? "text-destructive"
      : trend === "flat"
        ? "text-muted-foreground"
        : "text-emerald-600 dark:text-emerald-400"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        tone,
        className
      )}
    >
      {trend !== "flat" ? (
        <Icon
          name={trend === "down" ? "TrendingDown" : "TrendingUp"}
          className="size-3.5"
        />
      ) : null}
      {delta}
    </span>
  )
}
