"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Loader2, ShieldX } from "lucide-react"

import { adminNav, resourceForPath } from "@/lib/admin/nav"
import { canView } from "@/lib/admin/rbac"
import { useAdminRole } from "@/components/admin/role-provider"
import { PermissionDenied } from "@/components/shared/states"
import { Button } from "@/components/ui/button"

/**
 * Who gets in at all, and then which sections.
 *
 * Two gates, in order:
 *
 *  1. **Are you an administrator?** The role comes from the session, not from
 *     `localStorage` — before this, any signed-in account could open `/admin`
 *     and be handed the full super-admin shell. The API refused every request
 *     with a 403, so no data escaped; what did was the shape of the platform's
 *     internals, and a screen full of controls that could only fail.
 *
 *  2. **Which sections?** Section-level RBAC, gated here rather than in each
 *     page, so a new screen is protected the moment its route sits under an
 *     existing nav section.
 *
 * Control-level permissions (approve, suspend, pay out) are separate — those
 * use `RoleGate` / `useCan` inside the screens.
 */
export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { role, ready } = useAdminRole()

  /*
   * Nothing until the session has answered. Rendering a refusal first would
   * flash "you do not have access" at every administrator on every load.
   */
  if (!ready) {
    return (
      <div className="text-muted-foreground flex min-h-[50vh] items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Checking your access…
      </div>
    )
  }

  if (!role) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <span className="bg-muted flex size-12 items-center justify-center rounded-full">
          <ShieldX className="size-6" />
        </span>
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            This area is for platform administrators
          </h1>
          <p className="text-muted-foreground max-w-sm text-sm">
            {/* Says which door to use rather than only that this one is shut. */}
            Your account does not administer Stayora. If you manage a property,
            the extranet is where your bookings and rates live.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button render={<Link href="/extranet">Go to the extranet</Link>} />
          <Button variant="outline" render={<Link href="/">Back to Stayora</Link>} />
        </div>
      </div>
    )
  }

  const resource = resourceForPath(pathname)
  if (canView(role, resource)) return <>{children}</>

  const section =
    adminNav.find((item) => item.resource === resource)?.title ?? "this section"

  return <PermissionDenied role={role} section={section.toLowerCase()} />
}
