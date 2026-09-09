import type { UserTier } from "../types/user"

/* ============================================================================
 * Loyalty tier (rules #3, #53).
 *
 * `genius` was implemented everywhere it was read — pricing checks it,
 * promotions filter on it, the quote context derives it from the session — and
 * nothing anywhere could set it. Every account was `standard` forever, so the
 * whole channel was unreachable.
 * ========================================================================== */

/** Completed stays needed to earn `genius`. */
export const GENIUS_STAYS_REQUIRED = 2

/**
 * The tier an account has earned.
 *
 * Counted in COMPLETED stays, not bookings made: a guest who books ten rooms
 * and cancels them all has demonstrated nothing, and tying a discount to
 * bookings rather than stays is an invitation to do exactly that.
 */
export function earnedTier(completedStays: number): UserTier {
  return completedStays >= GENIUS_STAYS_REQUIRED ? "genius" : "standard"
}

/**
 * Whether an account should move up, and to what. `null` = leave it alone.
 *
 * Upgrade-only, deliberately (rule #53). A tier that could fall would mean a
 * guest opening the same hotel page a month later and finding it dearer, with
 * nothing on the screen to explain why. That is a support conversation the
 * discount does not earn back — and adding expiry later is a rule change,
 * while taking it away after promising it is a broken promise.
 */
export function tierUpgradeFor(input: {
  current: UserTier
  completedStays: number
}): UserTier | null {
  const earned = earnedTier(input.completedStays)
  if (earned === input.current) return null

  // `standard` → `genius` only. Nothing here ever moves an account down.
  return earned === "genius" ? "genius" : null
}
