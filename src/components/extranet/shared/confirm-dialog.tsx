"use client"

import * as React from "react"
import { toast } from "sonner"

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

/**
 * A reusable confirmation dialog for destructive / one-off actions across the
 * extranet (Deactivate, Delete, Disconnect, Sign Out, Dismiss, Request Payout…).
 * Pass the trigger button via `trigger`; on confirm it runs `onConfirm` and
 * (optionally) shows a success toast. Extra body content (e.g. a reason field)
 * can be passed as `children`.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  toastMessage,
  onConfirm,
  children,
}: {
  trigger: React.ReactElement
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  toastMessage?: string
  onConfirm?: () => void
  children?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {cancelLabel}
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              onConfirm?.()
              if (toastMessage) toast.success(toastMessage)
              setOpen(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
