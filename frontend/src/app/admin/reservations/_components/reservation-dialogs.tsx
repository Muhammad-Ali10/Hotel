"use client"

import * as React from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { formatCurrency, formatDate } from "@/lib/format"
import type { AdminReservationRow } from "@/lib/admin/api/endpoints"
import { useRefundReservation, useReservation } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import { DescriptionList, StatusPill } from "@/components/admin/shared"
import { Skeleton } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/** Read-only booking detail. */
export function ReservationDetailDialog({
  id,
  onClose,
  onRefund,
}: {
  id: string | null
  onClose: () => void
  onRefund: (booking: AdminReservationRow) => void
}) {
  const can = useCan()
  /*
   * The detail route answers `{ booking, events, payments, totals }`, not a
   * booking — it was typed as one, so every field below read `undefined` off
   * the wrapper and the dialog threw on the first of them.
   */
  const { data: detail, isLoading } = useReservation(id)
  const booking = detail?.booking

  const refundable =
    booking && booking.status !== "cancelled" && can.do("reservation.cancel")

  return (
    <Dialog
      open={id !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Booking details</DialogTitle>
          <DialogDescription>
            {booking
              ? `${booking.ref} · booked ${formatDate(booking.createdAt)}`
              : "Loading booking…"}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !booking ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <StatusPill status={booking.status} />

            <section className="space-y-3">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Guest &amp; property
              </h3>
              <DescriptionList
                columns={2}
                items={[
                  {
                    /*
                     * Who the stay is FOR, not who paid.
                     *
                     * A guest can book for somebody else, so these come off the
                     * booking rather than off an account.
                     */
                    label: "Guest",
                    value: `${booking.guestFirstName} ${booking.guestLastName}`,
                  },
                  { label: "Email", value: booking.guestEmail },
                  { label: "Phone", value: booking.guestPhone || "—" },
                  {
                    label: "Property",
                    value: (
                      <Link
                        href={`/admin/properties/${booking.propertyId}`}
                        className="hover:text-primary underline-offset-2 hover:underline"
                      >
                        {booking.propertyName}
                      </Link>
                    ),
                  },
                  { label: "Room", value: booking.roomName },
                  { label: "Rate plan", value: booking.ratePlanName },
                  {
                    label: "Party",
                    value: `${booking.adults} adults${
                      booking.children > 0 ? `, ${booking.children} children` : ""
                    }`,
                  },
                  { label: "Source", value: booking.source },
                  { label: "Check-in", value: formatDate(booking.checkIn) },
                  { label: "Check-out", value: formatDate(booking.checkOut) },
                ]}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Money
              </h3>
              <DescriptionList
                columns={2}
                items={[
                  { label: "Total", value: formatCurrency(booking.total) },
                  {
                    label: "Refunded",
                    value:
                      booking.refundAmount === null
                        ? "—"
                        : formatCurrency(booking.refundAmount),
                  },
                  { label: "Refund status", value: booking.refundStatus ?? "—" },
                ]}
              />
            </section>

            {booking.cancelledAt ? (
              <section className="space-y-3">
                <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Cancellation
                </h3>
                <DescriptionList
                  columns={2}
                  items={[
                    { label: "Cancelled", value: formatDate(booking.cancelledAt) },
                    { label: "By", value: booking.cancelledBy ?? "—" },
                    {
                      /* In the words whoever cancelled it typed. */
                      label: "Reason",
                      value: booking.cancellationReason || "—",
                    },
                  ]}
                />
              </section>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {refundable ? (
            <Button variant="destructive" onClick={() => onRefund(booking)}>
              Refund
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * A goodwill refund, over and above the guest's own terms (rule #76).
 *
 * This is not "cancel the booking". A partner cancels under the terms the
 * guest agreed to; the platform overrides those terms, which is why it needs a
 * reason with a floor — somebody reads this months later and has to understand
 * why money went back that the contract said would not.
 *
 * **The commission on a fully refunded booking is voided**, so this costs the
 * platform as well as the property. The dialog says so before anybody clicks.
 */
const schema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "Enter an amount.")
    .refine((v) => Number(v) > 0, "The amount must be above zero."),
  reason: z
    .string()
    .trim()
    .min(10, "Say why — this cannot be undone.")
    .max(2000, "Keep it under 2000 characters."),
})

type FormValues = z.infer<typeof schema>

export function RefundReservationDialog({
  booking,
  onClose,
}: {
  booking: AdminReservationRow | null
  onClose: () => void
}) {
  const refund = useRefundReservation()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "", reason: "" },
  })

  React.useEffect(() => {
    if (booking) {
      // Seeded with what is still refundable, which is the usual answer.
      const already = booking.refundAmount ?? 0
      form.reset({
        amount: String(Math.max(booking.total - already, 0) / 100),
        reason: "",
      })
    }
  }, [booking, form])

  if (!booking) return null

  const already = booking.refundAmount ?? 0
  const remaining = Math.max(booking.total - already, 0)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund {booking.ref}</DialogTitle>
          <DialogDescription>
            Over and above what the guest&rsquo;s rate plan promised. A full
            refund voids the platform&rsquo;s commission on this booking.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted space-y-1 rounded-lg px-3 py-2 text-sm">
          <p>
            Booking total{" "}
            <span className="font-medium">
              {formatCurrency(booking.total)}
            </span>
          </p>
          {already > 0 ? (
            <p className="text-muted-foreground">
              Already refunded {formatCurrency(already)} · at most{" "}
              {formatCurrency(remaining)} remaining
            </p>
          ) : null}
        </div>

        <Form {...form}>
          <form
            id="refund-form"
            onSubmit={form.handleSubmit((values) =>
              refund.mutate(
                {
                  bookingId: booking.id,
                  body: {
                    // Cents on the wire, dollars in the field.
                    amount: Math.round(Number(values.amount) * 100),
                    reason: values.reason,
                  },
                },
                { onSuccess: onClose }
              )
            )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (USD)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" min="0" step="0.01" />
                  </FormControl>
                  <FormDescription>
                    The server refuses more than the booking is worth.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Why is the platform refunding beyond the guest's terms?"
                    />
                  </FormControl>
                  <FormDescription>
                    Recorded in the audit log against your account.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={refund.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="refund-form"
            variant="destructive"
            disabled={refund.isPending}
          >
            {refund.isPending ? "Refunding…" : "Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
