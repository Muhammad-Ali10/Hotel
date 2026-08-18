"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import type { Guest, GuestStatus } from "@/lib/admin/types"
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
 * The Figma had Suspend / Block / Restore as bare inline links with no
 * confirmation and no reason capture. Every status change now requires a
 * reason, which is what lands in the audit log.
 */
const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Give at least 10 characters so the audit trail is useful.")
    .max(280, "Keep the reason under 280 characters."),
})

type FormValues = z.infer<typeof schema>

const COPY: Record<
  GuestStatus,
  { title: string; description: string; confirm: string; destructive: boolean }
> = {
  Suspended: {
    title: "Suspend guest",
    description:
      "The guest keeps existing reservations but cannot make new bookings.",
    confirm: "Suspend",
    destructive: true,
  },
  Blocked: {
    title: "Block guest",
    description:
      "The guest cannot sign in or book. Use for fraud and abuse cases.",
    confirm: "Block",
    destructive: true,
  },
  Active: {
    title: "Restore guest",
    description: "Full access to booking and sign-in is restored immediately.",
    confirm: "Restore",
    destructive: false,
  },
}

export function GuestStatusDialog({
  pending,
  onClose,
  onConfirm,
  isSubmitting,
}: {
  pending: { guests: Guest[]; next: GuestStatus } | null
  onClose: () => void
  onConfirm: (reason: string) => void
  isSubmitting?: boolean
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "" },
  })

  // Clear the field each time the dialog opens for a new target.
  React.useEffect(() => {
    if (pending) form.reset({ reason: "" })
  }, [pending, form])

  if (!pending) return null

  const copy = COPY[pending.next]
  const count = pending.guests.length
  const subject =
    count === 1 ? pending.guests[0].name : `${count} selected guests`

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="guest-status-form"
            onSubmit={form.handleSubmit((values) => onConfirm(values.reason))}
            className="space-y-4"
          >
            <p className="bg-muted rounded-lg px-3 py-2 text-sm">
              Applying to <span className="font-medium">{subject}</span>
            </p>

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
                      placeholder="Why is this action being taken?"
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
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="guest-status-form"
            variant={copy.destructive ? "destructive" : "default"}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Working…" : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
