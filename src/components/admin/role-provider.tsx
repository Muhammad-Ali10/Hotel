"use client"

/**
 * Holds the signed-in admin's role.
 *
 * There is no auth in this build, so the role is client state seeded from
 * localStorage and switchable from the topbar. When real auth lands, replace
 * the initial value with the session's role and drop `setRole` — every
 * `useCan()` call site keeps working.
 */

import * as React from "react"

import {
  ADMIN_ROLES,
  accessFor,
  canDo,
  canManage,
  canView,
  type AdminAction,
  type AdminRole,
  type Resource,
} from "@/lib/admin/rbac"

const STORAGE_KEY = "stayora.admin.role"
const DEFAULT_ROLE: AdminRole = "super_admin"

type RoleContextValue = {
  role: AdminRole
  setRole: (role: AdminRole) => void
  /** Name shown in the topbar; static until real auth exists. */
  user: { name: string; initials: string; email: string }
}

const RoleContext = React.createContext<RoleContextValue | null>(null)

function isRole(value: string | null): value is AdminRole {
  return Boolean(value) && ADMIN_ROLES.includes(value as AdminRole)
}

/**
 * localStorage as an external store. `useSyncExternalStore` gives the server a
 * stable snapshot and the client the persisted one without an effect, so
 * there is no hydration mismatch and no cascading render.
 */
const roleStore = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    roleStore.listeners.add(listener)
    window.addEventListener("storage", listener)
    return () => {
      roleStore.listeners.delete(listener)
      window.removeEventListener("storage", listener)
    }
  },
  getSnapshot(): AdminRole {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isRole(stored) ? stored : DEFAULT_ROLE
  },
  getServerSnapshot(): AdminRole {
    return DEFAULT_ROLE
  },
  set(next: AdminRole) {
    window.localStorage.setItem(STORAGE_KEY, next)
    roleStore.listeners.forEach((listener) => listener())
  },
}

export function AdminRoleProvider({ children }: { children: React.ReactNode }) {
  const role = React.useSyncExternalStore(
    roleStore.subscribe,
    roleStore.getSnapshot,
    roleStore.getServerSnapshot
  )

  const setRole = React.useCallback((next: AdminRole) => {
    roleStore.set(next)
  }, [])

  const value = React.useMemo<RoleContextValue>(
    () => ({
      role,
      setRole,
      user: {
        name: "Ahmed Khan",
        initials: "AK",
        email: "ahmed.khan@stayora.com",
      },
    }),
    [role, setRole]
  )

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
      view: (resource: Resource) => canView(role, resource),
      manage: (resource: Resource) => canManage(role, resource),
      do: (action: AdminAction) => canDo(role, action),
      access: (resource: Resource) => accessFor(role, resource),
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
