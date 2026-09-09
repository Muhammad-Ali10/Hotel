"use client"

import * as React from "react"
import { toast } from "sonner"

import type { ReviewDto } from "@/lib/api/endpoints"
import { useFlagReview, useRespondToReview } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

/**
 * What a property may do about a review (rule #40).
 *
 * Two things, and **moderating is not one of them**. This screen used to offer
 * Approve and Reject: a hotel could hide a guest's opinion of itself, which is
 * the one power a review system cannot give the reviewed.
 *
 * What it can do is OBJECT. Flagging pulls the review off the public site at
 * once — that is the safety valve that makes publishing immediately safe — and
 * then a platform admin decides. A reason is required and has a floor, because
 * "this is unfair" is not something anybody can adjudicate.
 */
export function ReviewActions({ review }: { review: ReviewDto }) {
  const respond = useRespondToReview()
  const flag = useFlagReview()

  const [replyOpen, setReplyOpen] = React.useState(false)
  const [flagOpen, setFlagOpen] = React.useState(false)
  const [reply, setReply] = React.useState(review.response?.text ?? "")
  const [reason, setReason] = React.useState("")

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
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
              disabled={!reply.trim() || respond.isPending}
              onClick={() =>
                respond.mutate(
                  { id: review.id, text: reply.trim() },
                  {
                    onSuccess: () => {
                      toast.success("Reply posted — it's now live on your hotel page.")
                      setReplyOpen(false)
                    },
                    onError: (e) => toast.error(e.message),
                  }
                )
              }
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {review.status === "published" ? (
        <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
          <DialogTrigger render={<Button variant="ghost" size="sm">Flag</Button>} />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Object to this review</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="flag-reason">Why should this be looked at?</Label>
              <Textarea
                id="flag-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="It describes a stay at a different property…"
                className="min-h-24"
              />
              <p className="text-muted-foreground text-xs">
                It comes off your public page straight away, and a Stayora
                moderator decides. Your reason is not shown to the guest.
              </p>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button
                variant="destructive"
                disabled={reason.trim().length < 10 || flag.isPending}
                onClick={() =>
                  flag.mutate(
                    { id: review.id, reason: reason.trim() },
                    {
                      onSuccess: () => {
                        toast.success("Flagged — a moderator will look at it.")
                        setReason("")
                        setFlagOpen(false)
                      },
                      onError: (e) => toast.error(e.message),
                    }
                  )
                }
              >
                Flag for review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
