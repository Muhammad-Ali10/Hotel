import type { SourceSlice } from "@/lib/extranet/types"
import { cn } from "@/lib/utils"

/** Monochrome shades for slices, darkest first (highest source = darkest). */
const sliceStroke = [
  "stroke-foreground",
  "stroke-foreground/70",
  "stroke-foreground/50",
  "stroke-foreground/30",
  "stroke-foreground/15",
]
const sliceSwatch = [
  "bg-foreground",
  "bg-foreground/70",
  "bg-foreground/50",
  "bg-foreground/30",
  "bg-foreground/15",
]

/**
 * Dependency-free SVG donut with a legend. `data` values are read as relative
 * weights (they need not sum to 100). The center shows the largest slice.
 */
export function DonutChart({
  data,
  centerLabel,
  className,
}: {
  data: SourceSlice[]
  centerLabel?: string
  className?: string
}) {
  const total = data.reduce((sum, s) => sum + s.value, 0) || 1
  const rMid = 75
  const C = 2 * Math.PI * rMid

  const top = data.reduce((a, b) => (b.value > a.value ? b : a), data[0])
  const topPct = Math.round((top.value / total) * 100)

  const arcs = data.map((s, i) => {
    const frac = s.value / total
    const startFrac =
      data.slice(0, i).reduce((sum, d) => sum + d.value, 0) / total
    const len = frac * C
    const dashoffset = -startFrac * C
    return (
      <circle
        key={s.label}
        cx={120}
        cy={120}
        r={rMid}
        fill="none"
        strokeWidth={30}
        className={sliceStroke[i % sliceStroke.length]}
        strokeDasharray={`${len} ${C - len}`}
        strokeDashoffset={dashoffset}
      />
    )
  })

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-6 sm:flex-row sm:gap-8",
        className
      )}
    >
      <div className="relative shrink-0">
        <svg
          viewBox="0 0 240 240"
          className="size-44"
          role="img"
          aria-label="Donut chart"
        >
          <g transform="rotate(-90 120 120)">{arcs}</g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-semibold">{topPct}%</span>
          <span className="text-muted-foreground text-xs">
            {centerLabel ?? top.label}
          </span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {data.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-[3px]",
                sliceSwatch[i % sliceSwatch.length]
              )}
            />
            <span className="flex-1">{s.label}</span>
            <span className="text-muted-foreground font-medium">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
