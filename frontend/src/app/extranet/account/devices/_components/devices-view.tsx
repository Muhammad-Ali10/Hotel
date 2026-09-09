"use client"

import { Laptop, Monitor, Smartphone, Tablet, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { formatRelativeTime } from "@/lib/format"
import {
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
} from "@/lib/api/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * A device, guessed from the user agent.
 *
 * Guessed, and only for the icon. The string is whatever the browser sent and
 * anybody can send anything — so nothing here decides access, and the sign-out
 * button acts on the SESSION id, which is the thing the server actually knows.
 */
function iconFor(userAgent: string): LucideIcon {
  const ua = userAgent.toLowerCase()
  if (/iphone|android(?!.*tablet)|mobile/.test(ua)) return Smartphone
  if (/ipad|tablet/.test(ua)) return Tablet
  if (/macintosh|mac os|windows nt|linux/.test(ua)) return Laptop
  return Monitor
}

function describe(userAgent: string): string {
  if (!userAgent) return "Unknown device"
  const browser =
    /edg\//i.test(userAgent) ? "Edge"
    : /chrome\//i.test(userAgent) ? "Chrome"
    : /safari\//i.test(userAgent) ? "Safari"
    : /firefox\//i.test(userAgent) ? "Firefox"
    : "Browser"
  const os =
    /windows/i.test(userAgent) ? "Windows"
    : /mac os|macintosh/i.test(userAgent) ? "macOS"
    : /android/i.test(userAgent) ? "Android"
    : /iphone|ipad|ios/i.test(userAgent) ? "iOS"
    : /linux/i.test(userAgent) ? "Linux"
    : "Unknown"
  return `${browser} on ${os}`
}

/**
 * Every session that can act as this account.
 *
 * "Devices" is the friendly word; a session is the thing. That distinction
 * matters when somebody is signing out a laptop they no longer have: revoking
 * the session is what stops the cookie working, and it takes effect on the
 * next request rather than whenever that laptop is next opened.
 *
 * The current session cannot be revoked from here. Signing yourself out is
 * what the Sign out button is for, and offering it twice — once labelled as a
 * security action — invites somebody to lock themselves out mid-task.
 */
export function DevicesView() {
  const sessions = useSessions()
  const revoke = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()

  const list = sessions.data ?? []
  const others = list.filter((s) => !s.current)

  if (sessions.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="bg-muted h-24 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (sessions.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {sessions.error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {others.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <p className="text-sm">
            {others.length} other {others.length === 1 ? "session" : "sessions"} can
            act as this account.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={revokeOthers.isPending}
            onClick={() =>
              revokeOthers.mutate(undefined, {
                onSuccess: () =>
                  toast.success("Signed out everywhere else", {
                    description: "This session stays signed in.",
                  }),
                onError: (e) => toast.error(e.message),
              })
            }
          >
            Sign out everywhere else
          </Button>
        </div>
      ) : null}

      {list.map((session) => {
        const Icon = iconFor(session.userAgent)
        return (
          <Card key={session.id}>
            <CardContent className="flex flex-wrap items-center gap-4">
              <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{describe(session.userAgent)}</p>
                  {session.current ? <Badge>This device</Badge> : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  {session.ip} · last used {formatRelativeTime(session.lastUsedAt)} ·
                  expires {formatRelativeTime(session.expiresAt)}
                </p>
              </div>
              {session.current ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() =>
                    revoke.mutate(session.id, {
                      onSuccess: () => toast.success("Session signed out"),
                      onError: (e) => toast.error(e.message),
                    })
                  }
                >
                  Sign out
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}

      {list.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground text-sm">
            No active sessions.
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
