"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { guestCommunications } from "@/data/extranet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const guests = guestCommunications.map((g) => g.guest)
const channels = ["Direct", "Booking.com", "Expedia", "Travel Agency", "Email"]

export function NewMessageDialog() {
  const [open, setOpen] = React.useState(false)
  const [guest, setGuest] = React.useState(guests[0])
  const [channel, setChannel] = React.useState(channels[0])
  const [message, setMessage] = React.useState("")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            New Message
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Guest</Label>
            <Select value={guest} onValueChange={(v) => setGuest(String(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {guests.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select
              value={channel}
              onValueChange={(v) => setChannel(String(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {channels.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-message-body">Message</Label>
            <Textarea
              id="new-message-body"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message…"
              className="min-h-28"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            disabled={!message.trim()}
            onClick={() => {
              toast.success("Message sent")
              setMessage("")
              setOpen(false)
            }}
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
