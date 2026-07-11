"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

type ToastType = "success" | "info" | "error" | "warning" | "message"

/**
 * A Button that surfaces a toast when clicked — used across the extranet for
 * fire-and-forget actions (Export, Download, Print, Sync, Request Payout…) so
 * no control is a dead end. Accepts all Button props plus the toast content.
 */
export function ActionButton({
  toastMessage,
  toastDescription,
  toastType = "success",
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & {
  toastMessage: string
  toastDescription?: string
  toastType?: ToastType
}) {
  return (
    <Button
      {...props}
      onClick={(e) => {
        onClick?.(e)
        const opts = toastDescription
          ? { description: toastDescription }
          : undefined
        if (toastType === "message") toast(toastMessage, opts)
        else toast[toastType](toastMessage, opts)
      }}
    />
  )
}
