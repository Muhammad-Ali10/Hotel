"use client"

import * as React from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

import { useStore } from "@/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const fields = [
  { id: "name", label: "Name", type: "text" },
  { id: "role", label: "Role", type: "text" },
  { id: "email", label: "Email", type: "email" },
  { id: "phone", label: "Phone", type: "tel" },
  { id: "company", label: "Company", type: "text" },
  { id: "location", label: "Location", type: "text" },
] as const

/** Edits the partner profile in the store. The dialog used to render
 *  `defaultValue`s and toast "Profile updated" without saving a thing — its
 *  twin on the customer dashboard saved properly. */
export function EditProfileDialog() {
  const partner = useStore((s) => s.partner)
  const updatePartner = useStore((s) => s.updatePartner)
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(partner)

  function handleOpenChange(next: boolean) {
    if (next) setForm(partner)
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="shrink-0">
            <Pencil className="size-4" />
            Edit Profile
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <Label htmlFor={`profile-${f.id}`}>{f.label}</Label>
              <Input
                id={`profile-${f.id}`}
                type={f.type}
                value={form[f.id]}
                onChange={(e) => setForm((s) => ({ ...s, [f.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button
            onClick={() => {
              updatePartner(form)
              toast.success("Profile updated")
              setOpen(false)
            }}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
