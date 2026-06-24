"use client"

import * as React from "react"
import { Send } from "lucide-react"
import { toast } from "sonner"

import { hotels } from "@/data"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PRIORITIES = ["Low", "Medium", "High", "Urgent"]
const MAX = 500

export function SupportForms() {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <SupportTicketForm />
      <HotelMessageForm />
    </section>
  )
}

function SupportTicketForm() {
  const [priority, setPriority] = React.useState("Medium")
  const [message, setMessage] = React.useState("")

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    toast.success("Support ticket submitted", {
      description: "Our team will respond within 24 hours.",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">
          Submit a Support Ticket
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Our admin team will respond within 24 hours
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name *">
              <Input defaultValue="John Doe" required />
            </Field>
            <Field label="Email Address *">
              <Input type="email" defaultValue="john.doe@example.com" required />
            </Field>
          </div>

          <Field label="Category *">
            <Select defaultValue="general">
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Inquiry</SelectItem>
                <SelectItem value="booking">Booking Issue</SelectItem>
                <SelectItem value="payment">Payment &amp; Refund</SelectItem>
                <SelectItem value="technical">Technical Problem</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <Chip
                  key={p}
                  selected={priority === p}
                  onClick={() => setPriority(p)}
                >
                  {p}
                </Chip>
              ))}
            </div>
          </div>

          <Field label="Subject *">
            <Input placeholder="Brief description of your issue" required />
          </Field>

          <Field label={`Message * (${MAX - message.length} chars left)`}>
            <Textarea
              maxLength={MAX}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue in detail..."
              className="min-h-28"
            />
          </Field>

          <Button type="submit">
            <Send className="size-4" />
            Submit Ticket
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function HotelMessageForm() {
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    toast.success("Message sent", {
      description: "The hotel will get back to you shortly.",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Message a Hotel</CardTitle>
        <p className="text-muted-foreground text-sm">
          Contact a hotel directly about your stay
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Select Hotel *">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Choose a hotel" />
              </SelectTrigger>
              <SelectContent>
                {hotels.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name} — {h.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Booking ID (optional)">
            <Input placeholder="e.g. LXS-2026-00123" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your Name *">
              <Input defaultValue="John Doe" required />
            </Field>
            <Field label="Email Address *">
              <Input type="email" defaultValue="john.doe@example.com" required />
            </Field>
          </div>

          <Field label="Topic *">
            <Select defaultValue="booking">
              <SelectTrigger>
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="booking">Booking Question</SelectItem>
                <SelectItem value="amenities">Amenities &amp; Services</SelectItem>
                <SelectItem value="request">Special Request</SelectItem>
                <SelectItem value="complaint">Complaint</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Message *">
            <Textarea
              placeholder="Write your message to the hotel..."
              className="min-h-28"
            />
          </Field>

          <Button type="submit">
            <Send className="size-4" />
            Send Message
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm transition-colors",
        selected
          ? "bg-primary text-primary-foreground border-transparent"
          : "bg-muted text-muted-foreground hover:text-foreground border-transparent"
      )}
    >
      {children}
    </button>
  )
}
