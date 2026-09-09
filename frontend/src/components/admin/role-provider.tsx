"use client"

/* ============================================================================
 * Who is looking at the admin panel.
 *
 * This used to read `localStorage["stayora.admin.role"]`, default to
 * `super_admin`, and expose a `setRole` the topbar rendered as a dropdown. On a
 * build with no auth that was a reasonable stand-in. With auth, it was a hole:
 *
 *   · ANY signed-in account — a guest, a partner — could open `/admin` and get
 *     the whole super-admin shell: every section, every table, every control.
 *   · The API refused the data (403 on all ten calls the dashboard makes), so
 *     nothing leaked. What did leak is the shape of the platform's internals,
 *     and every control was a click that failed rather than one that was absent.
 *   · The switcher let anybody grant themselves permissions. A control that
 *     changes your own access is not a permission system.
 *
 * The role is the SESSION'S now. `/auth/me` says `customer`, `partner` or
 * `admin`, and only the last one is admitted — by `AdminRouteGuard`, above every
 * screen, so no page can forget the check.
 *
 * The GRADE is the session's too, now.
 *
 * The four sub-roles (`super_admin`, `ops`, `finance`, `support`) used to have
 * no counterpart in the database, so every real administrator was mapped to
 * `super_admin` here and the whole matrix was decoration — the browser hid
 * buttons the API would have answered anyway.
 *
 * `users.platform_role` exists now and rides on `/auth/me`, and the same
 * matrix is enforced server-side by `AdminAccessGuard`. What this file decides
 * is only what to DRAW; what may actually be done is decided again, by the
 * API, and that is the answer that counts.
 */

import * as React from "react"

import { useSession } from "@/lib/api/hooks"

import {
  accessFor,
  canDo,
  canManage,
  canView,
  type AdminAction,
  type AdminRole,
  type Resource,
} from "@/lib/admin/rbac"

type RoleContextValue = {
  /** `null` while the session is still loading, or when it is not an admin. */
  role: AdminRole | null
  /** True once `/auth/me` has answered, either way. */
  ready: boolean
  /** The signed-in administrator, from the session. */
  user: { name: string; initials: string; email: string } | null
}

const RoleContext = React.createContext<RoleContextValue | null>(null)

export function AdminRoleProvider({ children }: { children: React.ReactNode }) {
  const session = useSession()

  const value = React.useMemo<RoleContextValue>(() => {
    const person = session.data
    const name = person ? `${person.firstName} ${person.lastName}`.trim() : ""

    /*
     * Both conditions, not either.
     *
     * `platformRole` is null for everybody who is not an administrator and the
     * database refuses to store one on them — but reading the grade without
     * also checking `role` would put the entire admin panel one bad migration
     * away from opening.
     */
    const grade: AdminRole | null =
      person?.role === "admin" ? (person.platformRole ?? null) : null

    return {
      role: grade,
      // `isPending` is React Query's "still asking". Until it answers, the
      // guard shows nothing rather than a refusal a real admin would see flash.
      ready: !session.isPending,
      user: person
        ? {
            name: name || person.email,
            initials:
              `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase() ||
              person.email.charAt(0).toUpperCase(),
            email: person.email,
          }
        : null,
    }
  }, [session.data, session.isPending])

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useAdminRole() {
  const context = React.useContext(RoleContext)
  if (!context) {
    throw new Error("useAdminRole must be used within <AdminRoleProvider>")
  }
  return context
}

/** Permission helpers bound to the current role. */
export function useCan() {
  const { role } = useAdminRole()
  return React.useMemo(
    () => ({
      role,
      // Nobody — no session, or not an administrator — can do anything. The
      // guard has already refused them the screen; this is what keeps a stray
      // control from rendering if one ever escapes it.
      view: (resource: Resource) => (role ? canView(role, resource) : false),
      manage: (resource: Resource) => (role ? canManage(role, resource) : false),
      do: (action: AdminAction) => (role ? canDo(role, action) : false),
      access: (resource: Resource) => (role ? accessFor(role, resource) : "none"),
    }),
    [role]
  )
}

/**
 * Renders `children` only when the role holds the permission. Use for
 * individual controls; whole sections are gated by the layout instead.
 */
export function RoleGate({
  action,
  resource,
  fallback = null,
  children,
}: {
  action?: AdminAction
  resource?: Resource
  fallback?: React.ReactNode
  children: React.ReactNode
}) {
  const can = useCan()
  const allowed = action
    ? can.do(action)
    : resource
      ? can.manage(resource)
      : true
  return <>{allowed ? children : fallback}</>
}
