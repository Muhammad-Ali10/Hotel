"use client"

import * as React from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

import { usePartnerOrg, useUpdateOrg } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/**
 * The four things a partner may change about their own organisation.
 *
 * Not the commission rate, not the plan tier, not the settlement mode — those
 * are the agreement, and an agreement one side can edit is not one. They are
 * shown where they belong (Finance) as figures, not as fields.
 */
export function EditOrgDialog() {
  const [open, setOpen] = React.useState(false)
  const org = usePartnerOrg()
  const update = useUpdateOrg()

  /*
   * The draft holds only what has been typed.
   *
   * Everything else reads through to the server, so an org refreshed while the
   * dialog is open does not leave a stale copy of itself in a `useState` —
   * and no effect has to keep the two in step.
   */
  const [draft, setDraft] = React.useState<Record<string, string>>({})
  const value = (key: "name" | "contactEmail" | "contactPhone" | "country") =>
    draft[key] ?? org.data?.[key] ?? ""

  function submit() {
    if (Object.keys(draft).length === 0) {
      setOpen(false)
      return
    }
    if (draft.name !== undefined && draft.name.trim() === "") {
      toast.error("The organisation needs a name.")
      return
    }
    if (draft.contactEmail !== undefined && !draft.contactEmail.includes("@")) {
      toast.error("Enter a valid contact email.")
      return
    }

    update.mutate(
      {
        ...(draft.name !== undefined ? { name: draft.name.trim() } : {}),
        ...(draft.contactEmail !== undefined
          ? { contactEmail: draft.contactEmail.trim() }
          : {}),
        ...(draft.contactPhone !== undefined
          ? { contactPhone: draft.contactPhone.trim() }
          : {}),
        ...(draft.country !== undefined ? { country: draft.country.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success("Organisation updated")
          setDraft({})
          setOpen(false)
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Closing discards the draft — a half-typed name should not linger.
        if (!next) setDraft({})
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit organisation
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Organisation details</DialogTitle>
          <DialogDescription>
            Your commission rate and settlement terms are part of your agreement and
            are shown under Finance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={value("name")}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-email">Contact email</Label>
            <Input
              id="org-email"
              type="email"
              value={value("contactEmail")}
              onChange={(e) => setDraft((d) => ({ ...d, contactEmail: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="org-phone">Phone</Label>
              <Input
                id="org-phone"
                value={value("contactPhone")}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, contactPhone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-country">Country</Label>
              <Input
                id="org-country"
                value={value("country")}
                onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={submit} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
