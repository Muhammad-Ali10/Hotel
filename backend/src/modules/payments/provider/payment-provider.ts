import type { ProviderEvent } from "@stayora/shared"

/* ============================================================================
 * The payment provider port (rule #43).
 *
 * Everything above this line speaks `authorize` / `capture` / `refund`. Nothing
 * above it knows a provider's name, its field names, or the shape of its
 * webhooks — the adapter below translates, in both directions.
 *
 * That is not architecture for its own sake. This product's entity is
 * registered in Pakistan, where Stripe does not onboard merchants, so the
 * adapter is a local processor; and processors get swapped when a rate is
 * renegotiated or a market is added. Behind a port that is one file. Wired
 * through the booking flow it would be a rewrite of the part of the system
 * that handles money.
 * ========================================================================== */

/** What the API asks a provider to set up. */
export type CreateIntentInput = {
  /** Our payment id — echoed back on the webhook so replays can be matched. */
  paymentId: string
  /** Cents. `0` means "verify and save this card", not "charge nothing". */
  amount: number
  currency: string
  /** Shown on the guest's statement and the provider's own screens. */
  description: string
  /** Where the provider returns the guest after 3-D Secure. Absolute URL. */
  returnUrl: string
  /** The guest, for the provider's own fraud checks and receipts. */
  customer: { email: string; name: string }
}

export type ProviderIntent = {
  /** The provider's id for this intent. Stored, and never regenerated. */
  providerRef: string
  /** Handed to the browser SDK. Scoped to this one intent. */
  clientSecret: string | null
  /** Set when the provider hosts the payment page itself. */
  redirectUrl: string | null
  /** `true` when the guest still has to do something (3-D Secure). */
  requiresAction: boolean
}

export type CaptureInput = {
  providerRef: string
  /** Cents. Capturing less than was authorized is legal at most providers. */
  amount: number
}

export type ChargeSavedCardInput = {
  paymentId: string
  providerMethodRef: string
  amount: number
  currency: string
  description: string
}

export type RefundInput = {
  providerRef: string
  amount: number
  /** Our own idempotency key — a retried refund must not send money twice. */
  idempotencyKey: string
}

export type RefundResult = {
  /** What the provider says went back. */
  refunded: number
  /**
   * True when this key had already been used and nothing new was sent.
   *
   * Without it a caller cannot tell a fresh refund from a replay — both
   * report the same amount — and increments its own ledger a second time. The
   * books then claim twice what the guest received.
   */
  replayed: boolean
}

export type ProviderResult = {
  providerRef: string
  /** What the provider says happened, already translated. */
  outcome: "authorized" | "captured" | "failed"
  cardBrand?: string
  cardLast4?: string
  /** The provider's token for the saved card, on a guarantee. */
  providerMethodRef?: string
  failureReason?: string
}

/**
 * One processor, behind one interface.
 *
 * Implementations must be idempotent where the input carries a key: a retried
 * `refund` with the same `idempotencyKey` has to be the same refund, not a
 * second one.
 */
export interface PaymentProvider {
  /** The name recorded on every row this adapter creates. */
  readonly name: string

  /** Start a charge, or a zero-amount card verification. */
  createIntent(input: CreateIntentInput): Promise<ProviderIntent>

  /** Take money that was previously authorized. */
  capture(input: CaptureInput): Promise<ProviderResult>

  /** Charge a card saved by an earlier guarantee — a penalty or a no-show fee. */
  chargeSavedCard(input: ChargeSavedCardInput): Promise<ProviderResult>

  /** Send money back. */
  refund(input: RefundInput): Promise<RefundResult>

  /** Release an authorization the booking no longer needs. */
  cancelIntent(providerRef: string): Promise<void>

  /**
   * Verify a webhook's signature and translate it (rule #45).
   *
   * Takes the RAW body, not a parsed object: every provider signs the exact
   * bytes it sent, and `JSON.parse` followed by `JSON.stringify` does not
   * reproduce them. A body parser running before this is how signature
   * verification silently starts failing — or worse, starts passing on a body
   * that was re-serialised.
   *
   * Returns `null` when the signature does not verify. It must never throw a
   * value the caller could mistake for a valid event.
   */
  parseWebhook(rawBody: Buffer, signature: string | undefined): ProviderEvent | null
}

/** Nest injection token — the interface itself cannot be one. */
export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER")
