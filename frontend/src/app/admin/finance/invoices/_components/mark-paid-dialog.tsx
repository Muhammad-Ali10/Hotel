"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { formatCurrency, formatDate } from "@/lib/format"
import type { AdminInvoice } from "@/lib/admin/api/endpoints"
import { useMarkInvoicePaid } from "@/lib/admin/api/hooks"
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

/**
 * Reconciling a bank transfer.
 *
 * The note is where the reference goes — the transfer id, the date it landed,
 * whoever confirmed it. Six months later somebody will ask why this invoice
 * was cleared, and "an admin pressed the button" is not an answer.
 */
const schema = z.object({
  note: z
    .string()
    .trim()
    .min(3, "Reference the payment — a transfer id or a date.")
    .max(500, "Keep it under 500 characters."),
})

type FormValues = z.infer<typeof schema>

export function MarkPaidDialog({
  invoice,
  onClose,
}: {
  invoice: AdminInvoice | null
  onClose: () => void
}) {
  const markPaid = useMarkInvoicePaid()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { note: "" },
  })

  React.useEffect(() => {
    if (invoice) form.reset({ note: "" })
  }, [invoice, form])

  if (!invoice) return null

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark {invoice.ref} paid</DialogTitle>
          <DialogDescription>
            Only once the money has actually arrived. This releases the
            client&rsquo;s payouts if nothing else of theirs is outstanding.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted space-y-1 rounded-lg px-3 py-2 text-sm">
          <p>
            {invoice.orgName} ·{" "}
            <span className="font-medium">
              {formatCurrency(invoice.amount)}
            </span>
          </p>
          <p className="text-muted-foreground">
            {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)} ·
            due {formatDate(invoice.dueDate)}
          </p>
        </div>

        <Form {...form}>
          <form
            id="mark-paid-form"
            onSubmit={form.handleSubmit((values) =>
              markPaid.mutate(
                { invoiceId: invoice.id, note: values.note },
                { onSuccess: onClose }
              )
            )}
          >
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment reference</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. BACS 0293881, received 14 Aug" />
                  </FormControl>
                  <FormDescription>
                    Stored on the invoice, so the reconciliation is explainable
                    later.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={markPaid.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="mark-paid-form" disabled={markPaid.isPending}>
            {markPaid.isPending ? "Saving…" : "Mark paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
