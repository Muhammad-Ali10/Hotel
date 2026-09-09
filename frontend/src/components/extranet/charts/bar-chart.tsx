import type { SeriesPoint } from "@/lib/extranet/types"
import { cn } from "@/lib/utils"

/**
 * Dependency-free SVG bar chart. Optionally overlays the `secondary` value of
 * each point as a line (e.g. Revenue bars + Bookings line). Monochrome — uses
 * theme tokens so it flips with light/dark mode.
 */
export function BarChart({
  data,
  maxValue,
  showLine = false,
  showValueLabels = false,
  valueSuffix = "",
  formatTick,
  legendPrimary,
  legendSecondary,
  className,
}: {
  data: SeriesPoint[]
  maxValue?: number
  showLine?: boolean
  showValueLabels?: boolean
  valueSuffix?: string
  formatTick?: (n: number) => string
  legendPrimary?: string
  legendSecondary?: string
  className?: string
}) {
  const W = 720
  const H = 260
  const PL = formatTick ? 52 : 16
  const PR = 16
  const PT = 18
  const PB = 28
  const plotW = W - PL - PR
  const plotH = H - PT - PB
  const n = data.length
  const slot = plotW / n
  const barW = Math.min(slot * 0.52, 46)

  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1)
  const secMax = Math.max(...data.map((d) => d.secondary ?? 0), 1)

  const yOf = (v: number) => PT + plotH * (1 - v / max)
  const slotMid = (i: number) => PL + slot * i + slot / 2
  const fractions = [0, 1 / 3, 2 / 3, 1]

  const linePoints = data
    .map((d, i) => `${slotMid(i)},${PT + plotH * (1 - (d.secondary ?? 0) / secMax)}`)
    .join(" ")

  return (
    <div className={cn("space-y-3", className)}>
      {(legendPrimary || legendSecondary) && (
        <div className="text-muted-foreground flex items-center gap-4 text-xs">
          {legendPrimary ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="bg-foreground/70 size-2.5 rounded-[3px]" />
              {legendPrimary}
            </span>
          ) : null}
          {legendSecondary ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="bg-foreground h-0.5 w-4 rounded-full" />
              {legendSecondary}
            </span>
          ) : null}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Bar chart"
      >
        {/* gridlines + y labels */}
        {fractions.map((f) => {
          const y = PT + plotH * (1 - f)
          return (
            <g key={f}>
              <line
                x1={PL}
                x2={W - PR}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
              />
              {formatTick ? (
                <text
                  x={PL - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {formatTick(max * f)}
                </text>
              ) : null}
            </g>
          )
        })}

        {/* bars */}
        {data.map((d, i) => {
          const h = plotH * (d.value / max)
          const x = PL + slot * i + (slot - barW) / 2
          const y = yOf(d.value)
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 1)}
                rx={4}
                className="fill-foreground/70"
              />
              {showValueLabels ? (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-foreground text-[10px] font-medium"
                >
                  {d.value}
                  {valueSuffix}
                </text>
              ) : null}
            </g>
          )
        })}

        {/* secondary line */}
        {showLine ? (
          <>
            <polyline
              points={linePoints}
              fill="none"
              className="stroke-foreground"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {data.map((d, i) => (
              <circle
                key={d.label}
                cx={slotMid(i)}
                cy={PT + plotH * (1 - (d.secondary ?? 0) / secMax)}
                r={3}
                className="fill-background stroke-foreground"
                strokeWidth={2}
              />
            ))}
          </>
        ) : null}

        {/* x labels */}
        {data.map((d, i) => (
          <text
            key={d.label}
            x={slotMid(i)}
            y={H - 8}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  )
}
