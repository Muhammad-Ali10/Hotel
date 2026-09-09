"use client"

import * as React from "react"

import type { AnalyticsRange } from "@/lib/api/endpoints"
import { addDays, toISODate } from "@/lib/domain"
import { useActiveProperty } from "@/components/extranet/active-property"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * The window every analytics screen answers for.
 *
 * Each of these screens used to render a fixed block of numbers with no window
 * at all — "Last 6 months" printed above data that was not from any six months
 * — so two screens could disagree about the same quarter and neither said
 * which one it meant.
 *
 * The range is local to each screen on purpose. A partner reading last month's
 * cancellations and this year's pace is doing two different jobs, and carrying
 * one screen's window into the next is a good way to misread both.
 */

export type Granularity = "day" | "week" | "month"

const PRESETS: { label: string; days: number }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "12 months", days: 365 },
]

export function useAnalyticsRange(defaultDays = 30) {
  const today = React.useMemo(() => toISODate(new Date()), [])
  const [from, setFrom] = React.useState(() => addDays(today, -defaultDays))
  const [to, setTo] = React.useState(today)
  const [granularity, setGranularity] = React.useState<Granularity>(
    defaultDays > 120 ? "month" : defaultDays > 31 ? "week" : "day"
  )

  /*
   * Scoped to the active property, or to the whole portfolio.
   *
   * `propertyId` is left OUT rather than sent empty when the partner is
   * looking at everything — the API reads an absent one as "every property I
   * may see", and an empty string is a uuid it will refuse.
   */
  const { active } = useActiveProperty()
  const [wholePortfolio, setWholePortfolio] = React.useState(false)

  const range: AnalyticsRange = React.useMemo(
    () => ({
      from,
      to,
      ...(wholePortfolio || !active ? {} : { propertyId: active.id }),
    }),
    [from, to, wholePortfolio, active]
  )

  return {
    range,
    granularity,
    controls: {
      from,
      to,
      setFrom,
      setTo,
      granularity,
      setGranularity,
      wholePortfolio,
      setWholePortfolio,
      today,
      activeName: active?.name ?? null,
    },
  }
}

export type RangeControls = ReturnType<typeof useAnalyticsRange>["controls"]

export function AnalyticsRangeBar({
  controls,
  showGranularity = false,
}: {
  controls: RangeControls
  showGranularity?: boolean
}) {
  const {
    from,
    to,
    setFrom,
    setTo,
    granularity,
    setGranularity,
    wholePortfolio,
    setWholePortfolio,
    today,
    activeName,
  } = controls

  return (
    <Card className="flex flex-wrap items-end gap-4 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="range-from" className="text-xs">
          From
        </Label>
        <Input
          id="range-from"
          type="date"
          className="h-9"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="range-to" className="text-xs">
          To
        </Label>
        <Input
          id="range-to"
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
          <Label htmlFor="range-grain" className="text-xs">
            Grouped by
          </Label>
          <select
            id="range-grain"
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

      <div className="ml-auto flex gap-1">
        <Button
          size="xs"
          variant={wholePortfolio ? "outline" : "default"}
          disabled={!activeName}
          onClick={() => setWholePortfolio(false)}
        >
          {activeName ?? "This property"}
        </Button>
        <Button
          size="xs"
          variant={wholePortfolio ? "default" : "outline"}
          onClick={() => setWholePortfolio(true)}
        >
          Whole portfolio
        </Button>
      </div>
    </Card>
  )
}

/** One place decides what a missing number looks like (rule #66). */
export function money(cents: number | null, formatter: (n: number) => string) {
  return cents === null ? "—" : formatter(cents / 100)
}

/**
 * A percentage change, or nothing.
 *
 * Zero-to-something is not "+∞%" and not "+100%" — it is a change with no
 * meaningful ratio behind it, so it says so rather than printing a number that
 * looks precise.
 */
export function delta(current: number | null, previous: number | null) {
  if (current === null || previous === null) return undefined
  if (previous === 0) return current === 0 ? "0%" : "new"
  const pct = ((current - previous) / previous) * 100
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`
}
