"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { usePartnerTicketActions } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
 * The categories the API accepts. Not a longer list of nicer words.
 *
 * A category the server refuses is a form that fails on submit for a reason
 * nobody can see, so these are the enum's own values with human labels beside
 * them rather than beside a mapping that has to be kept in step.
 */
const CATEGORIES: { value: string; label: string }[] = [
  { value: "general", label: "Something else" },
  { value: "connectivity", label: "Channel manager / connectivity" },
  { value: "finance", label: "Payouts, invoices, commission" },
  { value: "booking", label: "A specific booking" },
  { value: "content", label: "Listing content or photos" },
  { value: "guests", label: "A guest or a review" },
  { value: "technical", label: "Something is broken" },
]

/**
 * Opening a ticket with the platform.
 *
 * This is the PROPERTY writing to Stayora — not a guest, and not a note on a
 * booking. The old dialog was called "Generate Ticket", collected a priority
 * and an assignee, and toasted; the API sets neither. Priority is the
 * platform's judgement about its own queue, and letting a partner set it is
 * how every ticket becomes urgent.
 */
export function GenerateTicketDialog() {
  const [open, setOpen] = React.useState(false)
  const { open: create } = usePartnerTicketActions()

  const [form, setForm] = React.useState({
    subject: "",
    category: "general",
    body: "",
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function submit() {
    const subject = form.subject.trim()
    const body = form.body.trim()

    if (subject.length < 3) {
      toast.error("Give it a subject of at least three characters.")
      return
    }
    if (body.length === 0) {
      toast.error("Say what you need.")
      return
    }

    create.mutate(
      { subject, category: form.category as never, body },
      {
        onSuccess: (thread) => {
          toast.success("Ticket opened", {
            description: `Reference ${thread.ref}. You will be notified when somebody replies.`,
          })
          setForm({ subject: "", category: "general", body: "" })
          setOpen(false)
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            New ticket
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ask Stayora</DialogTitle>
          <DialogDescription>
            For the platform, not for a guest. To answer a guest, reply on their
            booking instead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input
              id="ticket-subject"
              value={form.subject}
              onChange={(e) => set({ subject: e.target.value })}
              placeholder="e.g. A payout has not arrived"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-category">About</Label>
            <select
              id="ticket-category"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={form.category}
              onChange={(e) => set({ category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-body">What happened</Label>
            <Textarea
              id="ticket-body"
              rows={5}
              value={form.body}
              onChange={(e) => set({ body: e.target.value })}
              placeholder="Dates, references, and what you expected instead."
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Opening…" : "Open ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
