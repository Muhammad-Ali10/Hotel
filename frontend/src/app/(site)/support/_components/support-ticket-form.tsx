"use client"

import * as React from "react"
import { toast } from "sonner"

import { useOpenTicket, useSession } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

/**
 * The categories the API accepts. Not a longer list of nicer words.
 *
 * A category the server refuses is a form that fails on submit for a reason
 * nobody can see, so these are the enum's own values with human labels beside
 * them — the mock offered six different ones, including "Rewards & Loyalty",
 * a programme this product does not have.
 */
const CATEGORIES = [
  { value: "booking", label: "A booking or reservation" },
  { value: "cancellation", label: "Cancelling or changing a stay" },
  { value: "billing", label: "Payment or a refund" },
  { value: "account", label: "My account or profile" },
  { value: "technical", label: "Something is broken" },
  { value: "general", label: "Something else" },
]

const MESSAGE_MAX = 2000

/**
 * Opening a ticket with Stayora. **Public — no session needed** (rule #85).
 *
 * The single most common thing support is asked is "I cannot sign in", and a
 * help desk behind a login turns that into a closed loop. So the name and the
 * email are fields, pre-filled for somebody signed in and typed by everybody
 * else.
 *
 * **There is no priority picker.** The old form had one, and the API refuses
 * it: priority is the platform's judgement about its own queue, and letting
 * the person waiting set it is how every ticket becomes urgent.
 */
export function SupportTicketForm() {
  const session = useSession()
  const open = useOpenTicket()

  /*
   * The draft holds only what has been typed.
   *
   * Name and email read through to the session until somebody edits them, so a
   * profile that loads a moment later fills the form rather than being
   * overwritten by an effect that ran first.
   */
  const [draft, setDraft] = React.useState<Record<string, string>>({})
  const value = (key: string, fallback = "") => draft[key] ?? fallback

  const signedInName = session.data
    ? `${session.data.firstName} ${session.data.lastName}`.trim()
    : ""

  const name = value("name", signedInName)
  const email = value("email", session.data?.email ?? "")
  const category = value("category")
  const subject = value("subject")
  const body = value("body")

  const charsLeft = MESSAGE_MAX - body.length

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!category) {
      toast.error("Choose what this is about.")
      return
    }
    if (subject.trim().length < 3) {
      toast.error("Give it a subject of at least three characters.")
      return
    }
    if (!email.includes("@")) {
      toast.error("We need an email address to reply to.")
      return
    }

    open.mutate(
      {
        subject: subject.trim(),
        category,
        body: body.trim(),
        email: email.trim(),
        name: name.trim(),
      },
      {
        onSuccess: (ticket) => {
          toast.success(`Ticket ${ticket.ref} opened`, {
            description: "We reply by email, and you can follow it below.",
          })
          setDraft((d) => ({ ...d, category: "", subject: "", body: "" }))
        },
        onError: (error) => toast.error(error.message),
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ticket-name">Your name *</Label>
          <Input
            id="ticket-name"
            value={name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Who we are replying to"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ticket-email">Email *</Label>
          <Input
            id="ticket-email"
            type="email"
            value={email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            placeholder="Where we send the reply"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-category">What is it about *</Label>
        <Select
          items={CATEGORIES}
          value={category}
          onValueChange={(v) => setDraft((d) => ({ ...d, category: String(v) }))}
        >
          <SelectTrigger id="ticket-category" className="w-full">
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-subject">Subject *</Label>
        <Input
          id="ticket-subject"
          value={subject}
          onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
          placeholder="One line — what went wrong"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="ticket-message">Tell us more *</Label>
          <span className="text-muted-foreground text-xs">{charsLeft} left</span>
        </div>
        <Textarea
          id="ticket-message"
          rows={5}
          value={body}
          maxLength={MESSAGE_MAX}
          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          placeholder="Dates, booking references, and what you expected instead."
        />
      </div>

      <Button type="submit" disabled={open.isPending}>
        {open.isPending ? "Opening…" : "Open a ticket"}
      </Button>

      <p className="text-muted-foreground text-xs">
        You do not need an account to write to us — that is deliberate, because
        &ldquo;I cannot sign in&rdquo; is the most common thing we are asked.
      </p>
    </form>
  )
}
