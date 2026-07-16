"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import type { TeamUser } from "@/lib/extranet/types"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const roleItems: { value: TeamUser["role"]; label: string }[] = [
  { value: "Admin", label: "Admin" },
  { value: "Manager", label: "Manager" },
  { value: "Staff", label: "Staff" },
]

const statusItems: { value: TeamUser["status"]; label: string }[] = [
  { value: "Active", label: "Active" },
  { value: "Invited", label: "Invited" },
]

/** Adds a real team member. The dialog collected name, email, role and status,
 *  then dropped all four — its confirm button was `setOpen(false)`. */
export function AddUserDialog() {
  const team = useStore((s) => s.team)
  const addTeamUser = useStore((s) => s.addTeamUser)
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    role: "Staff" as TeamUser["role"],
    status: "Invited" as TeamUser["status"],
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function add() {
    if (!form.name.trim() || !/\S+@\S+\.\S+/.test(form.email)) {
      toast.error("Enter a name and a valid email.")
      return
    }
    if (team.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())) {
      toast.error("Someone with that email is already on the team.")
      return
    }

    addTeamUser({
      id: `u${team.length + 1}-${form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      status: form.status,
      lastLogin: form.status === "Invited" ? "Never" : "Just now",
      seed: form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    })

    toast.success(
      form.status === "Invited"
        ? `Invite sent to ${form.email.trim()}.`
        : `${form.name.trim()} added to the team.`
    )
    setForm({ name: "", email: "", role: "Staff", status: "Invited" })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Add User
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Name *</Label>
            <Input
              id="user-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-email">Email *</Label>
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="email@aurorahospitality.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                items={roleItems}
                value={form.role}
                onValueChange={(v) => set({ role: v as TeamUser["role"] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleItems.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                items={statusItems}
                value={form.status}
                onValueChange={(v) => set({ status: v as TeamUser["status"] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusItems.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={add}>Add User</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
