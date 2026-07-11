import Link from "next/link"
import { ChevronLeft, Wallet } from "lucide-react"

import type { Stat } from "@/lib/extranet/types"
import { payouts, payoutStats } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatDate } from "@/lib/format"
import {
  ConfirmDialog,
  PageHeader,
  StatGrid,
  StatusPill,
} from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const stats: Stat[] = [
  { label: "Total Paid", value: formatCurrency(payoutStats.totalPaid) },
  {
    label: "Pending",
    value: formatCurrency(payoutStats.pending),
    caption: `${payoutStats.pendingCount} payouts`,
  },
  {
    label: "Failed",
    value: formatCurrency(payoutStats.failed),
    caption: `${payoutStats.failedCount} failed`,
  },
  {
    label: "Total Volume",
    value: formatCurrency(payoutStats.totalVolume),
    caption: `${payoutStats.count} transactions`,
  },
]

export default function PayoutsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        subtitle="Track payout status and history across all properties"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/finance" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <ConfirmDialog
          trigger={
            <Button size="sm">
              <Wallet className="size-4" />
              Request Payout
            </Button>
          }
          title="Request Payout"
          description={`Request payout of ${formatCurrency(payoutStats.pending)}?`}
          confirmLabel="Request Payout"
          toastMessage="Payout requested"
        />
      </PageHeader>

      <StatGrid stats={stats} className="lg:grid-cols-4" />

      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Payout ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Property</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.id}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(p.date)}
                </TableCell>
                <TableCell>{p.property}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(p.amount)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.method}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.reference}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.invoice}
                </TableCell>
                <TableCell>
                  <StatusPill status={p.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
