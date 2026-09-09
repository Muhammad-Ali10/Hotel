/* ============================================================================
 * The payout port (rule #43, the other direction).
 *
 * Kept apart from `PaymentProvider` on purpose. Taking money from a card and
 * sending money to a bank account are different APIs, often different products,
 * and sometimes different companies entirely — a platform can perfectly well
 * collect through one processor and pay out through another. Folding both into
 * one interface would force every adapter to implement half of something it
 * does not do.
 * ========================================================================== */

export type TransferInput = {
  /** Our payout id — echoed back for reconciliation. */
  payoutId: string
  /** The provider's handle on the destination account. Never bank digits. */
  accountRef: string
  /** Cents. Always positive: an invoice is not a negative transfer. */
  amount: number
  currency: string
  description: string
  /**
   * Ours, derived from the payout.
   *
   * A retried transfer with the same key has to be the SAME transfer. Without
   * it, a job that times out after the money left sends it again on the next
   * run, and the second one is not recoverable.
   */
  idempotencyKey: string
}

export type TransferResult = {
  providerRef: string
  outcome: "paid" | "failed"
  failureReason?: string
}

export interface PayoutProvider {
  readonly name: string
  transfer(input: TransferInput): Promise<TransferResult>
}

export const PAYOUT_PROVIDER = Symbol("PAYOUT_PROVIDER")
