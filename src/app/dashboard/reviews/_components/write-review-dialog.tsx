"use client"

import * as React from "react"
import { Star } from "lucide-react"
import { toast } from "sonner"

import type { Booking, ReviewCategories } from "@/types"
import { REVIEW_CATEGORIES } from "@/types"
import { cn } from "@/lib/utils"
import { useStore } from "@/store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

const emptyCategories: ReviewCategories = {
  cleanliness: 0,
  comfort: 0,
  location: 0,
  facilities: 0,
  staff: 0,
}

/**
 * The review form. The product displayed guest ratings, category breakdown bars
 * and partner replies from day one, but had no way for a guest to write any of
 * it — this is the missing half of that loop.
 */
export function WriteReviewDialog({
  booking,
  open,
  onOpenChange,
}: {
  booking: Booking
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const addReview = useStore((s) => s.addReview)
  const [rating, setRating] = React.useState(0)
  const [categories, setCategories] = React.useState<ReviewCategories>(emptyCategories)
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")

  function reset() {
    setRating(0)
    setCategories(emptyCategories)
    setTitle("")
    setBody("")
  }

  function submit() {
    if (rating === 0) {
      toast.error("Please choose an overall rating.")
      return
    }
    if (!title.trim() || !body.trim()) {
      toast.error("Please add a title and tell us about your stay.")
      return
    }

    addReview({
      hotelId: booking.hotelId,
      bookingId: booking.id,
      rating,
      // An unrated category falls back to the overall score, so the hotel's
      // category bars never average in a zero.
      categories: Object.fromEntries(
        REVIEW_CATEGORIES.map(({ key }) => [key, categories[key] || rating])
      ) as ReviewCategories,
      title: title.trim(),
      body: body.trim(),
      roomName: booking.roomName,
    })

    toast.success("Thanks — your review is now live on the hotel's page.")
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review {booking.hotelName}</DialogTitle>
          <DialogDescription>
            {booking.roomName} · {booking.checkIn} → {booking.checkOut}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Overall rating</Label>
            <StarInput value={rating} onChange={setRating} size="size-7" />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Rate the details</Label>
            {REVIEW_CATEGORIES.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground text-sm">{label}</span>
                <StarInput
                  value={categories[key]}
                  onChange={(v) => setCategories((c) => ({ ...c, [key]: v }))}
                  label={label}
                />
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="review-title">Title</Label>
            <Input
              id="review-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sum up your stay in a few words"
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-body">Your review</Label>
            <Textarea
              id="review-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="What stood out? What would you tell a friend?"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Publish review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StarInput({
  value,
  onChange,
  label,
  size = "size-5",
}: {
  value: number
  onChange: (value: number) => void
  label?: string
  size?: string
}) {
  const [hover, setHover] = React.useState(0)
  const shown = hover || value

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={label ? `${label}: ${n} of 5` : `${n} of 5 stars`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="cursor-pointer p-0.5"
        >
          <Star
            className={cn(
              size,
              "transition-colors",
              n <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  )
}
