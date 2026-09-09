"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CheckCircle2, PauseCircle, PlayCircle, RotateCcw, XCircle } from "lucide-react"

import type { AdminPropertyDetail } from "@/lib/admin/api/endpoints"
import { useDecideListing, useSuspendListing } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import { SectionCard, StatusPill } from "@/components/admin/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"

/**
 * The platform's verdict on a listing (rules #70–#72, #78).
 *
 * Two endpoints, not one state machine. `decision` moves a listing through
 * review; `suspension` takes a live one off the market and puts it back. They
 * are different acts with different consequences, and the old panel collapsed
 * them into a single "transition to X" that could not express either properly.
 *
 * Three behaviours here are the server's, and the copy says so rather than
 * letting somebody discover them:
 *
 *   - **approving a live listing publishes its waiting edit** and leaves it
 *     live. It is not a re-approval of the whole property.
 *   - **requesting changes on a LIVE listing keeps it live.** The approved
 *     version is still perfectly good; pulling it would punish guests for a
 *     partner's bad edit. Only a listing not yet published moves to
 *     `changes_requested`.
 *   - **either way the waiting edit is discarded**, so nothing half-approved
 *     is left to be published later by accident.
 *
 * The "Verification video" section is gone. It reported a status, an uploader,
 * an upload date and a duration for a walkthrough video, and none of it
 * existed: nothing uploads one, nothing stores one, and "a video is required
 * before approval" was a rule no code enforced.
 */

const noteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(15, "Explain the decision in at least 15 characters.")
    .max(500, "Keep the note under 500 characters."),
})

type NoteValues = z.infer<typeof noteSchema>

type PendingAction =
  | { kind: "decision"; decision: "request_changes" | "reject" }
  | { kind: "suspension"; action: "suspend" }

const ACTION_COPY = {
  request_changes: {
    title: "Request changes",
    confirm: "Send back",
    destructive: false,
    placeholder: "What needs to change before this can go live?",
    help: "The partner sees this note in their extranet. It is the only feedback they get.",
  },
  reject: {
    title: "Reject listing",
    confirm: "Reject",
    destructive: true,
    placeholder: "Why is this listing being rejected?",
    help: "The partner sees this note. A rejection with no reason is a support ticket, every time.",
  },
  suspend: {
    title: "Suspend listing",
    confirm: "Suspend",
    destructive: true,
    placeholder: "Why is this listing being taken off the market?",
    help: "Recorded in the audit log. Bookings already made are untouched.",
  },
} as const

const BANNER: Record<string, { tone: string; message: string }> = {
  draft: {
    tone: "bg-muted",
    message:
      "A draft. The partner has not submitted it, so there is nothing to decide yet.",
  },
  pending_review: {
    tone: "bg-amber-500/10",
    message: "Waiting on us. It is not visible to guests.",
  },
  active: {
    tone: "bg-emerald-500/10",
    message: "Live on the marketplace and accepting bookings.",
  },
  rejected: {
    tone: "bg-destructive/10",
    message: "Rejected. Not visible to guests.",
  },
  changes_requested: {
    tone: "bg-amber-500/10",
    message:
      "Sent back to the partner. It returns for review when they resubmit.",
  },
  suspended: {
    tone: "bg-destructive/10",
    message:
      "Suspended by the platform. Hidden from search and taking no new bookings.",
  },
}

