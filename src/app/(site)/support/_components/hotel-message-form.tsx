"use client"

import * as React from "react"
import { toast } from "sonner"

import { hotels } from "@/data"
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

const topics = [
  "Room amenities",
  "Special requests",
  "Early check-in / late check-out",
  "Accessibility",
  "Billing question",
  "Other",
]

const MESSAGE_MAX = 500

export function HotelMessageForm() {
  const [message, setMessage] = React.useState("")
  const charsLeft = MESSAGE_MAX - message.length

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    toast.success("Message sent to the hotel. They'll reply to your email shortly.")
    e.currentTarget.reset()
    setMessage("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="hotel-select">Select Hotel *</Label>
        <Select name="hotel" required>
          <SelectTrigger id="hotel-select" className="w-full">
            <SelectValue placeholder="Choose a hotel" />
          </SelectTrigger>
          <SelectContent>
            {hotels.map((hotel) => (
              <SelectItem key={hotel.id} value={hotel.id}>
                {hotel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hotel-booking">Booking ID (optional)</Label>
          <Input
            id="hotel-booking"
            name="bookingId"
            placeholder="e.g. STY-2026-00123"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hotel-topic">Topic *</Label>
          <Select name="topic" required>
            <SelectTrigger id="hotel-topic" className="w-full">
              <SelectValue placeholder="Select topic" />
            </SelectTrigger>
            <SelectContent>
              {topics.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hotel-name">Your Name *</Label>
          <Input id="hotel-name" name="name" placeholder="John Doe" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hotel-email">Email Address *</Label>
          <Input
            id="hotel-email"
            name="email"
            type="email"
            placeholder="john@example.com"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="hotel-message">Message *</Label>
          <span className="text-muted-foreground text-xs">
            {charsLeft} chars left
          </span>
        </div>
        <Textarea
          id="hotel-message"
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
          maxLength={MESSAGE_MAX}
          placeholder="Write your message to the hotel..."
          className="min-h-28"
          required
        />
      </div>

      <Button type="submit" className="w-full">
        Send Message
      </Button>
    </form>
  )
}
