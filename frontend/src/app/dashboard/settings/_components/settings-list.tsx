"use client"

import * as React from "react"
import { AlertTriangle, LogOut, Monitor } from "lucide-react"
import { toast } from "sonner"

import { formatRelativeTime } from "@/lib/format"
import type { NotificationSettingsDto } from "@/lib/api/endpoints"
import {
  useChangePassword,
  useNotificationSettings,
  useRevokeOtherSessions,
  useRevokeSession,
  useSaveNotificationSettings,
  useSessions,
} from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type ToggleRow = {
  id: keyof NotificationSettingsDto
  title: string
  description: string
}

/**
 * Three switches, and every one of them is a column the API actually reads.
 *
 * The screen used to offer a fourth — "Two-Factor Authentication" — with
 * nothing behind it anywhere: no enrolment, no secret, no challenge at sign-in.
 * A security control that does nothing is worse than none, because somebody
 * turns it on and believes they are protected.
 *
 * "Reset demo data" is gone too: it cleared a browser store that no longer
 * holds anything.
 */
const toggles: ToggleRow[] = [
  {
    id: "emailUseful",
    title: "Email notifications",
    description: "Booking updates, reminders and review requests.",
  },
  {
    id: "emailMarketing",
    title: "Marketing emails",
    description: "Special offers and travel inspiration. Off unless you ask for it.",
  },
]

export function SettingsList() {
  return (
    <div className="space-y-8">
      <NotificationToggles />
      <PasswordCard />
      <DevicesCard />
    </div>
  )
}

function NotificationToggles() {
  const { data: settings, isPending } = useNotificationSettings()
  const save = useSaveNotificationSettings()

  if (isPending || !settings) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-20 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {toggles.map((row) => (
        <Card key={row.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="font-heading text-sm font-medium">{row.title}</p>
              <p className="text-muted-foreground text-sm">{row.description}</p>
            </div>
            <div className="shrink-0">
              <Switch
                checked={settings[row.id]}
                disabled={save.isPending}
                onCheckedChange={(checked) =>
                  save.mutate(
                    { [row.id]: checked === true },
                    {
                      onSuccess: () => toast.success(`${row.title} ${checked ? "on" : "off"}`),
                      onError: (e) => toast.error(e.message),
                    }
                  )
                }
                aria-label={row.title}
              />
            </div>
          </div>
        </Card>
      ))}

      <Card className="p-4 sm:p-5">
        <div className="min-w-0 space-y-0.5">
          <p className="font-heading text-sm font-medium">Currency</p>
          <p className="text-muted-foreground text-sm">
            All prices are shown and charged in USD. Your rate is the final price —
            nothing is added at checkout.
          </p>
        </div>
      </Card>
    </div>
  )
}

function PasswordCard() {
  const change = useChangePassword()
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="space-y-0.5">
        <p className="font-heading text-sm font-medium">Password</p>
        <p className="text-muted-foreground text-sm">
          {/*
            The current password is required even though the caller already
            holds a live session — a borrowed laptop is not consent to change
            the password on it.
          */}
          Changing it signs out your other devices — the ones holding the old
          password.
        </p>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          change.mutate(
            { currentPassword: current, newPassword: next },
            {
              onSuccess: ({ endedElsewhere }) => {
                // The count the API actually returns, rather than a blanket
                // claim about devices that may not exist.
                toast.success("Password changed", {
                  description:
                    endedElsewhere > 0
                      ? `Signed out of ${endedElsewhere} other ${endedElsewhere === 1 ? "device" : "devices"}.`
                      : "This was your only signed-in device.",
                })
                setCurrent("")
                setNext("")
              },
              onError: (error) => toast.error(error.message),
            }
          )
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={change.isPending || !current || !next}>
            {change.isPending ? "Changing…" : "Change password"}
          </Button>
        </div>
      </form>
    </Card>
  )
}

/**
 * Where this account is signed in.
 *
 * The dashboard never had this, while the partner extranet did — and it is the
 * one screen that lets somebody notice a session they do not recognise.
 */
function DevicesCard() {
  const { data: sessions, isPending, error } = useSessions()
  const revoke = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()

  const others = (sessions ?? []).filter((s) => !s.current)

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="font-heading text-sm font-medium">Signed-in devices</p>
          <p className="text-muted-foreground text-sm">
            If you do not recognise one, sign it out.
          </p>
        </div>
        {others.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={revokeOthers.isPending}
            onClick={() =>
              revokeOthers.mutate(undefined, {
                onSuccess: (r) =>
                  toast.success(
                    `Signed out ${r.revoked} other ${r.revoked === 1 ? "device" : "devices"}.`
                  ),
                onError: (e) => toast.error(e.message),
              })
            }
          >
            <LogOut className="size-3.5" />
            Sign out others
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error.message}</span>
        </div>
      ) : isPending ? (
        <div className="bg-muted h-16 animate-pulse rounded-lg" aria-busy="true" />
      ) : (
        <ul className="divide-border divide-y">
          {(sessions ?? []).map((session) => (
            <li key={session.id} className="flex flex-wrap items-center gap-3 py-3">
              <Monitor className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {session.userAgent || "Unknown device"}
                  {session.current ? (
                    <span className="text-muted-foreground font-normal"> · this device</span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {session.ip} · last used {formatRelativeTime(session.lastUsedAt)}
                </p>
              </div>
              {!session.current ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() =>
                    revoke.mutate(session.id, {
                      onSuccess: () => toast.success("Device signed out."),
                      onError: (e) => toast.error(e.message),
                    })
                  }
                >
                  Sign out
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
