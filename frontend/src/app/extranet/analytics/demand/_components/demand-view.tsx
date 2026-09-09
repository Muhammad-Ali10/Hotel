"use client"

import Link from "next/link"

import type { SeriesPoint } from "@/lib/extranet/types"
import { cellPad } from "@/lib/extranet/constants"
import { useDemand } from "@/lib/api/hooks"
import { BarChart } from "@/components/extranet/charts/bar-chart"
import {
  AnalyticsRangeBar,
  useAnalyticsRange,
} from "@/components/extranet/analytics-range"
import { PageHeader, SectionCard } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChevronLeft } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * What travellers searched for in the cities this partner sells in (rule #67).
 *
 * The column worth reading is "found nothing". A search that returned no
 * result is demand the marketplace could not serve — somebody wanted those
 * dates in this city and nothing was open, or nothing was cheap enough, or
 * nothing slept that many. Every one of those is a night this property could
 * have sold and did not, and it is the only number here a partner can act on
 * the same afternoon.
 *
 * The cities are the partner's own. This is not a market-wide feed: a property
 * in Paris sees Paris, and nothing about anybody else's city.
 */
export function DemandView() {
  const { range, controls } = useAnalyticsRange(30)
  const demand = useDemand(range)

  const d = demand.data
  const trend: SeriesPoint[] = (d?.trend ?? []).map((point) => ({
    label: point.period,
    value: point.searches,
    secondary: point.emptyResults,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demand"
        subtitle="What travellers searched for in your cities — and what they did not find"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/analytics" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <AnalyticsRangeBar controls={controls} />

      {demand.isPending ? (
        <div className="bg-muted h-72 animate-pulse rounded-xl" aria-busy="true" />
      ) : demand.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {demand.error.message}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">Your cities:</span>
            {(d?.cities ?? []).map((city) => (
              <Badge key={city} variant="secondary">
                {city}
              </Badge>
            ))}
            {(d?.cities.length ?? 0) === 0 ? (
              <span className="text-muted-foreground text-sm">
                None — a property has to be live before its city is tracked.
              </span>
            ) : null}
          </div>

          <SectionCard
            title="Searches over time"
            description="Bars are searches, the line is searches that found nothing."
          >
            {trend.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Nobody searched your cities in this window.
              </p>
            ) : (
              <BarChart
                data={trend}
                showLine
                legendPrimary="Searches"
                legendSecondary="Found nothing"
              />
            )}
          </SectionCard>

          <div className="space-y-3">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              By destination
            </h2>
            <Card className="py-0">
              <div className="overflow-x-auto">
                <Table className={cellPad}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Destination</TableHead>
                      <TableHead className="text-right">Searches</TableHead>
                      <TableHead className="text-right">Travellers</TableHead>
                      <TableHead className="text-right">Found nothing</TableHead>
                      <TableHead className="text-right">Average results</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(d?.destinations ?? []).map((row) => {
                      const emptyShare =
                        row.searches === 0 ? 0 : row.emptyResults / row.searches
                      return (
                        <TableRow key={row.destination}>
                          <TableCell className="font-medium">{row.destination}</TableCell>
                          <TableCell className="text-right">{row.searches}</TableCell>
                          <TableCell className="text-right">{row.travellers}</TableCell>
                          <TableCell className="text-right">
                            {row.emptyResults}
                            {emptyShare > 0 ? (
                              <span className="text-muted-foreground">
                                {" "}
                                ({(emptyShare * 100).toFixed(0)}%)
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.averageResults.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {(d?.destinations.length ?? 0) === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-muted-foreground py-8 text-center"
                        >
                          No searches recorded in this window.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </Card>
            <p className="text-muted-foreground text-sm">
              A search that found nothing is demand nobody served. If your city shows
              many of them, the usual causes are closed dates and a minimum stay set
              wider than people are asking for.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
