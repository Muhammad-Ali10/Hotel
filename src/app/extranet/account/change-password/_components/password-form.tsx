"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const fields = [
  { id: "current", label: "Current Password", placeholder: "Enter current password" },
  { id: "new", label: "New Password", placeholder: "Enter new password" },
  { id: "confirm", label: "Confirm New Password", placeholder: "Confirm new password" },
] as const

export function PasswordForm() {
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")
  const [confirm, setConfirm] = React.useState("")

  const values: Record<(typeof fields)[number]["id"], string> = {
    current,
    new: next,
    confirm,
  }
  const setters: Record<
    (typeof fields)[number]["id"],
    React.Dispatch<React.SetStateAction<string>>
  > = {
    current: setCurrent,
    new: setNext,
    confirm: setConfirm,
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!current || !next || !confirm) {
      toast.error("Please fill in all password fields")
      return
    }
    if (next !== confirm) {
      toast.error("New passwords do not match")
      return
    }
    toast.success("Password updated")
    setCurrent("")
    setNext("")
    setConfirm("")
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {fields.map((f) => (
        <div key={f.id} className="space-y-1.5">
          <Label htmlFor={f.id}>{f.label}</Label>
          <Input
            id={f.id}
            type="password"
            placeholder={f.placeholder}
            autoComplete="off"
            value={values[f.id]}
            onChange={(e) => setters[f.id](e.target.value)}
          />
        </div>
      ))}
      <div className="pt-1">
        <Button type="submit">Update Password</Button>
      </div>
    </form>
  )
}
