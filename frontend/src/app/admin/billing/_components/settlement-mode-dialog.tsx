"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { useSetSettlementMode } from "@/lib/admin/api/hooks"
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
import { Textarea } from "@/components/ui/textarea"

/**
 * Moving a client between deduct and invoice terms (rules #91, #92).
 *
 * A reason is required, and the ten-character floor is the server's own — so a
 * reason it would refuse is caught before anybody clicks. This is not a detail
 * of a partner's profile: it decides where the platform's money sits between
 * the booking and the payout, and granting invoice terms means being owed by
 * somebody for a month.
 */
const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Say why — this changes where the platform's money sits.")
    .max(2000, "Keep it under 2000 characters."),
})

type FormValues = z.infer<typeof schema>

const COPY = {
  invoice: {
    title: "Bill monthly instead",
    description:
      "They are paid in full and invoiced at month end. An unpaid invoice holds their payouts — their listings stay up, because a guest who booked has done nothing wrong.",
    confirm: "Switch to invoice",
    placeholder: "e.g. Long-standing client, agreed 30-day terms with finance",
  },
  deduct: {
    title: "Take commission off payouts",
    description:
      "Every future settlement is paid net of commission, so the platform is never owed. Invoices already issued still stand.",
    confirm: "Switch to deduct",
    placeholder: "e.g. Two invoices went unpaid past their due date",
  },
} as const

export function SettlementModeDialog({
  pending,
  onClose,
}: {
  pending: { orgId: string; orgName: string; mode: "deduct" | "invoice" } | null
  onClose: () => void
}) {
  const setMode = useSetSettlementMode()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "" },
  })

  React.useEffect(() => {
    if (pending) form.reset({ reason: "" })
  }, [pending, form])

  if (!pending) return null

  const copy = COPY[pending.mode]

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {copy.title} — {pending.orgName}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="settlement-mode-form"
            onSubmit={form.handleSubmit((values) =>
              setMode.mutate(
                {
                  orgId: pending.orgId,
                  mode: pending.mode,
                  reason: values.reason,
                },
                { onSuccess: onClose }
              )
            )}
          >
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder={copy.placeholder} />
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
          <Button variant="outline" onClick={onClose} disabled={setMode.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="settlement-mode-form"
            disabled={setMode.isPending}
          >
            {setMode.isPending ? "Saving…" : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
