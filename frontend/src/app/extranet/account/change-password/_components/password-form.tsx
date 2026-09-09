"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { changePasswordSchema, PASSWORD_MIN } from "@stayora/shared"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useChangePassword } from "@/lib/api/hooks"

/**
 * Changing a partner's password.
 *
 * This form used to check that the three boxes were filled and that two of them
 * matched, then `toast.success("Password updated")` and clear itself. No
 * request was made. The password did not change.
 *
 * That is the worst shape a fake control can take. A partner who believes they
 * have rotated a password after a laptop was lost has been told, in writing,
 * that the thing protecting their bookings and their payout account was
 * replaced — and it was not. `POST /auth/password` has existed the whole time.
 *
 * The rules are the API's own `changePasswordSchema`, so this form refuses
 * exactly what the server refuses — including reusing the current password,
 * which a local copy of the rules would have missed.
 */
const fields = [
  {
    id: "current",
    label: "Current Password",
    placeholder: "Enter current password",
    autoComplete: "current-password",
  },
  {
    id: "new",
    label: "New Password",
    placeholder: `At least ${PASSWORD_MIN} characters`,
    autoComplete: "new-password",
  },
  {
    id: "confirm",
    label: "Confirm New Password",
    placeholder: "Confirm new password",
    autoComplete: "new-password",
  },
] as const

export function PasswordForm() {
  const change = useChangePassword()

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (change.isPending) return

    if (next !== confirm) {
      toast.error("New passwords do not match")
      return
    }

    const parsed = changePasswordSchema.safeParse({
      currentPassword: current,
      newPassword: next,
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the fields above")
      return
    }

    try {
      const { endedElsewhere } = await change.mutateAsync(parsed.data)
      /*
       * The real count, which the API returns. "Your other devices have been
       * signed out" is reassuring and, for somebody who only ever signs in
       * here, is describing something that did not happen.
       */
      toast.success("Password updated", {
        description:
          endedElsewhere > 0
            ? `Signed out of ${endedElsewhere} other ${endedElsewhere === 1 ? "device" : "devices"}.`
            : "This was your only signed-in device.",
      })
      setCurrent("")
      setNext("")
      setConfirm("")
    } catch (error) {
      /*
       * The server's message, not a generic one. "Your current password is not
       * right" and "choose a password you have not used here" send a partner
       * to two different places, and only the API knows which happened.
       */
      toast.error("Couldn't update your password", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
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
            autoComplete={f.autoComplete}
            value={values[f.id]}
            onChange={(e) => setters[f.id](e.target.value)}
          />
        </div>
      ))}
      <div className="pt-1">
        <Button type="submit" disabled={change.isPending}>
          {change.isPending && <Loader2 className="size-4 animate-spin" />}
          Update Password
        </Button>
      </div>
    </form>
  )
}
