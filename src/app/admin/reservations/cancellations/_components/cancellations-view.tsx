"use client"

import Link from "next/link"

import { formatDate } from "@/lib/format"
import type { Cancellation } from "@/lib/admin/types"
import { adminCancellations, propertyName } from "@/data/admin"
import { useAdminCounts, useCancellations } from "@/lib/admin/api/hooks"
import {
  AdminPageHeader,
  CellStack,
  Money,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { ReservationsTabs } from "../../_components/reservations-tabs"

const REASONS = [
  "Guest request",
  "Payment failed",
  "Property closure",
  "Overbooking",
  "No-show",
  "Suspected fraud",
]

const REFUNDS = ["Full refund", "Partial", "No refund"]

/**
 * The Figma's sidebar listed "Cancellations" as a child of Reservations but no
 * artboard was ever drawn for it. Built from the cancellation records the
 * cancel flow writes.
 */
export function CancellationsView() {
  const table = useDataTable({ sortBy: "cancelledAt", sortDir: "desc" })
  const { data, isLoading, isFetching, error, refetch } = useCancellations(
    table.params
  )

  // Live: cancelling a reservation from the previous tab adds a row here.
  const { data: counts } = useAdminCounts()
  const total = counts?.totals.cancellations ?? adminCancellations.length
  const refunded =
    counts?.money.refunded ??
    adminCancellations.reduce((sum, c) => sum + c.refundAmount, 0)
  const lost =
    counts?.money.retained ??
    adminCancellations.reduce(
      (sum, c) => sum + (c.originalTotal - c.refundAmount),
      0
    )
  const reasonCount = (reason: string) =>
    counts?.cancellations[reason] ??
    adminCancellations.filter((c) => c.reason === reason).length
  const refundCount = (refund: string) =>
    counts?.refunds[refund] ??
    adminCancellations.filter((c) => c.refund === refund).length

  const columns: Column<Cancellation>[] = [
    {
      id: "id",
      header: "Cancellation",
      sortable: true,
      cell: (cancellation) => (
        <CellStack
          primary={cancellation.id}
          secondary={cancellation.reservationId}
        />
      ),
    },
    {
      id: "guestName",
      header: "Guest",
      sortable: true,
      cell: (cancellation) => cancellation.guestName,
    },
    {
      id: "property",
      header: "Property",
      sortable: true,
      hideBelow: "md",
      cell: (cancellation) => (
        <Link
          href={`/admin/properties/${cancellation.propertyId}`}
          className="hover:text-primary underline-offset-2 hover:underline"
        >
          {propertyName(cancellation.propertyId)}
        </Link>
      ),
    },
    {
      id: "cancelledAt",
      header: "Cancelled",
      sortable: true,
      cell: (cancellation) => formatDate(cancellation.cancelledAt),
    },
    {
      id: "reason",
      header: "Reason",
      sortable: true,
      cell: (cancellation) => cancellation.reason,
    },
    {
      id: "refund",
      header: "Refund",
      sortable: true,
      cell: (cancellation) => <StatusPill status={cancellation.refund} />,
    },
    {
      id: "refundAmount",
      header: "Refunded",
      sortable: true,
      align: "right",
      cell: (cancellation) => <Money value={cancellation.refundAmount} />,
    },
    {
      id: "originalTotal",
      header: "Original",
      sortable: true,
      align: "right",
      hideBelow: "lg",
      cell: (cancellation) => (
        <span className="text-muted-foreground">
          <Money value={cancellation.originalTotal} />
        </span>
      ),
    },
    {
      id: "cancelledBy",
      header: "Cancelled by",
      hideBelow: "xl",
      cell: (cancellation) => (
        <CellStack
          primary={cancellation.cancelledBy}
          secondary={cancellation.note}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Cancellations"
        subtitle={`${total} cancellations across all properties`}
      />

      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        total={data?.total ?? 0}
        getRowId={(cancellation) => cancellation.id}
        table={table}
        caption="Cancelled reservations with reason, refund treatment and who cancelled"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        searchPlaceholder="Search guest, reservation, property…"
        emptyTitle="No cancellations"
        emptyDescription="Cancelled bookings appear here with their refund treatment."
        facets={[
          {
            id: "reason",
            label: "Reason",
            options: REASONS.map((reason) => ({
              label: reason,
              value: reason,
              count: reasonCount(reason),
            })),
          },
          {
            id: "refund",
            label: "Refund",
            options: REFUNDS.map((refund) => ({
              label: refund,
              value: refund,
              count: refundCount(refund),
            })),
          },
        ]}
      >
        <ReservationsTabs />
        <StatGrid
          stats={[
            {
              label: "Cancellations",
              value: String(total),
              icon: "AlertTriangle",
            },
            {
              label: "Refunded",
              value: `$${refunded.toLocaleString("en-US")}`,
              icon: "DollarSign",
            },
            {
              label: "Retained",
              value: `$${lost.toLocaleString("en-US")}`,
              caption: "per property policy",
              icon: "Wallet",
            },
            {
              label: "Fraud-related",
              value: String(reasonCount("Suspected fraud")),
              icon: "ShieldCheck",
            },
          ]}
        />
      </DataTable>
    </div>
  )
}
