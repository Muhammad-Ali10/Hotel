"use client"

import Link from "next/link"
import Image from "next/image"
import { FileText, Star } from "lucide-react"
import { toast } from "sonner"

import type { Booking } from "@/types"
import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatDate } from "@/lib/format"
import { refundStatusLabel } from "@/lib/labels"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-[0.65rem] font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

export function BookingCard({ booking }: { booking: Booking }) {
  const canChange = booking.status === "confirmed" || booking.status === "pending"
  const isCancelled = booking.status === "cancelled"
  const canReview = booking.status === "completed" || booking.status === "checked_out"

  function handleInvoice() {
    toast.success(`Downloading invoice for ${booking.id}`)
  }

  return (
    <Card className="overflow-hidden pt-0">
      <div className="flex flex-col sm:flex-row">
        {/* Image — top on mobile, left on sm+ */}
        <div className="relative h-48 w-full shrink-0 overflow-hidden sm:h-auto sm:w-52">
          <Image
            src={placeholderImage(booking.seed, 400, 300)}
            alt={booking.hotelName}
            fill
            sizes="(max-width: 640px) 100vw, 208px"
            className={isCancelled ? "object-cover grayscale" : "object-cover"}
          />
        </div>

        {/* Details */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="font-heading text-lg font-semibold">{booking.hotelName}</h3>
              <p className="text-muted-foreground text-sm">
                {booking.roomName} · {booking.city}
              </p>
              <p className="text-muted-foreground font-mono text-xs">{booking.id}</p>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DetailItem label="Check-in" value={formatDate(booking.checkIn)} />
            <DetailItem label="Check-out" value={formatDate(booking.checkOut)} />
            <DetailItem label="Guests" value={String(booking.guests)} />
            <DetailItem label="Total" value={formatCurrency(booking.pricing.total)} />
          </div>

          {isCancelled && booking.cancellation ? (
            <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-3 text-sm">
              <p className="font-medium">
                Cancelled on {formatDate(booking.cancellation.date)}
              </p>
              <p className="text-muted-foreground mt-0.5">
                {booking.cancellation.reason} ·{" "}
                {refundStatusLabel[booking.cancellation.refundStatus]}
                {booking.cancellation.refund > 0
                  ? ` of ${formatCurrency(booking.cancellation.refund)}`
                  : ""}
              </p>
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={handleInvoice}>
              <FileText />
              Invoice
            </Button>
            {canChange ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link href={`/dashboard/bookings/${booking.id}/modify`}>Modify</Link>
                  }
                />
                <Button
                  size="sm"
                  variant="destructive"
                  render={
                    <Link href={`/dashboard/bookings/${booking.id}/cancel`}>Cancel</Link>
                  }
                />
              </>
            ) : null}
            {canReview ? (
              <Button
                size="sm"
                variant="outline"
                render={
                  <Link href={`/dashboard/reviews?booking=${booking.id}`}>
                    <Star />
                    Write a review
                  </Link>
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  )
}
