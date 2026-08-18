"use client"

import { usePathname } from "next/navigation"

import { adminNav, resourceForPath } from "@/lib/admin/nav"
import { canView } from "@/lib/admin/rbac"
import { useAdminRole } from "@/components/admin/role-provider"
import { PermissionDenied } from "@/components/shared/states"

/**
 * Section-level RBAC. Gating here rather than in each page means a new screen
 * is protected the moment its route sits under an existing nav section, and
 * no page can forget the check.
 *
 * Control-level permissions (approve, suspend, pay out) are separate — those
 * use `RoleGate` / `useCan` inside the screens.
 */
export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { role } = useAdminRole()

  const resource = resourceForPath(pathname)
  if (canView(role, resource)) return <>{children}</>

  const section =
    adminNav.find((item) => item.resource === resource)?.title ?? "this section"

  return <PermissionDenied role={role} section={section.toLowerCase()} />
}
