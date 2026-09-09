import { SetMetadata, createParamDecorator, type ExecutionContext } from "@nestjs/common"
import type { AdminAction, Resource, UserRole } from "@stayora/shared"
import type { Request } from "express"

import type { AuthenticatedUser } from "../../modules/auth/auth.service"

export const IS_PUBLIC = "auth:public"
export const REQUIRED_ROLES = "auth:roles"
export const ADMIN_RESOURCE = "auth:admin-resource"
export const ADMIN_ACTION = "auth:admin-action"

/**
 * Opens a route to anonymous callers.
 *
 * Authentication is DEFAULT DENY (docs/ARCHITECTURE.md §5, API5): the guard is
 * global, and a route is protected the moment it exists. Exposing one is a
 * deliberate, greppable act — the opposite way round from remembering to add a
 * guard, which is the way routes get shipped unprotected.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true)

/** Restricts a route to the given platform roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(REQUIRED_ROLES, roles)

/** Injects the authenticated caller. Never trust a user id from the body. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | null => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    return request.user ?? null
  }
)

/**
 * Which part of the admin panel a controller belongs to.
 *
 * The required LEVEL is not written here — `AdminAccessGuard` derives it from
 * the HTTP method, because that is the actual rule: reading a section needs
 * `read`, changing anything in it needs `manage`. Spelling the level out on
 * fifty routes would be fifty chances to write `read` on a POST.
 */
export const AdminResource = (resource: Resource) => SetMetadata(ADMIN_RESOURCE, resource)

/**
 * A single action that is narrower than its section.
 *
 * `support` may cancel a reservation but must not edit rates; `ops` approves
 * properties but never touches money. Those exceptions live in the shared
 * `ACTIONS` map, and this is how a route claims one.
 */
export const AdminAllows = (action: AdminAction) => SetMetadata(ADMIN_ACTION, action)
