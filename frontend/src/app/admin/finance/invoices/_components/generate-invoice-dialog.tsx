"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Receipt } from "lucide-react"

import { useRunInvoices } from "@/lib/admin/api/hooks"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
 * Billing a month's commission across every client on `invoice` settlement.
 *
 * The Figma's dialog ended on "Preview Invoice" with no preview screen behind
 * it, and the mock grew one: a computed preview for a single client, then an
 * issue step. Neither matches what the API does, and what it does is better —
 * one run bills every organisation that settles by invoice, for one period,
 * from the bookings actually in it.
 *
 * **It is idempotent by period.** Running August twice does not bill anybody
 * twice; the second run reports what it skipped. That is worth saying on the
 * dialog, because "did that go through?" is the reason somebody would press it
 * again.
 */
const schema = z
  .object({
    periodStart: z.string().min(1, "Pick a start date."),
    periodEnd: z.string().min(1, "Pick an end date."),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: "The period cannot end before it starts.",
    path: ["periodEnd"],
  })

type FormValues = z.infer<typeof schema>

/** The month just gone, which is what this is almost always run for. */
function lastMonth() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`
  return { periodStart: iso(start), periodEnd: iso(end) }
}

export function GenerateInvoiceDialog() {
  const [open, setOpen] = React.useState(false)
  const run = useRunInvoices()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: lastMonth(),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) form.reset(lastMonth())
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm">
            <Receipt className="size-4" />
            Run invoicing
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Run invoicing for a period</DialogTitle>
          <DialogDescription>
            Bills commission to every client who settles by invoice, from the
            bookings inside the period.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="run-invoices-form"
            onSubmit={form.handleSubmit((values) =>
              run.mutate(values, { onSuccess: () => setOpen(false) })
            )}
            className="grid grid-cols-2 gap-4"
          >
            <FormField
              control={form.control}
              name="periodStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="periodEnd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormDescription className="col-span-2">
              Safe to run twice — a period already invoiced is skipped, and the
              result says how many.
            </FormDescription>
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={run.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="run-invoices-form" disabled={run.isPending}>
            {run.isPending ? "Running…" : "Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
