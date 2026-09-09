"use client"

import * as React from "react"
import Link from "next/link"

import { formatCurrency } from "@/lib/format"
import { addDays, toISODate } from "@/lib/domain"
import { usePerformance } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Every property at a glance, for the last 30 nights.
 *
 * It reads `performance`, which is the same endpoint the Property Performance
 * screen reads — so a number here and a number there cannot drift. The strip
 * used to say "Revenue Today", which was a figure nothing in the product
 * produced: a single day's revenue is almost always zero or an outlier, and
 * neither tells a partner anything about how a property is trading.
 *
 * A dash rather than a zero where the API returns `null`: a role that may not
 * see money gets no number at all (rule #66), and rendering that as $0 tells
 * somebody their hotel earned nothing.
 */
export function PropertyStrip() {
  const { setActive } = useActiveProperty()

  const range = React.useMemo(() => {
    const today = toISODate(new Date())
    return { from: addDays(today, -29), to: today }
  }, [])

  const performance = usePerformance(range)

  if (performance.isPending) {
    return (
      <div
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
        aria-busy="true"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-muted h-32 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (performance.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {performance.error.message}
      </div>
    )
  }

  const rows = performance.data ?? []

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((row) => {
        const occupancy = Math.round(row.occupancy * 100)
        return (
          <Link
            key={row.propertyId}
            href="/extranet/property"
            // Clicking a property makes it the one every other screen acts on.
            onClick={() => setActive(row.propertyId)}
          >
            <Card size="sm" className="hover:bg-muted/40 h-full transition-colors">
              <CardContent className="space-y-3">
                <div>
                  <p className="font-heading truncate text-sm font-medium">
                    {row.property}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {row.roomNights} of {row.roomNightsAvailable} nights sold
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-semibold">{occupancy}%</span>
                    <span className="text-muted-foreground text-xs">occupancy</span>
                  </div>
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-foreground h-full rounded-full"
                      style={{ width: `${occupancy}%` }}
                    />
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Revenue, 30 days{" "}
                  <span className="text-foreground font-medium">
                    {row.revenue === null ? "—" : formatCurrency(row.revenue)}
                  </span>
                </p>
              </CardContent>
            </Card>
          </Link>
        )
      })}

      {rows.length === 0 ? (
        <p className="text-muted-foreground col-span-full py-6 text-center text-sm">
          No properties in this portfolio yet.
        </p>
      ) : null}
    </div>
  )
}
