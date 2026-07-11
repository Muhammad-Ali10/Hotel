"use client"

import * as React from "react"
import { toast } from "sonner"

import type { ReviewStatus } from "@/lib/extranet/types"
import { ActionButton, ConfirmDialog } from "@/components/extranet/shared"
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

export function ReviewActions({
  guest,
  status,
}: {
  guest: string
  status: ReviewStatus
}) {
  const [open, setOpen] = React.useState(false)
  const [reply, setReply] = React.useState("")

  const showModeration = status === "Pending"

  return (
    <div className="flex gap-2 pt-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="sm">Reply</Button>} />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reply to {guest}</DialogTitle>
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
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              disabled={!reply.trim()}
              onClick={() => {
                toast.success("Reply posted")
                setReply("")
                setOpen(false)
              }}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showModeration ? (
        <>
          <ActionButton
            variant="outline"
            size="sm"
            toastMessage="Review approved"
            toastType="success"
          >
            Approve
          </ActionButton>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm">
                Reject
              </Button>
            }
            title="Reject review"
            description="This review will be hidden from your public listings. This action cannot be undone."
            confirmLabel="Reject"
            destructive
            toastMessage="Review rejected"
          />
        </>
      ) : null}
    </div>
  )
}
