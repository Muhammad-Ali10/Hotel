import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common"
import {
  RESET_SENT_MESSAGE,
  SIGNUP_PENDING_MESSAGE,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  profileUpdateSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type ProfileUpdateInput,
  type ResetPasswordInput,
  type SignupInput,
  type VerifyEmailInput,
} from "@stayora/shared"
import type { Request, Response } from "express"

import { CurrentUser, Public } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { AuthThrottle } from "../../common/throttling/throttling"
import { AuthService, type AuthenticatedUser } from "./auth.service"
import { SESSION_COOKIE, SessionService } from "./session.service"

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService
  ) {}

  @Post("signup")
  @Public()
  @AuthThrottle()
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Req() req: Request
  ) {
    /*
     * One answer, whether the address was known or not (rule #58).
     *
     * And no session: a cookie coming back for a new account and not for an
     * existing one would be the same leak restated. Whoever just signed up
     * knows the password they chose and can sign in immediately.
     */
    await this.auth.signup(body, metaOf(req))
    return { message: SIGNUP_PENDING_MESSAGE }
  }

  /** Proving an address. Public — the caller is not signed in yet. */
  @Post("verify-email")
  @Public()
  @AuthThrottle()
  verifyEmail(@Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput) {
    return this.auth.verifyEmail(body.token)
  }

  /** A fresh link, for somebody who lost the first. */
  @Post("verify-email/resend")
  @AuthThrottle()
  resendVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.resendVerification(user)
  }

  @Post("login")
  @Public()
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.auth.login(body, metaOf(req))
    this.sessions.setCookie(res, result.token, result.expiresAt)
    return { user: result.user }
  }

  /**
   * Public so that signing out is never itself a 401 — a caller with an
   * already-dead session should still end up cookie-less rather than stuck.
   */
  @Post("logout")
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE]
    await this.auth.logout(token)
    this.sessions.clearCookie(res)
  }

  /** Who am I. 401 when the session is missing or expired. */
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    const { sessionId: _sessionId, ...rest } = user
    return { user: rest }
  }

  /* --------------------------------------------------------------- profile */

  @Get("me/profile")
  async profile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.auth.profileFor(user.id)
    if (!profile) throw new NotFoundException("Account not found")
    return profile
  }

  /**
   * The endpoint `docs/ARCHITECTURE.md` §5 API3 named by name.
   *
   * `role`, `tier`, `points`, `membership`, `emailVerified` and `id` are all
   * absent from `profileUpdateSchema`, and `.strict()` rejects a body carrying
   * one outright — so this cannot become a self-service route to a discount or
   * an admin badge.
   */
  @Patch("me/profile")
  updateProfile(
    @Body(new ZodValidationPipe(profileUpdateSchema)) body: ProfileUpdateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.auth.updateProfile({ userId: user.id, patch: body })
  }

  /* -------------------------------------------------------------- password */

  @Post("password")
  @AuthThrottle()
  changePassword(
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.auth.changePassword({ user, ...body })
  }

  /**
   * Asking for a reset link.
   *
   * The response NEVER carries the token, and never says whether the address
   * was known. Both would defeat the point: the first hands a reset to anyone
   * who can post a form, and the second turns this into a way of asking "does
   * this person have an account here".
   */
  @Post("password/forgot")
  @Public()
  @AuthThrottle()
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
    @Req() req: Request
  ) {
    await this.auth.requestPasswordReset({ email: body.email, ip: metaOf(req).ip })
    return { message: RESET_SENT_MESSAGE }
  }

  /** Spending a reset link. Ends every session, this one included. */
  @Post("password/reset")
  @Public()
  @AuthThrottle()
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.auth.resetPassword(body)
    // Whoever is holding this browser is signed out too — the cookie would
    // otherwise point at a session the reset just deleted.
    this.sessions.clearCookie(res)
    return result
  }

  /* -------------------------------------------------------------- sessions */

  /** The devices signed in to this account. */
  @Get("sessions")
  sessionList(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listSessions(user)
  }

  /** Signing one device out. */
  @Delete("sessions/:id")
  async revokeSession(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.auth.revokeSession({ sessionId: id, user })
    // Revoking your own current session is just a logout, and the cookie has
    // to go with it or the browser keeps presenting a token to nothing.
    if (result.wasCurrent) this.sessions.clearCookie(res)
    return result
  }

  /** "Sign out everywhere else" — API2 asked for it; nothing provided it. */
  @Post("sessions/revoke-others")
  revokeOthers(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.revokeOtherSessions(user)
  }
}

function metaOf(req: Request) {
  const forwarded = req.headers["x-forwarded-for"]
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return {
    userAgent: req.headers["user-agent"] ?? "",
    ip: first?.split(",")[0]?.trim() ?? req.ip ?? "",
  }
}
