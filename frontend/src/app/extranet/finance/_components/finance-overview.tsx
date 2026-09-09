"use client"

import Link from "next/link"

import type { Stat } from "@/lib/extranet/types"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import { useFinanceOverview, useFinanceRevenue } from "@/lib/api/hooks"
import {
  AnalyticsRangeBar,
  delta,
  useAnalyticsRange,
} from "@/components/extranet/analytics-range"
import { SectionCard, StatGrid } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Money, with the three words kept apart (rule #97).
 *
 * **Gross** is what guests paid, **commission** is what the platform keeps,
 * **net** is what reaches the partner. They are three numbers and this screen
 * never uses one where it means another — a single "revenue" figure is how a
 * partner budgets against money that was never theirs.
 *
 * Two more that must not be netted together: `pendingPayouts` is what the
 * platform owes the partner, `outstandingInvoices` is what the partner owes
 * the platform. One combined figure hides which way the money is going.
 *
 * And two rates, because they answer different questions: the rate ON FILE is
 * the agreement; the EFFECTIVE rate is what actually happened in this window.
 * A partner with no bookings reading only the effective one would conclude
 * they keep everything.
 */
export function FinanceOverviewView() {
  const { range, granularity, controls } = useAnalyticsRange(365)
  const overview = useFinanceOverview(range)
  const revenue = useFinanceRevenue({ ...range, granularity })

  const d = overview.data

  const stats: Stat[] = [
    {
      label: "Bookings",
      value: d ? String(d.bookings) : "—",
      delta: delta(d?.bookings ?? null, d?.previous.bookings ?? null),
      caption: "vs the window before",
    },
    {
      label: "Gross",
      value: d ? formatCurrency(d.gross) : "—",
      delta: delta(d?.gross ?? null, d?.previous.gross ?? null),
      caption: "what guests paid",
    },
    {
      label: "Commission",
      value: d ? formatCurrency(d.commission) : "—",
      caption: "what the platform keeps",
    },
    {
      label: "Net",
      value: d ? formatCurrency(d.net) : "—",
      delta: delta(d?.net ?? null, d?.previous.net ?? null),
      caption: "what reaches you",
    },
    {
      label: "Refunded",
      value: d ? formatCurrency(d.refunded) : "—",
      caption: `${d?.cancelled ?? 0} cancelled`,
    },
    {
      label: "Effective rate",
      value: d ? `${(d.effectiveRateBps / 100).toFixed(2)}%` : "—",
      caption:
        d?.commissionRateBps !== undefined
          ? `${(d.commissionRateBps / 100).toFixed(2)}% on file`
          : undefined,
    },
  ]

  return (
    <div className="space-y-6">
      <AnalyticsRangeBar controls={controls} showGranularity />

      {overview.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {overview.error.message}
        </div>
      ) : null}

      <StatGrid stats={stats} className="sm:grid-cols-3 lg:grid-cols-6" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-sm font-semibold">Owed to you</h3>
              <Badge variant="secondary">
                {d?.pendingPayouts.count ?? 0} pending
              </Badge>
            </div>
            <p className="font-heading text-2xl font-semibold">
              {d ? formatCurrency(d.pendingPayouts.amount) : "—"}
            </p>
            <p className="text-muted-foreground text-sm">
              Settlements not yet paid out.
              {d?.payoutsHeld ? " Payouts are currently held." : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/extranet/finance/payouts">See payouts</Link>}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-sm font-semibold">Owed by you</h3>
              <Badge variant="secondary">
                {d?.outstandingInvoices.count ?? 0} unpaid
              </Badge>
            </div>
            <p className="font-heading text-2xl font-semibold">
              {d ? formatCurrency(d.outstandingInvoices.amount) : "—"}
            </p>
            <p className="text-muted-foreground text-sm">
              {/*
               * Never netted against the payouts above.
               *
               * These are two different debts moving in two directions, and a
               * single figure would hide which one is bigger.
               */}
              Commission invoices still to be settled.
              {d?.settlementMode === "deduct"
                ? " Commission is deducted from payouts, so this is usually empty."
                : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/extranet/finance/invoices">See invoices</Link>}
            />
          </CardContent>
        </Card>
      </div>

      <SectionCard
        title="By property"
        description="Gross, commission and net for each property in the window."
      >
        {revenue.isPending ? (
          <div className="bg-muted h-40 animate-pulse rounded-lg" aria-busy="true" />
        ) : (
          <div className="overflow-x-auto">
            <Table className={cellPad}>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(revenue.data?.byProperty ?? []).map((row) => (
                  <TableRow key={row.propertyId}>
                    <TableCell className="font-medium">
                      {row.propertyName}
                      <span className="text-muted-foreground"> · {row.city}</span>
                    </TableCell>
                    <TableCell className="text-right">{row.bookings}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.gross)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.commission)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.net)}
                    </TableCell>
                  </TableRow>
                ))}
                {(revenue.data?.byProperty.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                      Nothing was booked in this window.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
