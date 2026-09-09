"use client"

import Link from "next/link"

import { formatCurrency } from "@/lib/format"
import { usePartnerBookings } from "@/lib/api/hooks"
import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"

/**
 * Counts from the same list the table below shows.
 *
 * Both headers read one query, so the number in the subtitle and the number of
 * rows on the page cannot disagree — which is what happens the moment a header
 * counts from one source and a table renders another.
 */
export function ReservationsHeader() {
  const bookings = usePartnerBookings()

  const all = bookings.data ?? []
  const live = all.filter((b) => b.status !== "cancelled")
  const awaiting = live.filter((b) => b.status === "confirmed").length

  return (
    <PageHeader
      title="Reservations"
      subtitle={
        bookings.isPending
          ? "Loading…"
          : `${live.length} active · ${awaiting} awaiting arrival`
      }
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
  const bookings = usePartnerBookings()

  const cancelled = (bookings.data ?? []).filter((b) => b.status === "cancelled")

  /*
   * Refunds, only where the API actually reports one.
   *
   * A cancelled booking with no refund figure is not a zero refund — it is a
   * refund this list does not carry, and summing it as zero would understate
   * what went back to guests.
   */
  const refunded = cancelled.reduce((sum, b) => sum + (b.refundAmount ?? 0), 0)
  const pending = cancelled.filter((b) => b.refundStatus === "pending").length

  return (
    <PageHeader
      title="Cancellations"
      subtitle={
        bookings.isPending
          ? "Loading…"
          : `${cancelled.length} cancelled · ${formatCurrency(refunded)} refunded · ${pending} pending`
      }
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