export function ApprovalPanel({ property }: { property: AdminPropertyDetail }) {
  const can = useCan()
  const decide = useDecideListing()
  const suspend = useSuspendListing()
  const [pending, setPending] = React.useState<PendingAction | null>(null)

  const form = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { note: "" },
  })

  React.useEffect(() => {
    if (pending) form.reset({ note: "" })
  }, [pending, form])

  const canApprove = can.do("property.approve")
  const canSuspend = can.do("property.suspend")
  const busy = decide.isPending || suspend.isPending

  const status = property.status
  const hasPending = property.pendingChanges !== null

  /*
   * What the server will actually accept, from here.
   *
   * A draft belongs to the partner — the platform has nothing to decide until
   * they submit it. Reinstating something that is not suspended is refused
   * outright, because it would have to guess which state to restore.
   */
  const inReview = status === "pending_review" || status === "changes_requested"
  const canDecide = canApprove && (inReview || (status === "active" && hasPending))
  const canReject = canApprove && inReview
  const canSuspendNow = canSuspend && status === "active"
  const canReinstate = canSuspend && status === "suspended"

  const banner = BANNER[status] ?? {
    tone: "bg-muted",
    message: `Status: ${status}`,
  }

  const copy = pending
    ? ACTION_COPY[pending.kind === "decision" ? pending.decision : "suspend"]
    : null

  function submitNote(note: string) {
    if (!pending) return
    if (pending.kind === "decision") {
      decide.mutate({
        propertyId: property.id,
        body: { decision: pending.decision, note },
      })
    } else {
      suspend.mutate({
        propertyId: property.id,
        body: { action: "suspend", reason: note },
      })
    }
    setPending(null)
  }

  return (
    <>
      <SectionCard title="Review status">
        <div className="space-y-4">
          <div
            className={`flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 ${banner.tone}`}
          >
            <StatusPill status={status} />
            <p className="text-sm">{banner.message}</p>
            {hasPending ? <Badge variant="outline">edit waiting</Badge> : null}
          </div>

          {hasPending ? (
            <p className="text-muted-foreground text-sm">
              The partner has edited this listing since it was last approved.
              Approving publishes the edit;{" "}
              {status === "active"
                ? "sending it back discards the edit and leaves the live version untouched"
                : "sending it back discards the edit"}
              .
            </p>
          ) : null}

          {property.gaps.length > 0 ? (
            <div className="space-y-2 rounded-lg border px-4 py-3">
              <p className="text-sm font-medium">
                Not ready to publish — {property.gaps.length}{" "}
                {property.gaps.length === 1 ? "gap" : "gaps"}
              </p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                {property.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!canApprove && !canSuspend ? (
            <p className="text-muted-foreground text-sm">
              Your role can view this listing but not decide on it.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canDecide ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    decide.mutate({
                      propertyId: property.id,
                      // Approving never needs a note — nothing is being refused.
                      body: { decision: "approve", note: "" },
                    })
                  }
                >
                  <CheckCircle2 className="size-4" />
                  {status === "active" ? "Publish the edit" : "Approve"}
                </Button>
              ) : null}

              {canDecide ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    setPending({ kind: "decision", decision: "request_changes" })
                  }
                >
                  <RotateCcw className="size-4" />
                  Request changes
                </Button>
              ) : null}

              {canReject ? (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setPending({ kind: "decision", decision: "reject" })}
                >
                  <XCircle className="size-4" />
                  Reject
                </Button>
              ) : null}

              {canSuspendNow ? (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setPending({ kind: "suspension", action: "suspend" })}
                >
                  <PauseCircle className="size-4" />
                  Suspend
                </Button>
              ) : null}

              {canReinstate ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    suspend.mutate({
                      propertyId: property.id,
                      body: {
                        action: "reinstate",
                        reason: "Reinstated by the platform",
                      },
                    })
                  }
                >
                  <PlayCircle className="size-4" />
                  Reinstate
                </Button>
              ) : null}

              {!canDecide && !canSuspendNow && !canReinstate ? (
                <p className="text-muted-foreground text-sm">
                  {status === "draft"
                    ? "Nothing to decide until the partner submits it."
                    : "No action is available from this state."}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </SectionCard>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {copy?.title} — {property.name}
            </DialogTitle>
            <DialogDescription>{copy?.help}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              id="property-decision-form"
              onSubmit={form.handleSubmit((values) => submitNote(values.note))}
            >
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        placeholder={copy?.placeholder}
                      />
                    </FormControl>
                    <FormDescription>
                      Be specific — this is what somebody reads months from now.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="property-decision-form"
              variant={copy?.destructive ? "destructive" : "default"}
              disabled={busy}
            >
              {busy ? "Working…" : copy?.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
