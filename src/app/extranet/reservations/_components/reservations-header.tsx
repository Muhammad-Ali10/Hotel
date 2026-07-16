"use client"

import Link from "next/link"

import { usePartnerCancellations, usePartnerReservations } from "@/store/selectors"
import { formatCurrency } from "@/lib/format"
import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"

/** Counts come from the store, so a booking taken on the site or a cancellation
 *  made in the dashboard moves these numbers immediately. */
export function ReservationsHeader() {
  const reservations = usePartnerReservations()
  const arriving = reservations.filter((r) => r.status === "confirmed").length

  return (
    <PageHeader
      title="Reservations"
      subtitle={`${reservations.length} active reservations · ${arriving} awaiting arrival`}
    >
      <Button size="sm" render={<Link href="/extranet/reservations">Reservations List</Link>} />
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/extranet/reservations/cancellations">Cancellations</Link>}
      />
    </PageHeader>
  )
}

export function CancellationsHeader() {
  const cancellations = usePartnerCancellations()
  const refunded = cancellations.reduce((sum, c) => sum + (c.cancellation?.refund ?? 0), 0)
  const pending = cancellations.filter((c) => c.cancellation?.refundStatus === "pending").length

  return (
    <PageHeader
      title="Cancellations"
      subtitle={`${cancellations.length} cancelled reservations · ${formatCurrency(
        refunded
      )} refunded · ${pending} refund${pending === 1 ? "" : "s"} pending`}
    >
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/extranet/reservations">Reservations List</Link>}
      />
      <Button size="sm" render={<Link href="/extranet/reservations/cancellations">Cancellations</Link>} />
    </PageHeader>
  )
}
