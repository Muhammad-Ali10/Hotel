"use client"

import * as React from "react"
import { toast } from "sonner"

import type { Review } from "@/types"
import { useStore } from "@/store"
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

/** Every action here writes to the shared review — the buttons used to fire a
 *  toast and leave the review exactly as it was. */
export function ReviewActions({ review }: { review: Review }) {
  const replyToReview = useStore((s) => s.replyToReview)
  const setReviewStatus = useStore((s) => s.setReviewStatus)
  const [open, setOpen] = React.useState(false)
  const [reply, setReply] = React.useState(review.response?.text ?? "")

  const needsModeration = review.status === "pending" || review.status === "flagged"

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant={review.response ? "outline" : "default"}>
              {review.response ? "Edit reply" : "Reply"}
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reply to {review.author}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="review-reply">Your response</Label>
            <Textarea
              id="review-reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a public response to this review…"
              className="min-h-28"
            />
            <p className="text-muted-foreground text-xs">
              This appears publicly under the review on your hotel page.
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              disabled={!reply.trim()}
              onClick={() => {
                replyToReview(review.id, reply.trim())
                toast.success("Reply posted — it's now live on your hotel page.")
                setOpen(false)
              }}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {needsModeration ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setReviewStatus(review.id, "published")
              toast.success("Review approved — it's now visible to guests.")
            }}
          >
            Approve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setReviewStatus(review.id, "rejected")
              toast.success("Review rejected — it's hidden from your listing.")
            }}
          >
            Reject
          </Button>
        </>
      ) : null}

      {review.status === "published" ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setReviewStatus(review.id, "flagged")
            toast.success("Review flagged for moderation.")
          }}
        >
          Flag
        </Button>
      ) : null}
    </div>
  )
}
