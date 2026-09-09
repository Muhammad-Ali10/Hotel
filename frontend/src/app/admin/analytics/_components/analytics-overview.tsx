"use client"

import Link from "next/link"

import { formatCurrency } from "@/lib/format"
import { usePlatformClients, usePlatformOverview } from "@/lib/admin/api/hooks"
import {
  DateRangeBar,
  delta,
  useDateRange,
} from "@/components/admin/date-range-bar"
import { SectionCard, StatGrid } from "@/components/admin/shared"
import { CardListSkeleton, DataTableSkeleton } from "@/components/shared/data-table"
import { ErrorState } from "@/components/shared/states"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * What the marketplace traded, for a window (rules #64, #83).
 *
 * **GMV is not revenue**, and this screen never treats it as one. GMV is what
 * guests paid across every property — money that passes through — while the
 * platform's revenue is the commission inside it. Presenting the larger number
 * as "revenue" is the single most common way a marketplace overstates itself.
 *
 * The take rate is `revenue ÷ gmv` for the same window, and it is `null` when
 * nothing traded rather than `0` — a quarter with no bookings has no take
 * rate, and zero would read as "we earned nothing on everything we sold".
 */
export function AnalyticsOverview() {
  const { range, controls } = useDateRange(365)
  const overview = usePlatformOverview(range)
  const clients = usePlatformClients(range)

  const d = overview.data

  return (
    <div className="space-y-6">
      <DateRangeBar controls={controls} />

      {overview.error ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : overview.isLoading || !d ? (
        <CardListSkeleton count={2} />
      ) : (
        <>
          <StatGrid
            className="lg:grid-cols-3 xl:grid-cols-6"
            stats={[
              {
                label: "GMV",
                value: formatCurrency(d.gmv),
                delta: delta(d.gmv, d.previous.gmv),
                caption: "what guests paid",
              },
              {
                label: "Platform revenue",
                value: formatCurrency(d.revenue),
                delta: delta(d.revenue, d.previous.revenue),
                caption: "commission earned",
              },
              {
                label: "Take rate",
                value:
                  d.takeRate === null
                    ? "—"
                    : `${(d.takeRate * 100).toFixed(2)}%`,
                caption: d.takeRate === null ? "nothing traded" : "revenue ÷ GMV",
              },
              {
                label: "Bookings",
                value: String(d.bookings),
                delta: delta(d.bookings, d.previous.bookings),
                caption: `${d.cancelled} cancelled`,
              },
              {
                label: "Clients",
                value: `${d.shape.activeOrgs}`,
                caption: `of ${d.shape.orgs} on the platform`,
              },
              {
                label: "Live listings",
                value: `${d.shape.liveProperties}`,
                caption: `of ${d.shape.properties} properties`,
              },
            ]}
          />

          <SectionCard
            title="By client"
            description="Every organisation that traded inside the window, largest first."
            contentClassName="px-0"
          >
            {clients.isLoading ? (
              <DataTableSkeleton columns={7} rows={5} />
            ) : clients.error ? (
              <ErrorState
                error={clients.error}
                onRetry={() => void clients.refetch()}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="pl-6">
                      Client
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Properties
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Bookings
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      GMV
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Our revenue
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Take rate
                    </TableHead>
                    <TableHead scope="col" className="pr-6 text-right">
                      Share of GMV
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(clients.data ?? []).map((row) => (
                    <TableRow key={row.orgId}>
                      <TableCell className="pl-6">
                        <Link
                          href={`/admin/clients/${row.orgId}`}
                          className="hover:text-primary font-medium underline-offset-2 hover:underline"
                        >
                          {row.orgName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.properties}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.bookings}
                        {row.cancelled > 0 ? (
                          <span className="text-muted-foreground">
                            {" "}
                            ({row.cancelled} cancelled)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.gmv)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.takeRate === null
                          ? "—"
                          : `${(row.takeRate * 100).toFixed(2)}%`}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {(row.share * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {(clients.data?.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No client traded in this window.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
