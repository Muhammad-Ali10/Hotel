"use client"

import Link from "next/link"

import { clientName, propertyById, propertyName } from "@/data/admin"
import { useFinanceSummary } from "@/lib/admin/api/hooks"
import { Money, SectionCard } from "@/components/admin/shared"
import { DataTableSkeleton } from "@/components/shared/data-table"
import { ErrorState } from "@/components/shared/states"
import { DeltaBadge } from "@/components/extranet/shared"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** Year-to-date performance for every revenue-generating property. */
export function FinanceOverview() {
  const { data, isLoading, error, refetch } = useFinanceSummary()

  if (error) {
    return <ErrorState error={error} onRetry={() => void refetch()} />
  }

  if (isLoading || !data) {
    return (
      <SectionCard title="Revenue by property" contentClassName="px-0">
        <DataTableSkeleton columns={8} rows={6} />
      </SectionCard>
    )
  }

  const totals = data.revenue.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenueYtd,
      bookings: acc.bookings + row.bookings,
      growth: acc.growth + row.growth,
    }),
    { revenue: 0, bookings: 0, growth: 0 }
  )

  return (
    <SectionCard
      title="Revenue by property"
      description={`Year-to-date performance across ${data.revenue.length} revenue-generating properties`}
      contentClassName="px-0"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="pl-6">Property</TableHead>
            <TableHead scope="col">Client</TableHead>
            <TableHead scope="col" className="text-right">Revenue YTD</TableHead>
            <TableHead scope="col" className="text-right">Bookings</TableHead>
            <TableHead scope="col" className="text-right">ADR</TableHead>
            <TableHead scope="col" className="text-right">RevPAR</TableHead>
            <TableHead scope="col" className="text-right">Occ.</TableHead>
            <TableHead scope="col" className="pr-6 text-right">Growth</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.revenue.map((row) => {
            const property = propertyById(row.propertyId)
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
                <TableCell className="text-right tabular-nums">
                  {row.bookings.toLocaleString("en-US")}
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.adr} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.revpar} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.occupancy}%
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <DeltaBadge
                    delta={`${row.growth > 0 ? "+" : ""}${row.growth.toFixed(1)}%`}
                    trend={row.growth >= 0 ? "up" : "down"}
                    className="justify-end"
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="pl-6 font-medium">Totals</TableCell>
            <TableCell />
            <TableCell className="text-right font-medium">
              <Money value={totals.revenue} compact />
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {totals.bookings.toLocaleString("en-US")}
            </TableCell>
            <TableCell colSpan={3} />
            <TableCell className="pr-6 text-right font-medium">
              Avg {(totals.growth / data.revenue.length).toFixed(1)}%
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </SectionCard>
  )
}
