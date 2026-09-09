"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { formatCurrency, formatDate } from "@/lib/format"
import type { AdminReservationRow } from "@/lib/admin/api/endpoints"
import { useReservations } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  AdminPageHeader,
  CellStack,
  StatusPill,
} from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import {
  RefundReservationDialog,
  ReservationDetailDialog,
} from "./reservation-dialogs"
import { ReservationsTabs } from "./reservations-tabs"

/**
 * Every booking on the platform.
 *
 * The status facet is the API's own vocabulary and nothing more — the mock had
 * "Checked Out" and "No-show" as separate Title-Case words for what the state
 * machine calls `completed` and `no_show`, which meant a filter chosen here
 * could not be sent anywhere.
 *
 * The Source facet is gone. It offered "Booking.com", "Expedia" and "Travel
 * Agency": this marketplace has no channel connections at all, so filtering
 * by them could only ever return nothing.
 *
 * "Cancel" is now "Refund", because that is what the platform actually does
 * here. A partner cancels their own bookings under the guest's terms; the
 * PLATFORM overrides those terms with a goodwill refund (rule #76), which is a
 * different act with a different consequence — the commission on a fully
 * refunded booking is voided.
 */
const STATUSES = [
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Checked in", value: "checked_in" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "No-show", value: "no_show" },
]

export function ReservationsView() {
  const can = useCan()
  const searchParams = useSearchParams()
  const table = useDataTable()
  const { data, isLoading, isFetching, error, refetch } = useReservations(table.query)

  /*
   * `?focus=…` deep-links from global search straight into the detail modal.
   *
   * Derived rather than synced: `undefined` means "no choice made yet, follow
   * the URL", which avoids a setState-in-effect cascade.
   */
  const focused = searchParams.get("focus")
  const [chosenId, setChosenId] = React.useState<string | null | undefined>()
  const detailId = chosenId === undefined ? focused : chosenId

  const [refunding, setRefunding] = React.useState<AdminReservationRow | null>(null)

  const canRefund = can.do("reservation.cancel")

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
          secondary={booking.city}
          href={`/admin/properties/${booking.propertyId}`}
        />
      ),
    },
    {
      id: "room",
      header: "Room",
      hideBelow: "xl",
      cell: (booking) => (
        <span className="text-muted-foreground">{booking.roomName}</span>
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
      id: "guests",
      header: "Guests",
      align: "right",
      hideBelow: "xl",
      cell: (booking) => (
        /* Adults and children are counted separately, never as one number. */
        <span className="tabular-nums">
          {booking.adults}
          {booking.children > 0 ? ` + ${booking.children}` : ""}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (booking) => <StatusPill status={booking.status} />,
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      cell: (booking) => (
        <span className="tabular-nums">{formatCurrency(booking.total)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (booking) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setChosenId(booking.id)}>
            View
          </Button>
          {canRefund && booking.status !== "cancelled" ? (
            <Button variant="ghost" size="sm" onClick={() => setRefunding(booking)}>
              Refund
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Global Reservations"
        subtitle="Every booking on the platform, newest first"
      />

      <ReservationsTabs />

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        nextCursor={data?.nextCursor ?? null}
        getRowId={(booking) => booking.id}
        table={table}
        caption="Every booking on the platform with guest, property, dates and status"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        searchPlaceholder="Search by reference, guest name or email…"
        emptyTitle="No reservations"
        emptyDescription="Bookings appear here as guests reserve rooms."
        facets={[{ id: "status", label: "Status", options: STATUSES }]}
      />

      <ReservationDetailDialog
        id={detailId}
        onClose={() => setChosenId(null)}
        onRefund={(booking) => {
          setChosenId(null)
          setRefunding(booking)
        }}
      />

      <RefundReservationDialog
        booking={refunding}
        onClose={() => setRefunding(null)}
      />
    </div>
  )
}
