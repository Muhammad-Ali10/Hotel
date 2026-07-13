"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarDays, Info, MapPin, Users } from "lucide-react"
import { toast } from "sonner"

import type { Booking } from "@/types"
import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "../../../_components/status-badge"

const reasons = [
  "Change of plans",
  "Found a better deal",
  "Booked by mistake",
  "Trip cancelled",
  "Other",
]

export function CancelBooking({ booking }: { booking: Booking }) {
  const router = useRouter()
  const [reason, setReason] = React.useState("")
  const [details, setDetails] = React.useState("")

  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.checkOut).getTime() -
        new Date(booking.checkIn).getTime()) /
        86_400_000
    )
  )
  const refund = booking.total // free cancellation window → full refund

  function handleCancel() {
    if (!reason) {
      toast.error("Please select a reason for cancellation.")
      return
    }
    toast.success(
      `Booking cancelled. A refund of ${formatCurrency(refund)} will be processed.`
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
                  alt={booking.hotel}
                  fill
                  sizes="(max-width: 640px) 100vw, 176px"
                  className="object-cover"
                />
              </div>
              <CardContent className="min-w-0 flex-1 py-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg font-semibold">
                      {booking.hotel}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {booking.room}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <MetaItem icon={<MapPin className="size-3.5" />} label="Location">
                    {booking.city}
                  </MetaItem>
                  <MetaItem
                    icon={<CalendarDays className="size-3.5" />}
                    label="Dates"
                  >
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
                    {formatCurrency(booking.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cancellation fee</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Free
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-base">
                  <span className="font-heading font-semibold">Refund</span>
                  <span className="font-heading font-semibold">
                    {formatCurrency(refund)}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Cancelling is permanent and cannot be undone.
              </div>

              <Button
                size="lg"
                className="w-full bg-destructive text-white hover:bg-destructive/90"
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
