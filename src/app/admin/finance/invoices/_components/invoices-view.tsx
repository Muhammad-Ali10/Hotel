"use client"

import * as React from "react"

import { formatDate } from "@/lib/format"
import type { CommissionInvoice } from "@/lib/admin/types"
import { adminCommissionInvoices, propertyName } from "@/data/admin"
import { useAdminCounts, useCommissionInvoices } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  ActionButton,
  CellStack,
  DescriptionList,
  Money,
  StatusPill,
} from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GenerateInvoiceDialog } from "./generate-invoice-dialog"

const STATUSES = ["Pending", "Paid", "Overdue", "Void"]

export function InvoicesView() {
  const can = useCan()
  const table = useDataTable({ sortBy: "issued", sortDir: "desc" })
  const { data, isLoading, isFetching, error, refetch } = useCommissionInvoices(
    table.params
  )
  const [detail, setDetail] = React.useState<CommissionInvoice | null>(null)
  const canGenerate = can.do("invoice.generate")
  const canRemind = can.do("invoice.remind")

  // Live: issuing an invoice updates the status facet counts.
  const { data: counts } = useAdminCounts()
  const statusCount = (status: string) =>
    counts?.commissionInvoices[status] ??
    adminCommissionInvoices.filter((i) => i.status === status).length

  const columns: Column<CommissionInvoice>[] = [
    {
      id: "id",
      header: "Invoice #",
      sortable: true,
      cell: (invoice) => (
        <span className="font-medium">{invoice.id}</span>
      ),
    },
    {
      id: "property",
      header: "Property",
      sortable: true,
      cell: (invoice) => (
        <CellStack
          primary={propertyName(invoice.propertyId)}
          secondary={invoice.ownerName}
          href={`/admin/properties/${invoice.propertyId}`}
        />
      ),
    },
    {
      id: "bookings",
      header: "Bookings",
      sortable: true,
      align: "right",
      hideBelow: "xl",
      cell: (invoice) => (
        <span className="tabular-nums">{invoice.bookings}</span>
      ),
    },
    {
      id: "subtotal",
      header: "Subtotal",
      sortable: true,
      align: "right",
      hideBelow: "lg",
      cell: (invoice) => (
        <span className="text-muted-foreground">
          <Money value={invoice.subtotal} />
        </span>
      ),
    },
    {
      id: "total",
      header: "Total",
      sortable: true,
      align: "right",
      cell: (invoice) => <Money value={invoice.total} />,
    },
    {
      id: "issued",
      header: "Issued",
      sortable: true,
      hideBelow: "md",
      cell: (invoice) => formatDate(invoice.issued),
    },
    {
      id: "due",
      header: "Due",
      sortable: true,
      cell: (invoice) => formatDate(invoice.due),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (invoice) => <StatusPill status={invoice.status} />,
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (invoice) => (
        <Button variant="ghost" size="sm" onClick={() => setDetail(invoice)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        total={data?.total ?? 0}
        getRowId={(invoice) => invoice.id}
        table={table}
        caption="Commission invoices issued to property owners"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        searchPlaceholder="Search invoices, properties, owners…"
        emptyTitle="No invoices"
        emptyDescription="Generate a commission invoice to bill a property for its bookings."
        emptyAction={canGenerate ? <GenerateInvoiceDialog /> : undefined}
        toolbarActions={canGenerate ? <GenerateInvoiceDialog /> : undefined}
        facets={[
          {
            id: "status",
            label: "Status",
            options: STATUSES.map((status) => ({
              label: status,
              value: status,
              count: statusCount(status),
            })),
          },
        ]}
      />

      <Dialog
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invoice {detail?.id}</DialogTitle>
            <DialogDescription>
              {detail
                ? `Commission for bookings ${formatDate(detail.periodStart)} – ${formatDate(detail.periodEnd)}`
                : null}
            </DialogDescription>
          </DialogHeader>

          {detail ? (
            <div className="space-y-4">
              <StatusPill status={detail.status} />
              <DescriptionList
                columns={2}
                items={[
                  { label: "Property", value: propertyName(detail.propertyId) },
                  { label: "Owner", value: detail.ownerName },
                  { label: "Issue date", value: formatDate(detail.issued) },
                  { label: "Due date", value: formatDate(detail.due) },
                  { label: "Bookings", value: detail.bookings },
                ]}
              />
              <dl className="space-y-2 rounded-lg border p-4 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>
                    <Money value={detail.subtotal} />
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">
                    {detail.taxLabel} ({(detail.taxRate * 100).toFixed(1)}%)
                  </dt>
                  <dd>
                    <Money value={detail.total - detail.subtotal} />
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t pt-2 font-medium">
                  <dt>Total</dt>
                  <dd>
                    <Money value={detail.total} />
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
            <ActionButton
              variant="outline"
              toastMessage="PDF downloading"
              toastDescription={`${detail?.id} will be saved to your downloads.`}
            >
              Download PDF
            </ActionButton>
            {canRemind &&
            detail &&
            (detail.status === "Pending" || detail.status === "Overdue") ? (
              <ActionButton
                toastMessage="Reminder sent"
                toastDescription={`${detail.ownerName} has been emailed about ${detail.id}.`}
              >
                Send reminder
              </ActionButton>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
