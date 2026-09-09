"use client"

import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatDate } from "@/lib/format"
import { toISODate } from "@/lib/domain"
import { useInvoices } from "@/lib/api/hooks"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS_TONE: Record<string, string> = {
  paid: "bg-primary text-primary-foreground",
  issued: "bg-muted text-muted-foreground",
  overdue: "bg-destructive/10 text-destructive",
  void: "bg-muted text-muted-foreground",
}

/**
 * Commission invoiced rather than deducted (rules #91–#93).
 *
 * This screen only has anything on it for a partner settling by invoice; when
 * commission comes off the payout instead, there is nothing to bill and the
 * list is legitimately empty. Saying that in words beats an empty table that
 * reads like a bug.
 *
 * There is no "Pay" button and no "Mark paid". Money arrives by bank transfer
 * and somebody at the platform reconciles it — a partner marking their own
 * invoice paid would release payouts against money that has not moved.
 */
export function InvoicesView() {
  const invoices = useInvoices()
  const today = toISODate(new Date())

  const list = invoices.data ?? []
  const outstanding = list
    .filter((i) => i.status !== "paid" && i.status !== "void")
    .reduce((sum, i) => sum + i.amount, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-1">
          <p className="text-muted-foreground text-sm">Outstanding</p>
          <p className="font-heading text-2xl font-semibold">
            {formatCurrency(outstanding)}
          </p>
          <p className="text-muted-foreground text-sm">
            Payouts are held while anything here is unpaid — clearing one of three
            does not release them.
          </p>
        </CardContent>
      </Card>

      {invoices.isPending ? (
        <div className="bg-muted h-64 animate-pulse rounded-xl" aria-busy="true" />
      ) : invoices.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {invoices.error.message}
        </div>
      ) : (
        <Card className="py-0">
          <div className="overflow-x-auto">
            <Table className={cellPad}>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Commission due</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((invoice) => {
                  // The API's own status is authoritative; this only adds emphasis.
                  const late =
                    invoice.status !== "paid" &&
                    invoice.status !== "void" &&
                    invoice.dueDate < today
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.ref}</TableCell>
                      <TableCell>
                        {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                      </TableCell>
                      <TableCell className="text-right">{invoice.bookingCount}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(invoice.grossAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.amount)}
                      </TableCell>
                      <TableCell className={late ? "text-destructive" : undefined}>
                        {formatDate(invoice.dueDate)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={STATUS_TONE[invoice.status] ?? ""}>
                            {late && invoice.status === "issued" ? "overdue" : invoice.status}
                          </Badge>
                          {invoice.paidAt ? (
                            <p className="text-muted-foreground text-xs">
                              paid {formatDate(invoice.paidAt)}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                      No invoices. Commission is being deducted from your payouts
                      instead, so there is nothing to bill.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
