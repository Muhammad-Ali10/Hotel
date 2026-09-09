"use client"

import * as React from "react"
import { UserPlus } from "lucide-react"
import { toast } from "sonner"

import { usePartnerProperties, useTeamActions } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

const ROLES = [
  {
    value: "staff",
    label: "Staff",
    detail: "Bookings and guest messages. No prices, no team, no contracts.",
  },
  {
    value: "manager",
    label: "Manager",
    detail: "Rates, availability, content and bookings. Cannot change the team.",
  },
  {
    value: "admin",
    label: "Admin",
    detail:
      "Everything, including the team, the contracts and the terms a rate plan promises.",
  },
]

/**
 * Inviting somebody, not creating them.
 *
 * This was "Add User": first name, last name, a password field, and a success
 * toast. None of it could be real. An account belongs to a PERSON — the
 * platform cannot make one on their behalf and choose their password, and an
 * email address nobody has confirmed is an address that might belong to
 * somebody else entirely.
 *
 * So it sends an invitation. The token they redeem is what creates the link,
 * and redeeming it is what proves the address is theirs.
 */
export function InviteUserDialog() {
  const [open, setOpen] = React.useState(false)
  const { invite } = useTeamActions()
  const properties = usePartnerProperties()

  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState("staff")
  const [scoped, setScoped] = React.useState<string[] | null>(null)

  const all = properties.data ?? []
  /** `null` = every property, which is what an empty list means to the API. */
  const propertyIds = scoped ?? []

  function submit() {
    const address = email.trim()
    if (!address.includes("@")) {
      toast.error("Enter the email address they will sign in with.")
      return
    }

    invite.mutate(
      { email: address, role: role as never, propertyIds },
      {
        onSuccess: () => {
          toast.success(`Invitation sent to ${address}`, {
            description: "They join once they open the link and set a password.",
          })
          setEmail("")
          setRole("staff")
          setScoped(null)
          setOpen(false)
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <UserPlus className="size-4" />
            Invite someone
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite someone to this account</DialogTitle>
          <DialogDescription>
            They set their own name and password when they accept — nobody else can
            choose those for them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="them@yourhotel.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            {ROLES.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
              >
                <input
                  type="radio"
                  name="invite-role"
                  className="mt-1"
                  checked={role === r.value}
                  onChange={() => setRole(r.value)}
                />
                <div>
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-muted-foreground text-xs">{r.detail}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Properties</Label>
            {properties.isPending ? (
              <div className="bg-muted h-8 animate-pulse rounded-md" />
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {all.map((property) => (
                  <label key={property.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={propertyIds.includes(property.id)}
                      onCheckedChange={(v) =>
                        setScoped(
                          v === true
                            ? [...propertyIds, property.id]
                            : propertyIds.filter((id) => id !== property.id)
                        )
                      }
                    />
                    {property.name}
                  </label>
                ))}
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              {propertyIds.length === 0
                ? "Nothing ticked means every property, including any you add later."
                : `${propertyIds.length} of ${all.length}. They will not see the others.`}
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={submit} disabled={invite.isPending}>
            {invite.isPending ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
