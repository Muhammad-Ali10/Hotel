"use client"

import Image from "next/image"
import { FileText } from "lucide-react"
import { toast } from "sonner"

import type { Booking } from "@/types"
import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { StatusBadge } from "../../_components/status-badge"

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
  const isConfirmed = booking.status === "confirmed"

  function handleInvoice() {
    toast.success(`Downloading invoice for ${booking.hotel}`)
  }

  function handleModify() {
    toast.info(`Modifying your stay at ${booking.hotel}`)
  }

  function handleCancel() {
    toast.error(`Cancelled your booking at ${booking.hotel}`)
  }

  return (
    <Card className="overflow-hidden pt-0">
      <div className="flex flex-col sm:flex-row">
        {/* Image — top on mobile, left on sm+ */}
        <div className="relative h-48 w-full shrink-0 overflow-hidden sm:h-auto sm:w-52">
          <Image
            src={placeholderImage(booking.seed, 400, 300)}
            alt={booking.hotel}
            fill
            sizes="(max-width: 640px) 100vw, 208px"
            className="object-cover"
          />
        </div>

        {/* Details */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="font-heading text-lg font-semibold">
                {booking.hotel}
              </h3>
              <p className="text-muted-foreground text-sm">{booking.room}</p>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DetailItem label="Check-in" value={formatDate(booking.checkIn)} />
            <DetailItem label="Check-out" value={formatDate(booking.checkOut)} />
            <DetailItem label="Guests" value={String(booking.guests)} />
            <DetailItem label="Total" value={formatCurrency(booking.total)} />
          </div>

          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={handleInvoice}>
              <FileText />
              Invoice
            </Button>
            {isConfirmed ? (
              <>
                <Button size="sm" variant="outline" onClick={handleModify}>
                  Modify
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  )
}
