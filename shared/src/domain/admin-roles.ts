/* ============================================================================
 * Platform roles for /admin.
 *
 * This lived in `frontend/src/lib/admin/rbac.ts` and nowhere else, which meant
 * the entire matrix was decoration: the browser hid buttons a role could not
 * use, and the API happily served every one of those routes to anybody with
 * `role = admin`. A finance administrator could suspend a property by typing
 * the URL, and the audit log would record it as perfectly ordinary.
 *
 * It is here because BOTH sides need it and there must be exactly one copy.
 * The browser uses it to decide what to draw; the API uses it to decide what
 * to answer, and the API's answer is the one that matters.
 * ========================================================================== */

export const ADMIN_ROLES = ["super_admin", "ops", "finance", "support"] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  ops: "Operations",
  finance: "Finance",
  support: "Support",
}

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  super_admin: "Full platform access — every client, property, payout and setting",
  ops: "Properties, reservations, promotions and content moderation",
  finance: "Revenue, commissions, payouts, invoices and subscriptions",
  support: "Guests, inbox, reviews and reservation assistance",
}

/** One entry per sidebar section. Keep in sync with `nav.ts`. */
export const RESOURCES = [
  "dashboard",
  "clients",
  "guests",
  "properties",
  "users",
  "reservations",
  "promotions",
  "inbox",
  "reviews",
  "finance",
  "analytics",
  "content",
  "billing",
  "audit",
  "settings",
] as const

export type Resource = (typeof RESOURCES)[number]

export type Access = "none" | "read" | "manage"

/**
 * The signed-off permission matrix. `manage` implies `read`.
 * Anything absent from a role's map defaults to "none".
 */
const MATRIX: Record<AdminRole, Partial<Record<Resource, Access>>> = {
  super_admin: {
    dashboard: "manage",
    clients: "manage",
    guests: "manage",
    properties: "manage",
    users: "manage",
    reservations: "manage",
    promotions: "manage",
    inbox: "manage",
    reviews: "manage",
    finance: "manage",
    analytics: "manage",
    content: "manage",
    billing: "manage",
    audit: "manage",
    settings: "manage",
  },
  ops: {
    dashboard: "manage",
    clients: "read",
    guests: "read",
    properties: "manage",
    users: "read",
    reservations: "manage",
    promotions: "manage",
    inbox: "read",
    reviews: "read",
    finance: "read",
    analytics: "manage",
    content: "manage",
    audit: "read",
  },
  finance: {
    dashboard: "manage",
    clients: "read",
    properties: "read",
    reservations: "read",
    promotions: "read",
    finance: "manage",
    analytics: "manage",
    billing: "manage",
    audit: "read",
  },
  support: {
    dashboard: "read",
    clients: "read",
    guests: "manage",
    properties: "read",
    users: "read",
    reservations: "manage",
    inbox: "manage",
    reviews: "manage",
    analytics: "read",
    content: "read",
    billing: "read",
    audit: "read",
  },
}

/**
 * `AdminRole | null` on every entry point, deliberately.
 *
 * `null` is "not an administrator" — a signed-out visitor, a guest, a partner.
 * Answering `"none"` and `false` for them means a component that forgets to
 * check whether somebody is an admin still cannot render an admin control. The
 * alternative was a non-null type and four call sites each remembering to
 * guard, which is how one of them eventually does not.
 */
export function accessFor(role: AdminRole | null, resource: Resource): Access {
  if (!role) return "none"
  return MATRIX[role][resource] ?? "none"
}

/** True when the role may open the section at all. */
export function canView(role: AdminRole | null, resource: Resource) {
  return accessFor(role, resource) !== "none"
}

/** True when the role may mutate the section (approve, suspend, pay out…). */
export function canManage(role: AdminRole | null, resource: Resource) {
  return accessFor(role, resource) === "manage"
}

/**
 * A few actions are narrower than their section. `support` can cancel a
 * reservation but must not edit rates; `ops` approves properties but never
 * touches money. Encode those exceptions here rather than in components.
 */
export const ACTIONS = {
  "property.approve": ["super_admin", "ops"],
  "property.suspend": ["super_admin", "ops"],
  "reservation.cancel": ["super_admin", "ops", "support"],
  "guest.suspend": ["super_admin", "support"],
  "guest.block": ["super_admin", "support"],
  "manager.invite": ["super_admin"],
  "review.moderate": ["super_admin", "support"],
  "content.approve": ["super_admin", "ops"],
  "promotion.manage": ["super_admin", "ops"],
  "payout.retry": ["super_admin", "finance"],
  "invoice.generate": ["super_admin", "finance"],
  "invoice.remind": ["super_admin", "finance"],
  "billing.markPaid": ["super_admin", "finance"],
  "settings.edit": ["super_admin"],
} as const satisfies Record<string, readonly AdminRole[]>

export type AdminAction = keyof typeof ACTIONS

export function canDo(role: AdminRole | null, action: AdminAction) {
  if (!role) return false
  return (ACTIONS[action] as readonly AdminRole[]).includes(role)
}
