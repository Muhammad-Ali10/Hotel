"use client"

import * as React from "react"

import { addDays, toISODate } from "@/lib/domain"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * The window a platform report answers for.
 *
 * Every Finance and Analytics screen in the panel used to show figures with no
 * window at all — "year to date" printed above numbers from no particular year
 * — so two screens could disagree about the same quarter and neither said
 * which one it meant.
 *
 * Local to each screen on purpose. Somebody reading last month's commissions
 * and this year's revenue is doing two different jobs, and carrying one
 * screen's window into the next is a good way to misread both.
 *
 * Separate from the extranet's version, which scopes to the partner's active
 * property. The platform has no active property, so half of that control would
 * be dead here.
 */

export type Granularity = "day" | "week" | "month"

const PRESETS: { label: string; days: number }[] = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "12 months", days: 365 },
]

export function useDateRange(defaultDays = 365) {
  const today = React.useMemo(() => toISODate(new Date()), [])
  const [from, setFrom] = React.useState(() => addDays(today, -defaultDays))
  const [to, setTo] = React.useState(today)
  const [granularity, setGranularity] = React.useState<Granularity>(
    defaultDays > 120 ? "month" : defaultDays > 31 ? "week" : "day"
  )

  const range = React.useMemo(() => ({ from, to }), [from, to])

  return {
    range,
    granularity,
    controls: { from, to, setFrom, setTo, granularity, setGranularity, today },
  }
}

export type DateRangeControls = ReturnType<typeof useDateRange>["controls"]

export function DateRangeBar({
  controls,
  showGranularity = false,
}: {
  controls: DateRangeControls
  showGranularity?: boolean
}) {
  const { from, to, setFrom, setTo, granularity, setGranularity, today } = controls

  return (
    <Card className="flex flex-wrap items-end gap-4 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="platform-from" className="text-xs">
          From
        </Label>
        <Input
          id="platform-from"
          type="date"
          className="h-9"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="platform-to" className="text-xs">
          To
        </Label>
        <Input
          id="platform-to"
          type="date"
          className="h-9"
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      <div className="flex gap-1">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            size="xs"
            variant="outline"
            onClick={() => {
              setFrom(addDays(today, -preset.days))
              setTo(today)
              setGranularity(
                preset.days > 120 ? "month" : preset.days > 31 ? "week" : "day"
              )
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {showGranularity ? (
        <div className="space-y-1.5">
          <Label htmlFor="platform-grain" className="text-xs">
            Grouped by
          </Label>
          <select
            id="platform-grain"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
      ) : null}
    </Card>
  )
}

/**
 * A percentage change, or nothing.
 *
 * Zero-to-something is not "+∞%" and not "+100%" — it is a change with no
 * meaningful ratio behind it, so it says so rather than printing a number that
 * looks precise.
 */
export function delta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "0%" : "new"
  const pct = ((current - previous) / previous) * 100
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`
}
