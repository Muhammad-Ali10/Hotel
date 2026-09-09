"use client"

import * as React from "react"
import Link from "next/link"

import { formatCurrency, formatDate } from "@/lib/format"
import { toISODate } from "@/lib/domain"
import type { AdminInvoice } from "@/lib/admin/api/endpoints"
import { useInvoices } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import { CellStack, InfoNote, StatGrid, StatusPill } from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { GenerateInvoiceDialog } from "./generate-invoice-dialog"
import { MarkPaidDialog } from "./mark-paid-dialog"

const STATUSES = [
  { label: "Issued", value: "issued" },
  { label: "Paid", value: "paid" },
  { label: "Void", value: "void" },
]

/**
 * Commission invoiced rather than deducted (rules #91–#93).
 *
 * Only organisations on `invoice` settlement appear here; where commission
 * comes off the payout instead, there is nothing to bill. An empty table on a
 * platform where everybody settles by deduction is correct, and the note says
 * so rather than reading like a bug.
 *
 * "Overdue" is not a status the API stores — it is `issued` past its due date,
 * which is a fact about today rather than about the invoice. So the facet
 * offers the three real statuses and the table works the fourth out for the
 * eye, without pretending it can filter on it.
 */
export function InvoicesView() {
  const can = useCan()
  const table = useDataTable()
  const { data, isLoading, isFetching, error, refetch } = useInvoices(table.query)

  const [paying, setPaying] = React.useState<AdminInvoice | null>(null)
  const canGenerate = can.do("invoice.generate")

  const today = toISODate(new Date())
  const rows = React.useMemo(() => data ?? [], [data])

  const outstanding = React.useMemo(
    () =>
      rows
        .filter((i) => i.status === "issued")
        .reduce((sum, i) => sum + i.amount, 0),
    [rows]
  )
  const overdue = React.useMemo(
    () => rows.filter((i) => i.status === "issued" && i.dueDate < today).length,
    [rows, today]
  )

  const columns: Column<AdminInvoice>[] = [
    {
      id: "ref",
      header: "Invoice",
      cell: (invoice) => (
        <CellStack
          primary={invoice.ref}
          secondary={`${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`}
        />
      ),
    },
    {
      id: "org",
      header: "Client",
      cell: (invoice) => (
        <Link
          href={`/admin/clients/${invoice.partnerOrgId}`}
          className="hover:text-primary underline-offset-2 hover:underline"
        >
          {invoice.orgName}
        </Link>
      ),
    },
    {
      id: "bookingCount",
      header: "Bookings",
      align: "right",
      hideBelow: "xl",
      cell: (invoice) => (
        <span className="tabular-nums">{invoice.bookingCount}</span>
      ),
    },
    {
      id: "grossAmount",
      header: "Gross",
      align: "right",
      hideBelow: "lg",
      cell: (invoice) => (
        <span className="tabular-nums">
          {formatCurrency(invoice.grossAmount)}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Commission due",
      align: "right",
      cell: (invoice) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(invoice.amount)}
        </span>
      ),
    },
    {
      id: "dueDate",
      header: "Due",
      cell: (invoice) => {
        const late = invoice.status === "issued" && invoice.dueDate < today
        return (
          <span className={late ? "text-destructive" : "text-muted-foreground"}>
            {formatDate(invoice.dueDate)}
          </span>
        )
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (invoice) => (
        <div className="space-y-1">
          <StatusPill
            status={
              invoice.status === "issued" && invoice.dueDate < today
                ? "overdue"
                : invoice.status
            }
          />
          {invoice.paidAt ? (
            <p className="text-muted-foreground text-xs">
              paid {formatDate(invoice.paidAt)}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (invoice) =>
        canGenerate && invoice.status === "issued" ? (
          <Button variant="outline" size="sm" onClick={() => setPaying(invoice)}>
            Mark paid
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <DataTable
        columns={columns}
        rows={rows}
        // Capped, not paged: the endpoint returns at most a hundred.
        nextCursor={null}
        getRowId={(invoice) => invoice.id}
        table={table}
        caption="Commission invoices with the client, the amount due and whether it has been paid"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        emptyTitle="No invoices"
        emptyDescription="Nothing to bill — commission is being deducted from payouts instead."
        facets={[{ id: "status", label: "Status", options: STATUSES }]}
        toolbarActions={canGenerate ? <GenerateInvoiceDialog /> : undefined}
      >
        <StatGrid
          className="lg:grid-cols-3"
          stats={[
            {
              label: "Outstanding",
              value: isLoading ? "—" : formatCurrency(outstanding),
              caption: "in this list",
              icon: "Receipt",
            },
            {
              label: "Overdue",
              value: isLoading ? "—" : String(overdue),
              caption: "past their due date",
              icon: "AlertTriangle",
            },
            {
              label: "Invoices",
              value: isLoading ? "—" : String(rows.length),
              icon: "FileText",
            },
          ]}
        />
      </DataTable>

      <InfoNote>
        Marking an invoice paid is the platform&rsquo;s word, not the
        partner&rsquo;s: money arrives by bank transfer and somebody reconciles
        it. Payouts resume only when a client has NOTHING outstanding — clearing
        one of three does not release the money.
      </InfoNote>

      <MarkPaidDialog invoice={paying} onClose={() => setPaying(null)} />
    </div>
  )
}
