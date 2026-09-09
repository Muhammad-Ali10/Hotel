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
 * Suspending an account, or restoring one (rule #79).
 *
 * The ten-character floor mirrors the API's own, so a reason the server would
 * refuse is caught before anybody clicks. Somebody locked out will ask why,
 * and "an admin did it in March" is not an answer they can act on.
 */
const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Give at least 10 characters so the audit trail is useful.")
    .max(280, "Keep the reason under 280 characters."),
})

type FormValues = z.infer<typeof schema>

const COPY = {
  suspended: {
    title: "Suspend account",
    description:
      "They are signed out and cannot sign in again until restored. Anything they already booked or manage is untouched.",
    confirm: "Suspend",
    destructive: true,
  },
  active: {
    title: "Restore account",
    description: "Sign-in is available again immediately.",
    confirm: "Restore",
    destructive: false,
  },
} as const

export function UserStatusDialog({
  pending,
  onClose,
  onConfirm,
  isSubmitting,
}: {
  pending: { user: AdminUserRow; next: "active" | "suspended" } | null
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
  const name =
    `${pending.user.firstName} ${pending.user.lastName}`.trim() ||
    pending.user.email

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
            id="user-status-form"
            onSubmit={form.handleSubmit((values) => onConfirm(values.reason))}
            className="space-y-4"
          >
            <p className="bg-muted rounded-lg px-3 py-2 text-sm">
              Applying to <span className="font-medium">{name}</span>
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
            form="user-status-form"
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
