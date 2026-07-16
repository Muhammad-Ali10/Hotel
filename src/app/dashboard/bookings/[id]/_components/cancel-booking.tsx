"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarDays, Info, MapPin, Users } from "lucide-react"
import { toast } from "sonner"

import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatDate } from "@/lib/format"
import { refundFor, toISODate } from "@/lib/domain"
import { refundStatusLabel } from "@/lib/labels"
import { useStore } from "@/store"
import { useBooking } from "@/store/selectors"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/shared/status-badge"
import { NotFoundCard } from "@/components/shared/not-found-card"

const reasons = [
  "Change of plans",
  "Found a better deal",
  "Booked by mistake",
  "Trip cancelled",
  "Other",
]

export function CancelBooking({ id }: { id: string }) {
  const router = useRouter()
  const booking = useBooking(id)
  const cancelBooking = useStore((s) => s.cancelBooking)
  const [reason, setReason] = React.useState("")
  const [details, setDetails] = React.useState("")

  if (!booking) {
    return (
      <NotFoundCard
        title="Booking not found"
        description="We couldn't find a reservation with that reference."
        href="/dashboard/bookings"
        cta="Back to My Bookings"
      />
    )
  }

  if (booking.status === "cancelled") {
    return (
      <NotFoundCard
        title="Already cancelled"
        description={`${booking.id} was cancelled on ${formatDate(booking.cancellation!.date)}.`}
        href="/dashboard/bookings"
        cta="Back to My Bookings"
      />
    )
  }

  const { nights } = booking.pricing
  // The refund follows the property's cancellation policy — the same function
  // the store uses when the cancellation is actually written.
  const { refund, refundStatus } = refundFor(booking, toISODate(new Date()))
  const fee = booking.pricing.total - refund

  function handleCancel() {
    if (!reason) {
      toast.error("Please select a reason for cancellation.")
      return
    }
    const fullReason = details.trim() ? `${reason} — ${details.trim()}` : reason
    cancelBooking(id, fullReason, "guest")
    toast.success(
      refund > 0
        ? `Booking cancelled. A refund of ${formatCurrency(refund)} will be processed.`
        : "Booking cancelled."
    )
    router.push("/dashboard/bookings")
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={
            <Link href="/dashboard/bookings">
              <ArrowLeft className="size-4" />
              Back to My Bookings
            </Link>
          }
        />
        <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Cancel Booking
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          We&apos;re sorry to see you go. Review the details before cancelling.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* LEFT */}
        <div className="space-y-6">
          {/* Booking summary */}
          <Card className="overflow-hidden pt-0">
            <div className="flex flex-col sm:flex-row">
              <div className="relative h-40 w-full shrink-0 overflow-hidden sm:h-auto sm:w-44">
                <Image
                  src={placeholderImage(booking.seed, 400, 300)}
                  alt={booking.hotelName}
                  fill
                  sizes="(max-width: 640px) 100vw, 176px"
                  className="object-cover"
                />
              </div>
              <CardContent className="min-w-0 flex-1 py-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg font-semibold">
                      {booking.hotelName}
                    </h2>
                    <p className="text-muted-foreground text-sm">{booking.roomName}</p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                      {booking.id}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <MetaItem icon={<MapPin className="size-3.5" />} label="Location">
                    {booking.city}
                  </MetaItem>
                  <MetaItem icon={<CalendarDays className="size-3.5" />} label="Dates">
                    {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}
                    <span className="text-muted-foreground">
                      {" "}
                      ({nights} {nights === 1 ? "night" : "nights"})
                    </span>
                  </MetaItem>
                  <MetaItem icon={<Users className="size-3.5" />} label="Guests">
                    {booking.guests}
                  </MetaItem>
                </div>
              </CardContent>
            </div>
          </Card>

          {/* Reason */}
          <div className="space-y-3">
            <Label>Reason for cancellation</Label>
            <RadioGroup
              value={reason}
              onValueChange={(v) => setReason(v as string)}
              className="gap-2"
            >
              {reasons.map((rsn) => (
                <label
                  key={rsn}
                  className="hover:bg-accent/50 flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors"
                >
                  <RadioGroupItem value={rsn} />
                  {rsn}
                </label>
              ))}
            </RadioGroup>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Tell us more (optional)"
              rows={3}
            />
          </div>
        </div>

        {/* RIGHT — refund + actions */}
        <div>
          <Card className="lg:sticky lg:top-24">
            <CardContent className="space-y-4">
              <h3 className="font-heading font-semibold">Refund Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Amount paid</span>
                  <span className="font-medium">
                    {formatCurrency(booking.pricing.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cancellation fee</span>
                  <span
                    className={
                      fee > 0
                        ? "font-medium"
                        : "font-medium text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {fee > 0 ? formatCurrency(fee) : "Free"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-base">
                  <span className="font-heading font-semibold">Refund</span>
                  <span className="font-heading font-semibold">
                    {formatCurrency(refund)}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {refundStatusLabel[refundStatus]} under this property&apos;s policy.
                </p>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Cancelling is permanent and cannot be undone.
              </div>

              <Button
                size="lg"
                className="bg-destructive hover:bg-destructive/90 w-full text-white"
                onClick={handleCancel}
              >
                Cancel Booking
              </Button>
              <Button
                variant="outline"
                className="w-full"
                render={<Link href="/dashboard/bookings">Keep Booking</Link>}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MetaItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground flex items-center gap-1 text-[0.65rem] font-medium tracking-wide uppercase">
        {icon}
        {label}
      </p>
      <p className="font-medium">{children}</p>
    </div>
  )
}
