"use client"

import * as React from "react"
import Link from "next/link"

import { formatDate } from "@/lib/format"
import type { Payout } from "@/lib/admin/types"
import {
  payoutsPaidTotal,
  payoutsPendingTotal,
  propertiesPaidCount,
  propertyName,
} from "@/data/admin"
import {
  useAdminCounts,
  usePayouts,
  useRetryPayout,
} from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  ActionButton,
  CellStack,
  DescriptionList,
  Money,
  StatGrid,
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

const STATUSES = ["Paid", "Pending", "Failed"]

export function PayoutsView() {
  const can = useCan()
  const table = useDataTable({ sortBy: "date", sortDir: "desc" })
  const { data, isLoading, isFetching, error, refetch } = usePayouts(table.params)
  const [detail, setDetail] = React.useState<Payout | null>(null)
  const retry = useRetryPayout()
  const canRetry = can.do("payout.retry")

  // Live: retrying a failed payout moves it into the pending total.
  const { data: counts } = useAdminCounts()
  const paidTotal = counts?.money.payoutsPaid ?? payoutsPaidTotal
  const pendingTotal = counts?.money.payoutsPending ?? payoutsPendingTotal
  const paidCount = counts?.money.propertiesPaid ?? propertiesPaidCount

  const columns: Column<Payout>[] = [
    {
      id: "id",
      header: "Payout",
      sortable: true,
      cell: (payout) => (
        <CellStack primary={payout.id} secondary={payout.reference} />
      ),
    },
    {
      id: "property",
      header: "Property",
      sortable: true,
      cell: (payout) => (
        <Link
          href={`/admin/properties/${payout.propertyId}`}
          className="hover:text-primary underline-offset-2 hover:underline"
        >
          {propertyName(payout.propertyId)}
        </Link>
      ),
    },
    {
      id: "ownerName",
      header: "Owner",
      sortable: true,
      hideBelow: "lg",
      cell: (payout) => payout.ownerName,
    },
    {
      id: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      cell: (payout) => <Money value={payout.amount} />,
    },
    {
      id: "method",
      header: "Method",
      sortable: true,
      hideBelow: "md",
      cell: (payout) => (
        <span className="text-muted-foreground">{payout.method}</span>
      ),
    },
    {
      id: "date",
      header: "Date",
      sortable: true,
      cell: (payout) => formatDate(payout.date),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (payout) => <StatusPill status={payout.status} />,
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (payout) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setDetail(payout)}>
            View
          </Button>
          {payout.status === "Failed" && canRetry ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={retry.isPending}
              onClick={() => retry.mutate({ id: payout.id })}
            >
              Retry
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        total={data?.total ?? 0}
        getRowId={(payout) => payout.id}
        table={table}
        caption="Payouts to property owners with method, date and status"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        searchPlaceholder="Search payouts, properties, references…"
        emptyTitle="No payouts"
        emptyDescription="Payouts appear here once a settlement run completes."
        facets={[
          {
            id: "status",
            label: "Status",
            options: STATUSES.map((status) => ({ label: status, value: status })),
          },
        ]}
      >
        <StatGrid
          className="lg:grid-cols-3"
          stats={[
            {
              label: "Total Payouts YTD",
              value: `$${paidTotal.toLocaleString("en-US")}`,
              icon: "Wallet",
            },
            {
              label: "Properties Paid",
              value: String(paidCount),
              icon: "CheckCircle2",
            },
            {
              label: "Pending Payouts",
              value: `$${pendingTotal.toLocaleString("en-US")}`,
              icon: "Clock",
            },
          ]}
        />
      </DataTable>

      <Dialog
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Payout {detail?.id}</DialogTitle>
            <DialogDescription>
              Settlement to the property owner for the period&rsquo;s bookings.
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
                  { label: "Payout date", value: formatDate(detail.date) },
                  { label: "Method", value: detail.method },
                  { label: "Reference", value: detail.reference },
                  {
                    label: "Amount",
                    value: <Money value={detail.amount} />,
                  },
                ]}
              />
              {detail.failureReason ? (
                <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm text-pretty">
                  {detail.failureReason}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
            {detail?.status === "Failed" && canRetry ? (
              <Button
                disabled={retry.isPending}
                onClick={() => {
                  retry.mutate({ id: detail.id })
                  setDetail(null)
                }}
              >
                Retry payout
              </Button>
            ) : (
              <ActionButton
                toastMessage="Receipt downloading"
                toastDescription={`${detail?.id} receipt will be saved to your downloads.`}
              >
                Download receipt
              </ActionButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
