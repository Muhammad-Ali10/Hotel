"use client"

import * as React from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

import { currentUser } from "@/data/extranet"
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
  { id: "email", label: "Email", type: "email" },
  { id: "phone", label: "Phone", type: "tel" },
  { id: "company", label: "Company", type: "text" },
  { id: "location", label: "Location", type: "text" },
] as const

export function EditProfileDialog() {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="shrink-0">
            <Pencil className="size-4" />
            Edit Profile
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
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
                defaultValue={currentUser[f.id]}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
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
