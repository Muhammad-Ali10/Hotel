import Link from "next/link"
import { ChevronLeft, Download, Printer } from "lucide-react"

import type { Stat } from "@/lib/extranet/types"
import { invoices, invoiceStats } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatDate } from "@/lib/format"
import {
  ActionButton,
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

import { InvoiceRowActions } from "./_components/invoice-row-actions"

const stats: Stat[] = [
  {
    label: "Outstanding",
    value: formatCurrency(invoiceStats.outstanding),
    caption: `${invoiceStats.outstandingCount} pending`,
  },
  {
    label: "Paid",
    value: formatCurrency(invoiceStats.paid),
    caption: `${invoiceStats.paidCount} paid`,
  },
  {
    label: "Overdue",
    value: formatCurrency(invoiceStats.overdue),
    caption: `${invoiceStats.overdueCount} overdue`,
  },
  {
    label: "Total Volume",
    value: formatCurrency(invoiceStats.totalVolume),
    caption: `${invoiceStats.count} invoices`,
  },
]

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Management"
        subtitle="View, track, and manage commission invoices"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/finance" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <ActionButton
          variant="outline"
          size="sm"
          toastType="info"
          toastMessage="Exporting invoices…"
        >
          <Download className="size-4" />
          Export
        </ActionButton>
        <ActionButton
          size="sm"
          toastType="info"
          toastMessage="Printing all invoices…"
        >
          <Printer className="size-4" />
          Print All
        </ActionButton>
      </PageHeader>

      <StatGrid stats={stats} className="lg:grid-cols-4" />

      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Property</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.id}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(inv.issued)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(inv.due)}
                </TableCell>
                <TableCell>{inv.property}</TableCell>
                <TableCell className="text-muted-foreground text-right">
                  {formatCurrency(inv.subtotal)}
                </TableCell>
                <TableCell className="text-muted-foreground text-right">
                  {formatCurrency(inv.tax)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(inv.total)}
                </TableCell>
                <TableCell>
                  <StatusPill status={inv.status} />
                </TableCell>
                <TableCell className="text-right">
                  <InvoiceRowActions invoice={inv} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
