"use client"

import * as React from "react"

import { formatCurrency, formatDate } from "@/lib/format"
import type { AdminReservationRow } from "@/lib/admin/api/endpoints"
import { useReservations } from "@/lib/admin/api/hooks"
import {
  AdminPageHeader,
  CellStack,
  InfoNote,
  StatGrid,
} from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { ReservationsTabs } from "../../_components/reservations-tabs"

/**
 * Cancelled bookings.
 *
 * The Figma listed this under Reservations but never drew it. It is the same
 * endpoint as the reservations list with `status=cancelled` — not a separate
 * "cancellation record", which is what the mock modelled and which does not
 * exist: a cancellation is a state a BOOKING is in, plus the refund fields the
 * cancel flow wrote onto it.
 *
 * The reason facet is gone. It offered six fixed reasons — "Payment failed",
 * "Overbooking", "Suspected fraud" — and the API stores whatever the person
 * cancelling actually typed. A filter over categories nobody chooses from
 * could only ever match nothing.
 *
 * "Retained" is what the property kept, and it is deliberately not called
 * "lost": a cancellation fee inside the guest's own terms is revenue, even
 * though no room was sold for it (rule #63).
 */
export function CancellationsView() {
  const table = useDataTable()

  const query = React.useMemo(
    () => ({ ...table.query, status: "cancelled" }),
    [table.query]
  )

  const { data, isLoading, isFetching, error, refetch } = useReservations(query)
  const rows = React.useMemo(() => data?.items ?? [], [data?.items])

  /*
   * Summed over the page, and said so.
   *
   * There is no aggregate endpoint for "everything ever refunded", and adding
   * up one page while implying a platform total is exactly the kind of number
   * somebody would put in a report. Finance answers it properly, for a window.
   */
  const onPage = React.useMemo(() => {
    let refunded = 0
    let retained = 0
    for (const booking of rows) {
      const back = booking.refundAmount ?? 0
      refunded += back
      retained += Math.max(booking.total - back, 0)
    }
    return { refunded, retained }
  }, [rows])

  const columns: Column<AdminReservationRow>[] = [
    {
      id: "ref",
      header: "Reference",
      cell: (booking) => <span className="font-medium">{booking.ref}</span>,
    },
    {
      id: "guest",
      header: "Guest",
      cell: (booking) => (
        <CellStack
          primary={`${booking.guestFirstName} ${booking.guestLastName}`}
          secondary={booking.guestEmail}
        />
      ),
    },
    {
      id: "property",
      header: "Property",
      hideBelow: "md",
      cell: (booking) => (
        <CellStack
          primary={booking.propertyName}
          secondary={booking.roomName}
          href={`/admin/properties/${booking.propertyId}`}
        />
      ),
    },
    {
      id: "stay",
      header: "Stay",
      hideBelow: "lg",
      cell: (booking) => (
        <span className="text-muted-foreground">
          {formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}
        </span>
      ),
    },
    {
      id: "cancelledAt",
      header: "Cancelled",
      cell: (booking) => (
        <div>
          <p className="text-sm">
            {booking.cancelledAt ? formatDate(booking.cancelledAt) : "—"}
          </p>
          {booking.cancelledBy ? (
            <p className="text-muted-foreground text-xs">
              by {booking.cancelledBy}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "reason",
      header: "Reason",
      hideBelow: "xl",
      cell: (booking) => (
        <span className="text-muted-foreground text-sm text-pretty">
          {booking.cancellationReason || "—"}
        </span>
      ),
    },
    {
      id: "total",
      header: "Was worth",
      align: "right",
      hideBelow: "lg",
      cell: (booking) => (
        <span className="tabular-nums">{formatCurrency(booking.total)}</span>
      ),
    },
    {
      id: "refund",
      header: "Refunded",
      align: "right",
      cell: (booking) => (
        <div className="space-y-1">
          <span className="tabular-nums">
            {booking.refundAmount === null
              ? "—"
              : formatCurrency(booking.refundAmount)}
          </span>
          {booking.refundStatus ? (
            <Badge variant="outline" className="block w-fit">
              {booking.refundStatus}
            </Badge>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Cancellations"
        subtitle="Bookings that were cancelled, and what went back"
      />

      <ReservationsTabs />

      <DataTable
        columns={columns}
        rows={rows}
        nextCursor={data?.nextCursor ?? null}
        getRowId={(booking) => booking.id}
        table={table}
        caption="Cancelled bookings with the reason given and the amount refunded"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        searchPlaceholder="Search by reference, guest name or email…"
        emptyTitle="Nothing cancelled"
        emptyDescription="Cancelled bookings appear here with their refund."
      >
        <StatGrid
          stats={[
            {
              label: "On this page",
              value: isLoading ? "—" : String(rows.length),
              icon: "CalendarX",
            },
            {
              label: "Refunded",
              value: isLoading ? "—" : formatCurrency(onPage.refunded),
              caption: "on this page",
              icon: "Undo2",
            },
            {
              label: "Retained",
              value: isLoading ? "—" : formatCurrency(onPage.retained),
              caption: "kept under the guest's terms",
              icon: "Wallet",
            },
          ]}
        />
      </DataTable>

      <InfoNote>
        A cancellation fee kept under the guest&rsquo;s own terms is revenue,
        even though no room was sold for it. Finance reports both properly for a
        window you choose; the figures here describe this page only.
      </InfoNote>
    </div>
  )
}
