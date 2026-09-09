import type { Cents } from "../types/common"
import type { BookingStatus, CommissionStatus } from "../types/booking"
import type { PlanTier } from "../types/user"
import { bpsOf } from "./money"

/* ============================================================================
 * Platform commission (rules #9, #20).
 *
 * The prototype had one hardcoded `COMMISSION_RATE = 0.15` while also modelling
 * three plan tiers that meant nothing, and no notion of when commission was
 * actually earned — every screen just multiplied a hardcoded revenue figure.
 * ========================================================================== */

/** Defaults by plan. The org's own `commissionRateBps` is the authority. */
export const DEFAULT_COMMISSION_BPS: Readonly<Record<PlanTier, number>> = {
  starter: 1800,
  professional: 1500,
  enterprise: 1200,
}

export function defaultCommissionBps(planTier: PlanTier): number {
  return DEFAULT_COMMISSION_BPS[planTier]
}

/**
 * Commission on a booking total (rule #9).
 *
 * Basis points, not a decimal fraction: `0.15` is a float and floats have no
 * place in a ledger, and bps let a negotiated 12.5% be exactly `1250`.
 */
export function commissionFor(total: Cents, rateBps: number): Cents {
  return bpsOf(total, rateBps)
}

/**
 * Whether the platform has actually earned its commission (rule #9).
 *
 * Commission is the price of a delivered service. A guest who never stayed
 * means nothing was delivered, and what the property keeps from a cancellation
 * is compensation for a room it held and could not resell — not revenue to
 * take a cut of.
 *
 * `void` keeps the amount for reporting rather than zeroing it, which is what
 * makes "commission lost to cancellations" answerable.
 */
export function commissionStatusFor(status: BookingStatus): CommissionStatus {
  switch (status) {
    case "completed":
      return "earned"
    case "cancelled":
    case "no_show":
      return "void"
    case "pending":
    case "confirmed":
    case "checked_in":
      return "pending"
  }
}

/** What the property receives once a stay completes. */
export function partnerPayout(total: Cents, commission: Cents): Cents {
  return total - commission
}

/** Only `earned` commission enters a payout run. */
export function isPayable(status: CommissionStatus): boolean {
  return status === "earned"
}
