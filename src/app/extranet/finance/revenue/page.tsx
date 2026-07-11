"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import type { Stat } from "@/lib/extranet/types"
import {
  revenueByPropertyNet,
  revenueMonthly,
  revenueTrackingStats,
  transactions,
} from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import {
  PageHeader,
  SectionCard,
  StatGrid,
  StatusPill,
} from "@/components/extranet/shared"
import { BarChart } from "@/components/extranet/charts"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const stats: Stat[] = [
  {
    label: "Gross Revenue",
    value: formatCurrency(revenueTrackingStats.gross),
    caption: "+18.2% vs LY",
  },
  {
    label: "Commission",
    value: formatCurrency(revenueTrackingStats.commission),
    caption: "Avg 12% rate",
  },
  {
    label: "Net Revenue",
    value: formatCurrency(revenueTrackingStats.net),
    caption: "+16.8% vs LY",
  },
  {
    label: "Transactions",
    value: String(transactions.length),
    caption: `${transactions.filter((t) => t.status === "Pending").length} pending`,
  },
]

const periods = ["6 Months", "Year to Date", "30 Days"] as const
type Period = (typeof periods)[number]

const periodChartLabel: Record<Period, string> = {
  "6 Months": "Last 6 months",
  "Year to Date": "Year to date",
  "30 Days": "Last 30 days",
}

const maxNet = Math.max(...revenueByPropertyNet.map((p) => p.value))

export default function RevenueTrackingPage() {
  const [period, setPeriod] = React.useState<Period>(periods[0])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Tracking"
        subtitle="Monitor earnings across all properties in real-time"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/finance" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {periods.map((p) => (
          <Button
            key={p}
            variant={p === period ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {p}
          </Button>
        ))}
        <span className="text-muted-foreground ml-auto text-sm">
          Showing {periodChartLabel[period]}
        </span>
      </div>

      <StatGrid stats={stats} className="lg:grid-cols-4" />

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          title="Monthly Revenue Breakdown"
          description={periodChartLabel[period]}
          className="lg:col-span-2"
        >
          <BarChart
            data={revenueMonthly}
            showLine
            formatTick={(n) => `$${Math.round(n / 1000)}k`}
            legendPrimary="Net Revenue"
            legendSecondary="Commission"
          />
        </SectionCard>

        <SectionCard title="By Property">
          <ul className="space-y-3.5">
            {revenueByPropertyNet.map((p) => (
              <li key={p.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="truncate">{p.label}</span>
                  <span className="font-medium">{formatCurrency(p.value)}</span>
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-foreground h-full rounded-full"
                    style={{ width: `${(p.value / maxNet) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Transactions" contentClassName="px-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Room Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.id}</TableCell>
                <TableCell className="text-muted-foreground">{t.date}</TableCell>
                <TableCell>{t.guest}</TableCell>
                <TableCell className="text-muted-foreground">
                  {t.property}
                </TableCell>
                <TableCell className="text-muted-foreground">{t.room}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(t.amount)}
                </TableCell>
                <TableCell className="text-muted-foreground text-right">
                  {formatCurrency(t.commission)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(t.net)}
                </TableCell>
                <TableCell>{t.channel}</TableCell>
                <TableCell>
                  <StatusPill status={t.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  )
}
