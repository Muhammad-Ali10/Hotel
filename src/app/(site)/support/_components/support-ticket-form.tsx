"use client"

import * as React from "react"
import { toast } from "sonner"

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
import { cn } from "@/lib/utils"

const categories = [
  "Booking & Reservations",
  "Payments & Billing",
  "Account & Profile",
  "Cancellations & Changes",
  "Rewards & Loyalty",
  "Other",
]

const priorities = ["Low", "Medium", "High", "Urgent"] as const

const MESSAGE_MAX = 500

export function SupportTicketForm() {
  const [priority, setPriority] =
    React.useState<(typeof priorities)[number]>("Medium")
  const [message, setMessage] = React.useState("")
  const charsLeft = MESSAGE_MAX - message.length

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    toast.success("Support ticket submitted. We'll get back to you within 24 hours.")
    e.currentTarget.reset()
    setMessage("")
    setPriority("Medium")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ticket-name">Full Name *</Label>
          <Input id="ticket-name" name="name" placeholder="John Doe" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ticket-email">Email Address *</Label>
          <Input
            id="ticket-email"
            name="email"
            type="email"
            placeholder="john@example.com"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ticket-category">Category *</Label>
          <Select name="category" required>
            <SelectTrigger id="ticket-category" className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <div className="flex flex-wrap gap-2">
            {priorities.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                aria-pressed={priority === p}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  priority === p
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-subject">Subject *</Label>
        <Input
          id="ticket-subject"
          name="subject"
          placeholder="Brief description of your issue"
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="ticket-message">Message *</Label>
          <span className="text-muted-foreground text-xs">
            {charsLeft} chars left
          </span>
        </div>
        <Textarea
          id="ticket-message"
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
          maxLength={MESSAGE_MAX}
          placeholder="Describe your issue in detail..."
          className="min-h-28"
          required
        />
      </div>

      <Button type="submit" className="w-full">
        Submit Ticket
      </Button>
    </form>
  )
}
