"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CheckCircle2, PlayCircle, RotateCcw, XCircle } from "lucide-react"

import { formatDate } from "@/lib/format"
import type { PropertyDetail, PropertyStatus } from "@/lib/admin/types"
import { allowedTransitions } from "@/lib/admin/api/endpoints"
import { useTransitionProperty } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  ActionButton,
  DescriptionList,
  SectionCard,
  StatusPill,
} from "@/components/admin/shared"
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
 * Drives the approval lifecycle from the property's *current* status.
 *
 * The Figma rendered Approve, Request Changes and Re-approve simultaneously on
 * a screen that also said the property was rejected. Here only the transitions
 * legal from the current state are offered (Phase 1, D6).
 */
const TRANSITION_COPY: Record<
  PropertyStatus,
  { label: string; icon: typeof CheckCircle2; destructive?: boolean; needsNote?: boolean }
> = {
  Active: { label: "Approve", icon: CheckCircle2 },
  Rejected: { label: "Reject", icon: XCircle, destructive: true, needsNote: true },
  "Changes Requested": {
    label: "Request changes",
    icon: RotateCcw,
    needsNote: true,
  },
  Pending: { label: "Move to review", icon: RotateCcw },
  Suspended: { label: "Suspend", icon: XCircle, destructive: true, needsNote: true },
  Draft: { label: "Return to draft", icon: RotateCcw },
}

const BANNER: Record<PropertyStatus, { tone: string; message: string }> = {
  Draft: {
    tone: "bg-muted",
    message: "This property is a draft and has not been submitted for review.",
  },
  Pending: {
    tone: "bg-amber-500/10",
    message: "Awaiting platform review. It is not yet visible to guests.",
  },
  Active: {
    tone: "bg-emerald-500/10",
    message: "Approved and live on the marketplace.",
  },
  Rejected: {
    tone: "bg-destructive/10",
    message: "This property has been rejected and is not visible to guests.",
  },
  "Changes Requested": {
    tone: "bg-amber-500/10",
    message:
      "Changes were requested from the client. It will return for review once resubmitted.",
  },
  Suspended: {
    tone: "bg-destructive/10",
    message: "Suspended by the platform. Hidden from search and new bookings.",
  },
}

const noteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(15, "Explain the decision in at least 15 characters.")
    .max(500, "Keep the note under 500 characters."),
})

type NoteValues = z.infer<typeof noteSchema>

export function ApprovalPanel({ property }: { property: PropertyDetail }) {
  const can = useCan()
  const transition = useTransitionProperty()
  const [pending, setPending] = React.useState<PropertyStatus | null>(null)

  const form = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { note: "" },
  })

  React.useEffect(() => {
    if (pending) form.reset({ note: "" })
  }, [pending, form])

  const canAct = can.do("property.approve") || can.do("property.suspend")
  const options = allowedTransitions(property.status).filter((next) =>
    next === "Suspended" ? can.do("property.suspend") : can.do("property.approve")
  )
  const banner = BANNER[property.status]

  function run(next: PropertyStatus, note?: string) {
    transition.mutate({ id: property.id, next, note })
    setPending(null)
  }

  return (
    <>
      <SectionCard title="Approval status">
        <div className="space-y-4">
          <div
            className={`flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 ${banner.tone}`}
          >
            <StatusPill status={property.status} />
            <p className="text-sm">{banner.message}</p>
          </div>

          {property.decision ? (
            <DescriptionList
              columns={3}
              items={[
                { label: "Decided by", value: property.decision.by },
                { label: "Decided on", value: formatDate(property.decision.at) },
                {
                  label: "Note",
                  value: property.decision.note ?? "—",
                },
              ]}
            />
          ) : null}

          {!canAct ? (
            <p className="text-muted-foreground text-sm">
              Your role can view this property but not change its approval
              status.
            </p>
          ) : options.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No further actions are available from this state.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {options.map((next) => {
                const copy = TRANSITION_COPY[next]
                const Icon = copy.icon
                return (
                  <Button
                    key={next}
                    size="sm"
                    variant={copy.destructive ? "destructive" : "default"}
                    disabled={transition.isPending}
                    onClick={() =>
                      copy.needsNote ? setPending(next) : run(next)
                    }
                  >
                    <Icon className="size-4" />
                    {copy.label}
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Verification video"
        description="Property walkthrough submitted by the owner"
      >
        <div className="space-y-4">
          <DescriptionList
            columns={2}
            items={[
              {
                label: "Status",
                value: <StatusPill status={property.verification.status} />,
              },
              { label: "Submitted by", value: property.verification.submittedBy },
              {
                label: "Uploaded",
                value:
                  property.verification.status === "Not Submitted"
                    ? "—"
                    : formatDate(property.verification.uploadedAt),
              },
              {
                label: "Duration",
                value:
                  property.verification.status === "Not Submitted"
                    ? "—"
                    : property.verification.duration,
              },
            ]}
          />
          {property.verification.status === "Not Submitted" ? (
            <p className="text-muted-foreground text-sm">
              The client has not uploaded a walkthrough yet. A video is required
              before approval.
            </p>
          ) : (
            <ActionButton
              variant="outline"
              size="sm"
              toastMessage="Opening walkthrough"
              toastDescription="Video playback is not wired up in this build."
            >
              <PlayCircle className="size-4" />
              Watch video
            </ActionButton>
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
              {pending ? TRANSITION_COPY[pending].label : ""} — {property.name}
            </DialogTitle>
            <DialogDescription>
              The client sees this note in their extranet, and it is written to
              the audit log.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              id="property-decision-form"
              onSubmit={form.handleSubmit((values) => {
                if (pending) run(pending, values.note)
              })}
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
                        placeholder="What needs to change, or why is this being rejected?"
                      />
                    </FormControl>
                    <FormDescription>
                      Be specific — this is the only feedback the client receives.
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
              variant={
                pending && TRANSITION_COPY[pending].destructive
                  ? "destructive"
                  : "default"
              }
              disabled={transition.isPending}
            >
              {transition.isPending
                ? "Working…"
                : pending
                  ? TRANSITION_COPY[pending].label
                  : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
