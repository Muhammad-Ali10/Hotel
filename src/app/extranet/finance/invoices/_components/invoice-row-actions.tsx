"use client"

import * as React from "react"
import { MoreVertical } from "lucide-react"
import { toast } from "sonner"

import type { Invoice } from "@/lib/extranet/types"
import { formatCurrency, formatDate } from "@/lib/format"
import { StatusPill } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Per-row action menu for the invoices table. The table is server-rendered, so
 * the interactive menu, details dialog and reminder confirmation live here as a
 * client component (one instance per row). Dialog state is lifted out of the
 * dropdown so the portalled menu closing does not unmount the open dialog.
 */
export function InvoiceRowActions({ invoice }: { invoice: Invoice }) {
  const [viewOpen, setViewOpen] = React.useState(false)
  const [remindOpen, setRemindOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Invoice actions">
              <MoreVertical className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setViewOpen(true)}>
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => toast.info(`Downloading invoice ${invoice.id}…`)}
          >
            Download
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRemindOpen(true)}>
            Send Reminder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <InvoiceDetailsDialog
        invoice={invoice}
        open={viewOpen}
        onClose={() => setViewOpen(false)}
      />

      <Dialog open={remindOpen} onOpenChange={setRemindOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Payment Reminder</DialogTitle>
            <DialogDescription>
              Send a payment reminder to {invoice.property} for invoice{" "}
              {invoice.id} ({formatCurrency(invoice.total)})?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              onClick={() => {
                toast.success("Reminder sent")
                setRemindOpen(false)
              }}
            >
              Send Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function InvoiceDetailsDialog({
  invoice,
  open,
  onClose,
}: {
  invoice: Invoice
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>Invoice Details</DialogTitle>
            <StatusPill status={invoice.status} />
          </div>
          <DialogDescription>{invoice.id}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Invoice Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Property" value={invoice.property} />
              <Field label="Status" value={invoice.status} />
              <Field label="Issued" value={formatDate(invoice.issued)} />
              <Field label="Due" value={formatDate(invoice.due)} />
            </div>
          </section>

          <section className="space-y-3 border-t pt-4">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Amount
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">{formatCurrency(invoice.tax)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t pt-2">
                <span className="text-muted-foreground">Total</span>
                <span className="font-heading text-2xl font-semibold">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
