import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { canDo, canManage, canView, type AdminAction, type Resource } from "@stayora/shared"
import type { Request } from "express"

import type { AuthenticatedUser } from "../../modules/auth/auth.service"
import { ADMIN_ACTION, ADMIN_RESOURCE } from "./decorators"

/* ============================================================================
 * What an administrator may actually do.
 *
 * `RolesGuard` answers "is this an administrator" — three platform roles, and
 * it is the whole of what the API checked. The admin panel meanwhile shipped
 * four GRADES and a full permission matrix that lived only in the browser: it
 * hid buttons a finance account could not use, and the API answered every one
 * of those routes anyway. Anybody who could sign in to `/admin` could suspend
 * a property by typing the URL, and the audit log recorded it as ordinary.
 *
 * This guard is the other half. It reads the same matrix the browser reads —
 * one copy, in `@stayora/shared` — so the two cannot drift into disagreeing
 * about who may do what.
 * ========================================================================== */

/**
 * Methods that only READ.
 *
 * Everything else needs `manage`. Deriving the level from the method rather
 * than writing it on each route is the point: fifty hand-written levels is
 * fifty chances to put `read` on a POST, and that mistake looks exactly like
 * a correct line.
 */
const READ_ONLY = new Set(["GET", "HEAD", "OPTIONS"])

@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true

    const resource = this.reflector.getAllAndOverride<Resource>(ADMIN_RESOURCE, [
      context.getHandler(),
      context.getClass(),
    ])
    // Not an admin-panel route. `RolesGuard` has already had its say.
    if (!resource) return true

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>()
    const user = request.user

    /*
     * No grade means no access, whatever `role` says.
     *
     * The database refuses an admin row without one, so this is unreachable
     * through the front door — which is exactly why it fails CLOSED. A guard
     * whose impossible branch is permissive is one bad migration away from
     * being the only thing that mattered.
     */
    const grade = user?.platformRole
    if (!user || user.role !== "admin" || !grade) {
      throw new ForbiddenException("You do not have access to this resource")
    }

    /*
     * An action exception, when the route claims one.
     *
     * These are narrower than their section: `support` may cancel a
     * reservation but not reprice it, `finance` may retry a payout but not
     * approve a property. Checked INSTEAD of the section's manage level, not
     * in addition, because the whole purpose of an exception is to grant
     * something the section-level answer would refuse.
     */
    const action = this.reflector.getAllAndOverride<AdminAction>(ADMIN_ACTION, [
      context.getHandler(),
      context.getClass(),
    ])
    if (action) {
      if (!canDo(grade, action)) {
        throw new ForbiddenException(`Your role cannot ${action.replace(".", " ")}`)
      }
      return true
    }

    const method = request.method.toUpperCase()
    const allowed = READ_ONLY.has(method)
      ? canView(grade, resource)
      : canManage(grade, resource)

    if (!allowed) {
      throw new ForbiddenException(
        READ_ONLY.has(method)
          ? `Your role cannot view ${resource}`
          : `Your role cannot change ${resource}`
      )
    }

    return true
  }
}
