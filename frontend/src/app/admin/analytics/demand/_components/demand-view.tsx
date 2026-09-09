"use client"

import type { SeriesPoint } from "@/lib/extranet/types"
import { usePlatformDemand } from "@/lib/admin/api/hooks"
import { BarChart } from "@/components/extranet/charts/bar-chart"
import { DateRangeBar, useDateRange } from "@/components/admin/date-range-bar"
import { SectionCard, StatGrid } from "@/components/admin/shared"
import { CardListSkeleton } from "@/components/shared/data-table"
import { EmptyState, ErrorState } from "@/components/shared/states"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * What travellers searched for, across every market (rule #67).
 *
 * The column worth reading is "found nothing". A search that returned no
 * result is demand the marketplace could not serve — somebody wanted those
 * dates in that city and there was nothing open, nothing cheap enough, or
 * nothing that slept that many. For a platform, that is the clearest signal of
 * where to recruit supply.
 *
 * The old screen had a "demand level" of High / Medium / Low. Nothing computes
 * one, and a three-way banding with no stated threshold is a judgement dressed
 * as a measurement. The numbers underneath it are here instead.
 */
export function DemandView() {
  const { range, controls } = useDateRange(30)
  const demand = usePlatformDemand({ ...range, limit: 50 })

  const d = demand.data

  const trend: SeriesPoint[] = (d?.trend ?? []).map((point) => ({
    label: point.period,
    value: point.searches,
    secondary: point.emptyResults,
  }))

  const totals = (d?.destinations ?? []).reduce(
    (acc, row) => ({
      searches: acc.searches + row.searches,
      empty: acc.empty + row.emptyResults,
      travellers: acc.travellers + row.travellers,
    }),
    { searches: 0, empty: 0, travellers: 0 }
  )

  return (
    <div className="space-y-6">
      <DateRangeBar controls={controls} />

      {demand.error ? (
        <ErrorState error={demand.error} onRetry={() => void demand.refetch()} />
      ) : demand.isLoading ? (
        <CardListSkeleton count={2} />
      ) : (
        <>
          <StatGrid
            className="lg:grid-cols-3"
            stats={[
              {
                label: "Searches",
                value: String(totals.searches),
                icon: "Search",
              },
              {
                label: "Found nothing",
                value: String(totals.empty),
                caption:
                  totals.searches === 0
                    ? undefined
                    : `${((totals.empty / totals.searches) * 100).toFixed(0)}% of searches`,
                icon: "AlertTriangle",
              },
              {
                label: "Travellers",
                value: String(totals.travellers),
                caption: "distinct sessions",
                icon: "Users",
              },
            ]}
          />

          <SectionCard
            title="Searches over time"
            description="Bars are searches; the line is searches that found nothing."
          >
            {trend.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Nobody searched in this window.
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

          <SectionCard
            title="By destination"
            description="Where people looked, and where the marketplace had nothing to show them."
            contentClassName="px-0"
          >
            {(d?.destinations.length ?? 0) === 0 ? (
              <EmptyState
                title="No searches recorded"
                description="Destination figures appear once the marketplace has traffic."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="pl-6">
                      Destination
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Searches
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Travellers
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Found nothing
                    </TableHead>
                    <TableHead scope="col" className="pr-6 text-right">
                      Average results
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(d?.destinations ?? []).map((row) => {
                    const share =
                      row.searches === 0 ? 0 : row.emptyResults / row.searches
                    return (
                      <TableRow key={row.destination}>
                        <TableCell className="pl-6 font-medium">
                          {row.destination}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.searches}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.travellers}
                        </TableCell>
                        <TableCell
                          className={
                            /* A market failing more than a third of searches
                               is where supply is missing, not a rounding. */
                            share > 0.33
                              ? "text-destructive text-right tabular-nums"
                              : "text-right tabular-nums"
                          }
                        >
                          {row.emptyResults}
                          {row.searches > 0 ? (
                            <span className="text-muted-foreground">
                              {" "}
                              ({(share * 100).toFixed(0)}%)
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="pr-6 text-right tabular-nums">
                          {row.averageResults.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
