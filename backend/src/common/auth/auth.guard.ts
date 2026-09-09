import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { Request } from "express"

import { setContextUserId } from "../context/request-context"
import { AuthService, type AuthenticatedUser } from "../../modules/auth/auth.service"
import { SESSION_COOKIE } from "../../modules/auth/session.service"
import { IS_PUBLIC } from "./decorators"

/**
 * Resolves the session cookie on every request, and rejects anonymous callers
 * unless the route is explicitly `@Public()`.
 *
 * Registered globally so protection is the default. A new endpoint is guarded
 * from the moment it is written; opening one requires saying so.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>()

    const token = (request.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE]
    const user = await this.auth.resolveSession(token)

    if (user) {
      request.user = user
      // Every log line for the rest of this request now carries the caller.
      setContextUserId(user.id)
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])

    // A public route still gets its user resolved — a signed-in guest browsing
    // hotels must be recognised, because their tier changes the price they see
    // (rule #3).
    if (isPublic) return true

    if (!user) throw new UnauthorizedException("Sign in to continue")

    return true
  }
}
