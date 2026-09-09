"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Loader2, ShieldX } from "lucide-react"

import type { SessionUser } from "@stayora/shared"

import { useSession } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"

/* ============================================================================
 * The door on every authenticated surface.
 *
 * `/dashboard`, `/extranet` and `/admin` had no route guard at all. Typing any
 * of them into the address bar signed out rendered the whole shell — the
 * partner extranet's sidebar, its fifty-six screens, the customer's dashboard.
 * The API refused every request behind them (401), so nothing leaked, but the
 * product told a stranger they were somewhere they were not, and every control
 * on the page was one that could only fail.
 *
 * Two different refusals, because they are two different situations:
 *
 *   · **No session** — they are not signed in. That is not a permission
 *     problem, it is a missing step, so they go to `/login?next=…` and land
 *     back here afterwards. The login form already honours `next`.
 *   · **Wrong role** — a guest at the extranet door. Signing in again will not
 *     help, so say so, and point at the surface that IS theirs.
 *
 * Nothing renders until `/auth/me` has answered. Showing a refusal first would
 * flash "you cannot be here" at every legitimate partner on every page load.
 * ========================================================================== */

type Role = SessionUser["role"]

const HOME: Record<Role, { href: string; label: string }> = {
  customer: { href: "/dashboard", label: "Go to your dashboard" },
  partner: { href: "/extranet", label: "Go to the extranet" },
  admin: { href: "/admin", label: "Go to the admin panel" },
}

export function RequireRole({
  role,
  children,
}: {
  /** The role this surface belongs to. Omit for "any signed-in account". */
  role?: Role
  children: React.ReactNode
}) {
  const session = useSession()
  const router = useRouter()
  const pathname = usePathname() ?? "/"

  const person = session.data
  const signedIn = Boolean(person)
  const allowed = signedIn && (!role || person!.role === role)

  /*
   * Sent to sign in, not refused.
   *
   * `replace`, so the back button does not bounce them between the login form
   * and a door that will not open. `next` is the path they asked for, which is
   * where the login form returns them.
   */
  React.useEffect(() => {
    if (session.isPending || signedIn) return
    router.replace(`/login?next=${encodeURIComponent(pathname)}`)
  }, [session.isPending, signedIn, pathname, router])

  if (session.isPending || (!signedIn && !session.isError)) {
    return <Waiting />
  }

  if (!signedIn) return <Waiting />

  if (!allowed) {
    const theirs = HOME[person!.role]
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="bg-muted flex size-12 items-center justify-center rounded-full">
          <ShieldX className="size-6" />
        </span>
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            {role === "partner"
              ? "The extranet is for property partners"
              : role === "admin"
                ? "This area is for platform administrators"
                : "You can't open this"}
          </h1>
          <p className="text-muted-foreground max-w-sm text-sm">
            {/* Names the door that IS theirs, rather than only the one that is
                shut. A guest at the extranet has somewhere to be. */}
            You&apos;re signed in as {person!.firstName || person!.email}, and this
            part of Stayora belongs to a different kind of account.
            {role === "partner"
              ? " If you manage a property, apply to list it and the extranet opens once you're approved."
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button render={<Link href={theirs.href}>{theirs.label}</Link>} />
          {role === "partner" && person!.role === "customer" ? (
            <Button variant="outline" render={<Link href="/join">List a property</Link>} />
          ) : (
            <Button variant="outline" render={<Link href="/">Back to Stayora</Link>} />
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function Waiting() {
  return (
    <div className="text-muted-foreground flex min-h-[60vh] items-center justify-center gap-2 text-sm">
      <Loader2 className="size-4 animate-spin" />
      Checking your access…
    </div>
  )
}
