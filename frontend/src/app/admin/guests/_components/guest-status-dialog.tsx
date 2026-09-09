"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import type { AdminUserRow } from "@/lib/admin/api/endpoints"
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
 * confirmation and no reason capture. Every status change requires a reason,
 * which is what lands in the audit log.
 *
 * **There is no "Block".** The mock had three states — Active, Suspended,
 * Blocked — and the product has two. A third that no endpoint accepts is a
 * button that fails, and worse: an operator who "blocked" somebody would
 * believe that account could not sign in, when nothing had changed at all.
 * Suspension is the one lever, and it is the one described here.
 *
 * The floor of ten characters mirrors the API's own, so a reason the server
 * would reject is caught before anybody clicks.
 */
const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Give at least 10 characters so the audit trail is useful.")
    .max(280, "Keep the reason under 280 characters."),
})

type FormValues = z.infer<typeof schema>

export type UserStatus = "active" | "suspended"

const COPY: Record<
  UserStatus,
  { title: string; description: string; confirm: string; destructive: boolean }
> = {
  suspended: {
    title: "Suspend account",
    description:
      "They keep existing reservations but cannot sign in or book again.",
    confirm: "Suspend",
    destructive: true,
  },
  active: {
    title: "Restore account",
    description: "Sign-in and booking are available again immediately.",
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
  pending: { users: AdminUserRow[]; next: UserStatus } | null
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
  const count = pending.users.length
  const first = pending.users[0]
  const subject =
    count === 1 && first
      ? `${first.firstName} ${first.lastName}`
      : `${count} selected accounts`

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
