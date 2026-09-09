"use client"

import Link from "next/link"
import Image from "next/image"
import { Star } from "lucide-react"

import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatDate } from "@/lib/format"
import type { BookingDto } from "@/lib/api/endpoints"
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

/**
 * One booking, in the API's own shape.
 *
 * It used to take the frontend's `Booking`, which diverged from the API in
 * three ways that would each have failed at a different moment:
 *
 *  - `id` was `STY-000123`; the API's `id` is a UUID and `ref` is the STY
 *    number. Linking to `/bookings/STY-000123/cancel` would 404.
 *  - `status` had `checked_out`, which the API has never had, and lacked
 *    `no_show`, which it does — so a no-show rendered as nothing.
 *  - the card read `booking.guests`; the API carries `adults` and `children`
 *    separately, because the room's limits are separate (rule #101).
 */
export function BookingCard({ booking }: { booking: BookingDto }) {
  const canChange = booking.status === "confirmed" || booking.status === "pending"
  const isCancelled = booking.status === "cancelled"
  /*
   * Only a COMPLETED stay can be reviewed (rule #39), and the API decides —
   * `/reviews/reviewable` is the list that actually gates writing one. This is
   * only whether to offer the shortcut.
   */
  const canReview = booking.status === "completed"

  const guests = booking.adults + booking.children

  return (
    <Card className="overflow-hidden pt-0">
      <div className="flex flex-col sm:flex-row">
        <div className="relative h-48 w-full shrink-0 overflow-hidden sm:h-auto sm:w-52">
          <Image
            src={placeholderImage(booking.propertyId, 400, 300)}
            alt={booking.propertyName}
            fill
            sizes="(max-width: 640px) 100vw, 208px"
            className={isCancelled ? "object-cover grayscale" : "object-cover"}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="font-heading text-lg font-semibold">{booking.propertyName}</h3>
              <p className="text-muted-foreground text-sm">
                {booking.roomName} · {booking.city}
              </p>
              {/* The reference a guest quotes to support — not the row's id. */}
              <p className="text-muted-foreground font-mono text-xs">{booking.ref}</p>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DetailItem label="Check-in" value={formatDate(booking.checkIn)} />
            <DetailItem label="Check-out" value={formatDate(booking.checkOut)} />
            <DetailItem
              label="Guests"
              value={
                booking.children > 0
                  ? `${booking.adults} adults, ${booking.children} children`
                  : String(guests)
              }
            />
            <DetailItem label="Total" value={formatCurrency(booking.total)} />
          </div>

          {isCancelled && booking.cancelledAt ? (
            <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-3 text-sm">
              <p className="font-medium">Cancelled on {formatDate(booking.cancelledAt)}</p>
              <p className="text-muted-foreground mt-0.5">
                {/*
                  The refunded figure comes from the server, which computed it
                  from the rate plan's own terms (rule #1). Recomputing it here
                  would be a second answer free to disagree with the money that
                  actually moved.
                */}
                {booking.refundAmount && booking.refundAmount > 0
                  ? `${formatCurrency(booking.refundAmount)} refunded`
                  : "No refund was due under this rate"}
              </p>
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            {/*
              The Invoice button that used to sit here only raised a toast —
              "Downloading invoice for STY-000123" and nothing downloaded.
              There is no invoice endpoint for a guest's booking, so the button
              is gone rather than lying. When there is one, it belongs here.
            */}
            {canChange ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/dashboard/bookings/${booking.id}/modify`}>Modify</Link>}
                />
                <Button
                  size="sm"
                  variant="destructive"
                  render={<Link href={`/dashboard/bookings/${booking.id}/cancel`}>Cancel</Link>}
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
