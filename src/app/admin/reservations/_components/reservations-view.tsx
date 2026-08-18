"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { formatDate } from "@/lib/format"
import type { Reservation, ReservationStatus } from "@/lib/admin/types"
import {
  adminClients,
  adminReservations,
  clientName,
  propertyById,
  propertyName,
} from "@/data/admin"
import { useReservations } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  AdminPageHeader,
  CellStack,
  Money,
  StatusPill,
} from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import {
  CancelReservationDialog,
  ReservationDetailDialog,
} from "./reservation-dialogs"
import { ReservationsTabs } from "./reservations-tabs"

const STATUSES: ReservationStatus[] = [
  "Pending",
  "Confirmed",
  "Checked In",
  "Checked Out",
  "Cancelled",
  "No-show",
]

const SOURCES = ["Direct", "Booking.com", "Expedia", "Travel Agency"]

export function ReservationsView() {
  const can = useCan()
  const searchParams = useSearchParams()
  const table = useDataTable({ sortBy: "checkIn", sortDir: "desc" })
  const { data, isLoading, isFetching, error, refetch } = useReservations(
    table.params
  )

  // `?focus=RSV-…` deep-links from global search straight into the detail modal.
  // Derived rather than synced: `undefined` means "no user choice yet, follow
  // the URL", which avoids a setState-in-effect cascade.
  const focused = searchParams.get("focus")
  const [chosenId, setChosenId] = React.useState<string | null | undefined>()
  const detailId = chosenId === undefined ? focused : chosenId
  const setDetailId = setChosenId

  const [cancelling, setCancelling] = React.useState<Reservation | null>(null)

  const canCancel = can.do("reservation.cancel")

  const columns: Column<Reservation>[] = [
    {
      id: "id",
      header: "ID",
      sortable: true,
      cell: (reservation) => (
        <span className="font-medium">{reservation.id}</span>
      ),
    },
    {
      id: "guestName",
      header: "Guest",
      sortable: true,
      cell: (reservation) => (
        <CellStack
          primary={reservation.guestName}
          secondary={reservation.guestEmail}
        />
      ),
    },
    {
      id: "property",
      header: "Property / client",
      sortable: true,
      hideBelow: "md",
      cell: (reservation) => {
        const property = propertyById(reservation.propertyId)
        return (
          <CellStack
            primary={propertyName(reservation.propertyId)}
            secondary={property ? clientName(property.clientId) : undefined}
            href={`/admin/properties/${reservation.propertyId}`}
          />
        )
      },
    },
    {
      id: "room",
      header: "Room",
      hideBelow: "xl",
      cell: (reservation) => (
        <span className="text-muted-foreground">{reservation.room}</span>
      ),
    },
    {
      id: "checkIn",
      header: "Check-in",
      sortable: true,
      hideBelow: "lg",
      cell: (reservation) => formatDate(reservation.checkIn),
    },
    {
      id: "checkOut",
      header: "Check-out",
      sortable: true,
      hideBelow: "lg",
      cell: (reservation) => formatDate(reservation.checkOut),
    },
    {
      id: "guests",
      header: "Guests",
      align: "right",
      hideBelow: "xl",
      cell: (reservation) => (
        <span className="tabular-nums">{reservation.guests}</span>
      ),
    },
    {
      id: "source",
      header: "Source",
      sortable: true,
      hideBelow: "xl",
      cell: (reservation) => (
        <span className="text-muted-foreground">{reservation.source}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (reservation) => <StatusPill status={reservation.status} />,
    },
    {
      id: "total",
      header: "Total",
      sortable: true,
      align: "right",
      cell: (reservation) => <Money value={reservation.total} />,
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (reservation) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetailId(reservation.id)}
          >
            View
          </Button>
          {canCancel &&
          !["Cancelled", "Checked Out"].includes(reservation.status) ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCancelling(reservation)}
            >
              Cancel
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
        subtitle={`${adminReservations.length} bookings across all properties`}
      />

      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        total={data?.total ?? 0}
        getRowId={(reservation) => reservation.id}
        table={table}
        caption="Every booking on the platform with guest, property, dates and status"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        searchPlaceholder="Search guest, ID, property, email…"
        emptyTitle="No reservations"
        emptyDescription="Bookings appear here as guests reserve rooms."
        facets={[
          {
            id: "status",
            label: "Status",
            options: STATUSES.map((status) => ({
              label: status,
              value: status,
              count: adminReservations.filter((r) => r.status === status).length,
            })),
          },
          {
            id: "source",
            label: "Source",
            options: SOURCES.map((source) => ({
              label: source,
              value: source,
              count: adminReservations.filter((r) => r.source === source).length,
            })),
          },
          {
            id: "client",
            label: "Client",
            options: adminClients.map((client) => ({
              label: client.name,
              value: client.name,
            })),
          },
        ]}
        toolbarActions={
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href="/admin/reservations/cancellations">
                View cancellations
              </Link>
            }
          />
        }
      >
        <ReservationsTabs />
      </DataTable>

      <ReservationDetailDialog
        id={detailId}
        onClose={() => setDetailId(null)}
        onCancelRequest={setCancelling}
      />
      <CancelReservationDialog
        reservation={cancelling}
        onClose={() => setCancelling(null)}
      />
    </div>
  )
}
