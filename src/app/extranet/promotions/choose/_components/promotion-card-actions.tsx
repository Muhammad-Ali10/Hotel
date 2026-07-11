"use client"

import type { PromotionTemplate } from "@/lib/extranet/types"
import { formatNumber } from "@/lib/format"
import { ConfirmDialog } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

/** Apply (confirm) + View Details (details dialog) actions for a template card. */
export function PromotionCardActions({
  template,
}: {
  template: PromotionTemplate
}) {
  return (
    <div className="mt-auto flex gap-2 pt-1">
      <ConfirmDialog
        trigger={
          <Button
            size="sm"
            className="flex-1"
            disabled={template.status === "Draft"}
          >
            Apply Promotion
          </Button>
        }
        title={`Apply ${template.name}?`}
        description={`This activates the ${template.discount} ${template.name} promotion for eligible bookings.`}
        confirmLabel="Apply Promotion"
        toastMessage="Promotion applied"
      />

      <Dialog>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm">
              View Details
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{template.name}</DialogTitle>
            <DialogDescription>
              {template.discount} · {template.status}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <Row label="Type" value={template.type} />
            <Row label="Discount" value={template.discount} />
            <Row label="Min stay" value={template.minStay} />
            <Row label="Booking window" value={template.bookingWindow} />
            <Row label="Validity" value={template.validity} />
            <Row
              label="Used in"
              value={`${formatNumber(template.uses)} bookings`}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
