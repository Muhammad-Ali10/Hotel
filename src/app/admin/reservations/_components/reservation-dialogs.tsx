"use client"

import * as React from "react"
import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { formatDate } from "@/lib/format"
import { clientById, propertyById, propertyName } from "@/data/admin"
import type { Cancellation, Reservation } from "@/lib/admin/types"
import { useCancelReservation, useReservation } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import { DescriptionList, Money, StatusPill } from "@/components/admin/shared"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

/** Read-only reservation detail. */
export function ReservationDetailDialog({
  id,
  onClose,
  onCancelRequest,
}: {
  id: string | null
  onClose: () => void
  onCancelRequest: (reservation: Reservation) => void
}) {
  const can = useCan()
  const { data: reservation, isLoading } = useReservation(id)

  const property = reservation ? propertyById(reservation.propertyId) : undefined
  const client = property ? clientById(property.clientId) : undefined
  const cancellable =
    reservation &&
    !["Cancelled", "Checked Out"].includes(reservation.status) &&
    can.do("reservation.cancel")

  return (
    <Dialog
      open={id !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Reservation details</DialogTitle>
          <DialogDescription>
            {reservation
              ? `${reservation.id} · created ${formatDate(reservation.createdAt)}`
              : "Loading reservation…"}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !reservation ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <StatusPill status={reservation.status} />

            <section className="space-y-3">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Guest &amp; property
              </h3>
              <DescriptionList
                columns={2}
                items={[
                  { label: "Guest", value: reservation.guestName },
                  { label: "Email", value: reservation.guestEmail },
                  { label: "Phone", value: reservation.guestPhone },
                  {
                    label: "Property",
                    value: property ? (
                      <Link
                        href={`/admin/properties/${property.id}`}
                        className="hover:text-primary underline-offset-2 hover:underline"
                      >
                        {property.name}
                      </Link>
                    ) : (
                      propertyName(reservation.propertyId)
                    ),
                  },
                  { label: "Client", value: client?.name ?? "—" },
                  { label: "Room", value: reservation.room },
                  {
                    label: "Guests / source",
                    value: `${reservation.guests} · ${reservation.source}`,
                  },
                  { label: "Check-in", value: formatDate(reservation.checkIn) },
                  { label: "Check-out", value: formatDate(reservation.checkOut) },
                ]}
              />
            </section>

            <section className="space-y-3 border-t pt-4">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Payment
              </h3>
              <DescriptionList
                columns={2}
                items={[
                  {
                    label: "Total",
                    value: <Money value={reservation.total} />,
                  },
                  { label: "Method", value: reservation.paymentMethod },
                ]}
              />
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {cancellable ? (
            <Button
              variant="destructive"
              onClick={() => {
                onClose()
                onCancelRequest(reservation)
              }}
            >
              Cancel reservation
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const REASONS: Cancellation["reason"][] = [
  "Guest request",
  "Payment failed",
  "Property closure",
  "Overbooking",
  "No-show",
  "Suspected fraud",
]

const REASON_ITEMS = REASONS.map((reason) => ({ label: reason, value: reason }))

const cancelSchema = z.object({
  reason: z.enum(REASONS, { message: "Choose a cancellation reason." }),
  note: z
    .string()
    .trim()
    .min(10, "Add at least 10 characters of context.")
    .max(280, "Keep the note under 280 characters."),
})

type CancelValues = z.infer<typeof cancelSchema>

/**
 * The Figma's row-level "Cancel" was a bare link with no confirmation and no
 * refund/reason capture, and its detail modal offered no cancel path at all.
 */
export function CancelReservationDialog({
  reservation,
  onClose,
}: {
  reservation: Reservation | null
  onClose: () => void
}) {
  if (!reservation) return null
  // Keyed so each reservation gets a fresh form — no reset effect needed.
  return (
    <CancelReservationForm
      key={reservation.id}
      reservation={reservation}
      onClose={onClose}
    />
  )
}

function CancelReservationForm({
  reservation,
  onClose,
}: {
  reservation: Reservation
  onClose: () => void
}) {
  const cancel = useCancelReservation()
  const form = useForm<CancelValues>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { reason: "Guest request", note: "" },
  })

  // `useWatch` rather than `form.watch()`: the latter makes the React Compiler
  // skip the whole component.
  const reason = useWatch({ control: form.control, name: "reason" })
  const refundsFully = reason === "Guest request"

  function onSubmit(values: CancelValues) {
    cancel.mutate(
      { id: reservation.id, reason: values.reason, note: values.note },
      { onSuccess: onClose }
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel {reservation.id}</DialogTitle>
          <DialogDescription>
            {reservation.guestName} at {propertyName(reservation.propertyId)},{" "}
            {formatDate(reservation.checkIn)} – {formatDate(reservation.checkOut)}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="cancel-reservation-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select
                    items={REASON_ITEMS}
                    value={field.value}
                    onValueChange={(value) => field.onChange(String(value))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REASON_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-muted rounded-lg px-3 py-2.5 text-sm">
              <p className="font-medium">
                Refund:{" "}
                {refundsFully ? (
                  <>
                    full — <Money value={reservation.total} />
                  </>
                ) : (
                  "none"
                )}
              </p>
              <p className="text-muted-foreground text-xs">
                Guest-requested cancellations inside the free window are refunded
                in full. All other reasons follow the property&rsquo;s policy.
              </p>
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal note</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Context for the property and the audit trail"
                    />
                  </FormControl>
                  <FormDescription>
                    Visible to the property and recorded in the audit log.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={cancel.isPending}>
            Keep reservation
          </Button>
          <Button
            type="submit"
            form="cancel-reservation-form"
            variant="destructive"
            disabled={cancel.isPending}
          >
            {cancel.isPending ? "Cancelling…" : "Cancel reservation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
