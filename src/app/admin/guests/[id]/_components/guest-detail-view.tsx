"use client"

import Link from "next/link"

import { formatDate } from "@/lib/format"
import { propertyName } from "@/data/admin"
import { useGuest } from "@/lib/admin/api/hooks"
import {
  AdminPageHeader,
  DescriptionList,
  Money,
  SectionCard,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { CardListSkeleton } from "@/components/shared/data-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** Guest detail — the destination the Figma's "View" action never had. */
export function GuestDetailView({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useGuest(id)

  if (error) {
    return (
      <ErrorState
        variant="page"
        title="Guest not found"
        error={error}
        onRetry={() => void refetch()}
      />
    )
  }

  if (isLoading || !data) return <CardListSkeleton count={2} />

  const { guest, reservations } = data
  const cancelled = reservations.filter((r) => r.status === "Cancelled").length

  return (
    <div className="space-y-6">
      <AdminPageHeader title={guest.name} subtitle={`${guest.id} · ${guest.country}`}>
        <StatusPill status={guest.status} />
      </AdminPageHeader>

      <StatGrid
        stats={[
          {
            label: "Lifetime Bookings",
            value: String(guest.bookings),
            icon: "CalendarCheck",
          },
          {
            label: "Total Spent",
            value: `$${guest.totalSpent.toLocaleString("en-US")}`,
            icon: "DollarSign",
          },
          {
            label: "On Record Here",
            value: String(reservations.length),
            caption: "current & upcoming",
            icon: "FileText",
          },
          {
            label: "Cancelled",
            value: String(cancelled),
            icon: "Clock",
          },
        ]}
      />

      <SectionCard title="Contact">
        <DescriptionList
          columns={3}
          items={[
            { label: "Email", value: guest.email },
            { label: "Phone", value: guest.phone },
            { label: "Country", value: guest.country },
            { label: "Registered", value: formatDate(guest.joined) },
            { label: "Account status", value: <StatusPill status={guest.status} /> },
          ]}
        />
      </SectionCard>

      <SectionCard title="Reservations" contentClassName="px-0">
        {reservations.length === 0 ? (
          <EmptyState
            title="No reservations on record"
            description="This guest has no current or upcoming bookings on the platform."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="pl-6">Reservation</TableHead>
                <TableHead scope="col">Property</TableHead>
                <TableHead scope="col">Stay</TableHead>
                <TableHead scope="col">Source</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="pr-6 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell className="pl-6 font-medium">
                    {reservation.id}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/properties/${reservation.propertyId}`}
                      className="hover:text-primary underline-offset-2 hover:underline"
                    >
                      {propertyName(reservation.propertyId)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(reservation.checkIn)} –{" "}
                    {formatDate(reservation.checkOut)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {reservation.source}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={reservation.status} />
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Money value={reservation.total} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
