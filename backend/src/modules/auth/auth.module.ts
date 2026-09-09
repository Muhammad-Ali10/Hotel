import { forwardRef, Global, Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"

import { AuthGuard } from "../../common/auth/auth.guard"
import { AdminAccessGuard } from "../../common/auth/admin-access.guard"
import { RolesGuard } from "../../common/auth/roles.guard"
import { AuthController } from "./auth.controller"
import { AuthRepository } from "./auth.repository"
import { AuthService } from "./auth.service"
import { PasswordService } from "./password.service"
import { SessionService } from "./session.service"
import { SupportModule } from "../support/support.module"

/**
 * `@Global` because every other module's guards resolve the session through
 * `AuthService`, and importing it into all of them adds noise without adding
 * information.
 *
 * Guard order matters, and Nest runs `APP_GUARD` providers in registration
 * order, so they are declared in that order here:
 *
 *   1. `AuthGuard`        attaches the user, or refuses an anonymous caller
 *   2. `RolesGuard`       is this a customer / partner / admin
 *   3. `AdminAccessGuard` and if an admin, WHICH KIND — the permission matrix
 *
 * The third exists because the second was the whole of it: the admin panel
 * shipped four grades and enforced none of them anywhere but in the browser.
 */
@Global()
@Module({
  // Only for `claimAnonymous` on sign-in (rule #86): tickets opened without an
  // account link up the moment their address is proven. `forwardRef` because
  // support reaches bookings, which will eventually reach back here.
  imports: [forwardRef(() => SupportModule)],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    PasswordService,
    SessionService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AdminAccessGuard },
  ],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
