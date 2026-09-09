import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

import { Injectable } from "@nestjs/common"
import type { CookieOptions, Response } from "express"

import { env } from "../../config/env"

/**
 * Session tokens and the cookie that carries them.
 *
 * Server-side sessions rather than JWTs: a JWT cannot be revoked before it
 * expires, so "sign out everywhere", a suspension and a password change would
 * all have to wait the token out. A row can just be deleted.
 */

export const SESSION_COOKIE = "stayora_session"

/** Idle window — refreshed on use. */
const IDLE_DAYS = 1
const IDLE_DAYS_REMEMBERED = 7
/**
 * Hard ceiling, never extended. A session that has been active for 30 days is
 * re-authenticated even if it has been used every hour — otherwise a stolen
 * cookie lives forever as long as it keeps being used.
 */
const ABSOLUTE_DAYS = 30

const DAY_MS = 86_400_000

@Injectable()
export class SessionService {
  /**
   * A new token and the hash to store.
   *
   * 32 bytes from the CSPRNG — enough that guessing is not a strategy. Only
   * the SHA-256 is stored, so a database dump hands out no live sessions.
   * (No salt or slow KDF: the token is already high-entropy random, so there
   * is nothing to brute force and nothing a rainbow table can precompute.)
   */
  issue(remember: boolean): { token: string; tokenHash: string; expiresAt: Date; absoluteExpiresAt: Date } {
    const token = randomBytes(32).toString("base64url")
    const now = Date.now()
    return {
      token,
      tokenHash: hashToken(token),
      expiresAt: new Date(now + (remember ? IDLE_DAYS_REMEMBERED : IDLE_DAYS) * DAY_MS),
      absoluteExpiresAt: new Date(now + ABSOLUTE_DAYS * DAY_MS),
    }
  }

  /** The idle window a session should be pushed out to when it is used. */
  nextIdleExpiry(remember: boolean, now = new Date()): Date {
    return new Date(now.getTime() + (remember ? IDLE_DAYS_REMEMBERED : IDLE_DAYS) * DAY_MS)
  }

  setCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, token, this.cookieOptions(expiresAt))
  }

  clearCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { ...this.cookieOptions(), maxAge: undefined, expires: undefined })
  }

  private cookieOptions(expiresAt?: Date): CookieOptions {
    return {
      httpOnly: true,
      // Not readable by script, so an XSS cannot exfiltrate the session.
      //
      // `COOKIE_SECURE` rather than `isProduction`: TLS is a property of how
      // this is SERVED, not of how it was built, and a production build on a
      // plain-HTTP staging host would otherwise set a cookie the browser
      // throws away — a login that succeeds and a session that never exists.
      secure: env.COOKIE_SECURE,
      // Lax, not Strict: Strict would drop the cookie when a guest arrives via
      // a confirmation-email link, logging them out at the worst moment. Lax
      // still blocks it on cross-site POSTs, which is where CSRF lives.
      sameSite: "lax",
      path: "/",
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
      ...(expiresAt ? { expires: expiresAt } : {}),
    }
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Constant-time comparison of two token hashes.
 *
 * The lookup is by hash so this is belt-and-braces, but a `===` on a secret is
 * the kind of thing that gets copied into a place where it does matter.
 */
export function tokenHashEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8")
  const right = Buffer.from(b, "utf8")
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
