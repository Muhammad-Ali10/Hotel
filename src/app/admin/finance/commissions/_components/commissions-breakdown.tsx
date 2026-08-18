"use client"

import Link from "next/link"

import { COMMISSION_RATE, clientName, propertyById, propertyName } from "@/data/admin"
import { useFinanceSummary } from "@/lib/admin/api/hooks"
import { Money, SectionCard } from "@/components/admin/shared"
import { DataTableSkeleton } from "@/components/shared/data-table"
import { ErrorState } from "@/components/shared/states"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function CommissionsBreakdown() {
  const { data, isLoading, error, refetch } = useFinanceSummary()

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />

  if (isLoading || !data) {
    return (
      <SectionCard title="Commission breakdown" contentClassName="px-0">
        <DataTableSkeleton columns={6} rows={6} />
      </SectionCard>
    )
  }

  const totals = data.commissions.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenueYtd,
      commission: acc.commission + row.commissionYtd,
      next: acc.next + row.nextPayoutEst,
    }),
    { revenue: 0, commission: 0, next: 0 }
  )

  return (
    <SectionCard
      title="Commission breakdown"
      description={`${COMMISSION_RATE * 100}% standard platform commission across all properties`}
      contentClassName="px-0"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="pl-6">Property</TableHead>
            <TableHead scope="col">Client</TableHead>
            <TableHead scope="col" className="text-right">Revenue YTD</TableHead>
            <TableHead scope="col" className="text-right">Rate</TableHead>
            <TableHead scope="col" className="text-right">Commission YTD</TableHead>
            <TableHead scope="col" className="pr-6 text-right">
              Next payout est.
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.commissions.map((row) => {
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
                  {(row.rate * 100).toFixed(0)}%
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.commissionYtd} compact />
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <Money value={row.nextPayoutEst} compact />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="pl-6 font-medium">Total</TableCell>
            <TableCell />
            <TableCell className="text-right font-medium">
              <Money value={totals.revenue} compact />
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {COMMISSION_RATE * 100}%
            </TableCell>
            <TableCell className="text-right font-medium">
              <Money value={totals.commission} compact />
            </TableCell>
            <TableCell className="pr-6 text-right font-medium">
              <Money value={totals.next} compact />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </SectionCard>
  )
}
