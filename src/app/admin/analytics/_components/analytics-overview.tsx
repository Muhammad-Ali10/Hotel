"use client"

import Link from "next/link"

import { clientName } from "@/data/admin"
import { useAnalyticsSummary } from "@/lib/admin/api/hooks"
import { BarChart } from "@/components/extranet/charts"
import { DeltaBadge } from "@/components/extranet/shared"
import { Money, SectionCard, StarRating } from "@/components/admin/shared"
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

export function AnalyticsOverview() {
  const { data, isLoading, error, refetch } = useAnalyticsSummary()

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (isLoading || !data) return <CardListSkeleton count={2} />

  return (
    <div className="space-y-4">
      <SectionCard
        title="Monthly revenue & bookings trend"
        description="Platform-wide, current year to date"
      >
        <BarChart
          data={data.series.map((point) => ({
            label: point.label,
            value: point.revenue,
            secondary: point.bookings,
          }))}
          showLine
          legendPrimary="Revenue"
          legendSecondary="Bookings"
          formatTick={(n) => `$${(n / 1_000_000).toFixed(1)}M`}
        />
      </SectionCard>

      <SectionCard
        title="Client performance comparison"
        description="Every tenant, ranked by revenue"
        contentClassName="px-0"
      >
        {data.rows.length === 0 ? (
          <EmptyState
            title="No client data yet"
            description="Comparison figures appear once tenants start taking bookings."
          />
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pl-6">Client</TableHead>
              <TableHead scope="col" className="text-right">Properties</TableHead>
              <TableHead scope="col" className="text-right">Revenue</TableHead>
              <TableHead scope="col" className="text-right">Bookings</TableHead>
              <TableHead scope="col" className="text-right">Occupancy</TableHead>
              <TableHead scope="col" className="text-right">ADR</TableHead>
              <TableHead scope="col">Review score</TableHead>
              <TableHead scope="col" className="pr-6 text-right">Growth</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...data.rows]
              .sort((a, b) => b.revenue - a.revenue)
              .map((row) => (
                <TableRow key={row.clientId}>
                  <TableCell className="pl-6">
                    <Link
                      href={`/admin/clients/${row.clientId}`}
                      className="hover:text-primary font-medium underline-offset-2 hover:underline"
                    >
                      {clientName(row.clientId)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.properties}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.revenue} compact />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.bookings.toLocaleString("en-US")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.occupancy}%
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.adr} />
                  </TableCell>
                  <TableCell>
                    <StarRating value={row.reviewScore / 2} showValue={false} />
                    <span className="text-muted-foreground ml-1 text-xs tabular-nums">
                      {row.reviewScore.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <DeltaBadge
                      delta={`${row.growth > 0 ? "+" : ""}${row.growth.toFixed(1)}%`}
                      trend={row.growth >= 0 ? "up" : "down"}
                      className="justify-end"
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        )}
      </SectionCard>
    </div>
  )
}
