"use client"

import Link from "next/link"

import { clientName, propertyById, propertyName } from "@/data/admin"
import { useFinanceSummary } from "@/lib/admin/api/hooks"
import { Money, SectionCard, StatGrid } from "@/components/admin/shared"
import { DataTableSkeleton } from "@/components/shared/data-table"
import { ErrorState } from "@/components/shared/states"
import { DeltaBadge } from "@/components/extranet/shared"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function RevenueBreakdown() {
  const { data, isLoading, error, refetch } = useFinanceSummary()

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />

  if (isLoading || !data) {
    return (
      <SectionCard title="Revenue breakdown" contentClassName="px-0">
        <DataTableSkeleton columns={6} rows={6} />
      </SectionCard>
    )
  }

  const total = data.revenue.reduce((sum, r) => sum + r.revenueYtd, 0)
  const prev = data.revenue.reduce((sum, r) => sum + r.prevYear, 0)
  const growth = ((total - prev) / prev) * 100

  return (
    <div className="space-y-4">
      <StatGrid
        className="lg:grid-cols-3"
        stats={[
          {
            label: "Total Platform Revenue YTD",
            value: `$${(total / 1_000_000).toFixed(2)}M`,
            icon: "DollarSign",
          },
          {
            label: "Avg Revenue Per Property",
            value: `$${(total / data.revenue.length / 1_000_000).toFixed(2)}M`,
            icon: "Hotel",
          },
          {
            label: "Year-over-Year Growth",
            value: `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`,
            trend: growth >= 0 ? "up" : "down",
            icon: "TrendingUp",
          },
        ]}
      />

      <SectionCard
        title="Revenue breakdown by property"
        description="Current year against the same period last year"
        contentClassName="px-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pl-6">Property</TableHead>
              <TableHead scope="col">Client</TableHead>
              <TableHead scope="col" className="text-right">Revenue YTD</TableHead>
              <TableHead scope="col" className="text-right">Prev year</TableHead>
              <TableHead scope="col" className="text-right">Growth</TableHead>
              <TableHead scope="col" className="pr-6">Revenue share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.revenue.map((row) => {
              const property = propertyById(row.propertyId)
              const share = (row.revenueYtd / total) * 100
              return (
                <TableRow key={row.propertyId}>
                  <TableCell className="pl-6">
                    <Link
                      href={`/admin/properties/${row.propertyId}`}
                      className="hover:text-primary font-medium underline-offset-2 hover:underline"
                    >
                      {propertyName(row.propertyId)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {property ? clientName(property.clientId) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.revenueYtd} compact />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    <Money value={row.prevYear} compact />
                  </TableCell>
                  <TableCell className="text-right">
                    <DeltaBadge
                      delta={`${row.growth > 0 ? "+" : ""}${row.growth.toFixed(1)}%`}
                      trend={row.growth >= 0 ? "up" : "down"}
                      className="justify-end"
                    />
                  </TableCell>
                  <TableCell className="w-48 pr-6">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={share}
                        aria-label={`${propertyName(row.propertyId)} revenue share`}
                        className="flex-1"
                      />
                      <span className="text-muted-foreground w-11 text-right text-xs tabular-nums">
                        {share.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  )
}
