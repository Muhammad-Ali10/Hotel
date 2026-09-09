"use client"

import * as React from "react"
import { ExternalLink, Pencil } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { formatTime24 } from "@/lib/domain"
import { useListing, useUpdateListing } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { Icon } from "@/components/extranet/shared"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NotFoundCard } from "@/components/shared/not-found-card"

/**
 * The property's OWN policy columns.
 *
 * `cancellation` used to be in this list. It is not a property policy — it
 * belongs to a rate plan (rule #1), because two rates on the same room carry
 * different terms, and editing it here would have written to a column that
 * does not exist.
 */
type PolicyKey =
  | "checkInTime"
  | "checkOutTime"
  | "policyPayment"
  | "policyPets"
  | "policySmoking"
  | "policyChildren"

type PolicyRow = {
  key: PolicyKey
  title: string
  icon: string
  kind: "time" | "text"
}

/**
 * One editable list over the property's policies. The screen used to render its
 * own copy of the rules, which is how check-out read 11:00 AM here and 12:00 PM
 * on the property page and the public listing at the same time.
 */
const rows: PolicyRow[] = [
  { key: "checkInTime", title: "Check-in time", icon: "Clock", kind: "time" },
  { key: "checkOutTime", title: "Check-out time", icon: "Clock", kind: "time" },
  { key: "policyPayment", title: "Payment", icon: "CreditCard", kind: "text" },
  { key: "policyPets", title: "Pets", icon: "PawPrint", kind: "text" },
  { key: "policySmoking", title: "Smoking", icon: "Cigarette", kind: "text" },
  { key: "policyChildren", title: "Children & cots", icon: "Baby", kind: "text" },
]

export function PoliciesView() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const listing = useListing(active?.id ?? "")
  const [editing, setEditing] = React.useState<PolicyRow | null>(null)

  if (loadingProperties || listing.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-muted h-32 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  const hotel = listing.data

  if (!active || !hotel) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to manage its policies."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  return (
    <>
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
        <span>These rules appear under House Rules on your public listing.</span>
        <Link
          href={`/hotels/${hotel.slug}`}
          target="_blank"
          className="text-foreground inline-flex items-center gap-1 hover:underline"
        >
          View listing <ExternalLink className="size-3" />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {rows.map((row) => {
          const value = hotel[row.key] ?? ""
          return (
            <Card key={row.key}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                      <Icon name={row.icon} className="size-4" />
                    </span>
                    <h3 className="font-heading text-sm font-semibold">{row.title}</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                </div>
                <p className="text-muted-foreground text-sm">
                  {row.kind === "time" ? formatTime24(value) : value}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {editing ? (
        <EditPolicyDialog
          hotelId={hotel.id}
          row={editing}
          value={hotel[editing.key] ?? ""}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

function EditPolicyDialog({
  hotelId,
  row,
  value,
  onClose,
}: {
  hotelId: string
  row: PolicyRow
  value: string
  onClose: () => void
}) {
  const update = useUpdateListing(hotelId)
  const [draft, setDraft] = React.useState(value)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {row.title.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="policy-value">{row.title}</Label>
          {row.kind === "time" ? (
            <Input
              id="policy-value"
              type="time"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : (
            <Textarea
              id="policy-value"
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          )}
          <p className="text-muted-foreground text-xs">
            Guests see this on your listing and on their booking confirmation.
          </p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                { [row.key]: draft },
                {
                  onSuccess: (listing) =>
                    // A material edit waits for review (rule #71); house rules
                    // are not material, so they usually go live at once. The
                    // server says which, and this reads the answer back.
                    {
                      toast.success(
                        listing.pendingChanges
                          ? `${row.title} sent for review.`
                          : `${row.title} updated — live on your listing.`
                      )
                      onClose()
                    },
                  onError: (e) => toast.error(e.message),
                }
              )
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
