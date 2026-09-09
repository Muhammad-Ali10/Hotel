import { createHmac, timingSafeEqual } from "node:crypto"

import { BadRequestException, Injectable } from "@nestjs/common"
import type { BookingPricing, Occupancy } from "@stayora/shared"

import { env } from "../../config/env"

/**
 * The signed quote token (rule #13).
 *
 * A guest sees a price, fills in a checkout form, and confirms a few minutes
 * later. Repricing at that moment would show them a different total than the
 * one they agreed to; not repricing at all would let a client send whatever
 * total it liked. The token is the way out: the SERVER signs the price, the
 * client hands it straight back, and the server verifies its own signature.
 *
 * What it guarantees is the PRICE and nothing else. Availability is re-checked
 * at write time under a row lock, because inventory moves and a signature
 * cannot hold a room.
 */

/** 15 minutes: long enough to fill a checkout form, short enough that a rate change is not stale. */
const TTL_MS = 15 * 60_000

/**
 * A key derived from `SESSION_SECRET`, never the secret itself.
 *
 * Separate keys for separate purposes: if one signing context is ever
 * compromised, a token from it must not be usable as a session, and vice versa.
 */
const SIGNING_KEY = createHmac("sha256", env.SESSION_SECRET).update("quote-token-v1").digest()

export type QuotePayload = {
  propertyId: string
  roomId: string
  ratePlanId: string
  checkIn: string
  checkOut: string
  occupancy: Occupancy
  addOns: { valueAddId: string; qty: number }[]
  pricing: BookingPricing
  /** Which promotion produced the discount, if any. Server-chosen. */
  promotionId: string | null
  /** Whose quote it is. `null` for an anonymous browse. */
  userId: string | null
  /** Issued-at and expiry, epoch ms. */
  iat: number
  exp: number
}

@Injectable()
export class QuoteTokenService {
  issue(payload: Omit<QuotePayload, "iat" | "exp">, now = new Date()): { token: string; expiresAt: Date } {
    const iat = now.getTime()
    const exp = iat + TTL_MS
    const body = base64url(JSON.stringify({ ...payload, iat, exp }))
    return { token: `${body}.${sign(body)}`, expiresAt: new Date(exp) }
  }

  /**
   * Verifies and decodes. Throws rather than returning null — a bad token is
   * never something the caller should be able to shrug off.
   *
   * Order matters: the signature is checked BEFORE the payload is parsed, so
   * unverified bytes are never interpreted.
   */
  verify(token: string, now = new Date()): QuotePayload {
    const [body, signature] = token.split(".")
    if (!body || !signature) throw new BadRequestException("Malformed quote")

    if (!signatureMatches(body, signature)) {
      throw new BadRequestException("Quote signature is not valid")
    }

    let payload: QuotePayload
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as QuotePayload
    } catch {
      throw new BadRequestException("Malformed quote")
    }

    if (typeof payload.exp !== "number" || payload.exp <= now.getTime()) {
      // A distinct code, because the client's correct response is to re-quote
      // rather than to show the guest an error.
      throw new BadRequestException({ message: "Your quote has expired", code: "quote_expired" })
    }

    return payload
  }

  /**
   * Confirms the token describes the booking actually being made.
   *
   * The signature proves the server issued the price; this proves the price
   * belongs to THIS request. Without it a guest could quote a cheap room and
   * present that token while booking an expensive one.
   */
  assertMatches(
    payload: QuotePayload,
    request: { roomId: string; ratePlanId: string; checkIn: string; checkOut: string; occupancy: Occupancy }
  ): void {
    const same =
      payload.roomId === request.roomId &&
      payload.ratePlanId === request.ratePlanId &&
      payload.checkIn === request.checkIn &&
      payload.checkOut === request.checkOut &&
      payload.occupancy.adults === request.occupancy.adults &&
      payload.occupancy.children === request.occupancy.children

    if (!same) {
      throw new BadRequestException("This quote does not match the booking details")
    }
  }
}

function sign(body: string): string {
  return createHmac("sha256", SIGNING_KEY).update(body).digest("base64url")
}

/** Constant-time, so a forger learns nothing from how long a rejection took. */
function signatureMatches(body: string, provided: string): boolean {
  const expected = Buffer.from(sign(body), "utf8")
  const actual = Buffer.from(provided, "utf8")
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}
