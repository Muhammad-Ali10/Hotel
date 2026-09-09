import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { UserRole } from "@stayora/shared"
import type { Request } from "express"

import type { AuthenticatedUser } from "../../modules/auth/auth.service"
import { REQUIRED_ROLES } from "./decorators"

/**
 * Enforces `@Roles(...)`.
 *
 * Declarative rather than an `if` inside each controller: a decorator is
 * greppable and impossible to half-apply, whereas a forgotten `if` looks
 * exactly like a route that legitimately has no role requirement.
 *
 * This is the PLATFORM role only (`customer` / `partner` / `admin`). What a
 * partner may do inside their own org is a second, separate check against
 * `partner.role` and `partner.propertyIds` — see rule #14.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true

    const required = this.reflector.getAllAndOverride<UserRole[]>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>()
    const user = request.user

    // AuthGuard runs first and has already rejected anonymous callers on a
    // non-public route. Reaching here without a user means the route is public
    // AND role-restricted, which is a contradiction worth failing loudly on.
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException("You do not have access to this resource")
    }

    return true
  }
}
