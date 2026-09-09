import { z } from "zod"

import type {
  PaymentIntentKind,
  PaymentMode,
  PaymentStatus,
} from "../types/payment"
import { uuidSchema } from "./common"

/* ============================================================================
 * Payment contracts (Module 7).
 *
 * Note what a client NEVER sends: an amount. Not once, anywhere in this file.
 * The sum to charge comes from the booking, which came from a signed quote —
 * the same rule that makes pricing server-authoritative would be worth nothing
 * if the payment step accepted a number.
 * ========================================================================== */

/* ------------------------------------------------------------- start pay -- */

/**
 * Starting payment for a booking the guest already holds.
 *
 * Only the booking id. The mode, the amount and the currency are all read from
 * the booking server-side; a client that could name them could pay one dollar
 * for a suite, or turn a prepay rate into a guarantee and never pay at all.
 */
export const startPaymentSchema = z
  .object({
    bookingId: uuidSchema,
    /**
     * Where the provider should send the guest back after 3-D Secure.
     *
     * Validated as a path, not a URL: an absolute one would let a caller
     * bounce a guest — mid-payment, from a page they trust — to any host they
     * like. The API prefixes its own origin.
     */
    returnPath: z
      .string()
      .trim()
      .max(512)
      .regex(/^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?]*$/, "Use a path beginning with /")
      .optional(),
  })
  .strict()

export type StartPaymentInput = z.infer<typeof startPaymentSchema>

/**
 * What the client needs to finish the payment, and nothing more.
 *
 * `clientSecret` is scoped to this one intent by the provider. There is no
 * provider customer id, no saved-card token and no raw provider payload here:
 * those identify a person's whole payment history, and the checkout page has
 * no use for them.
 */
export type PaymentSession = {
  paymentId: string
  status: PaymentStatus
  mode: PaymentMode
  /** Cents. `0` for a guarantee — the card is verified, not charged. */
  amount: number
  currency: string
  /** Present while the provider still needs the guest. */
  clientSecret: string | null
  /** Set when the provider wants the guest on its own page instead. */
  redirectUrl: string | null
}

/* ----------------------------------------------------------------- read --- */

export type PaymentView = {
  id: string
  bookingId: string
  kind: PaymentIntentKind
  status: PaymentStatus
  amount: number
  amountRefunded: number
  currency: string
  /** Last four digits and brand — enough to recognise a card, useless to steal. */
  cardBrand: string | null
  cardLast4: string | null
  failureReason: string | null
  createdAt: string
}

/* ------------------------------------------------------------- webhooks --- */

/**
 * What the API keeps from a provider callback.
 *
 * Deliberately NOT a zod schema of the provider's payload: every provider
 * shapes theirs differently, and parsing one here would put a provider's field
 * names in shared code that the domain is supposed to be free of. The adapter
 * translates; this is what comes out.
 */
export type ProviderEvent = {
  /** The provider's own event id — the idempotency key for replays. */
  id: string
  type: "payment.authorized" | "payment.captured" | "payment.failed" | "payment.refunded"
  /** The provider's reference for the intent, matched back to our payment row. */
  providerRef: string
  /** Cents, as the provider reports them — reconciled against our own figure. */
  amount: number
  currency: string
  cardBrand?: string
  cardLast4?: string
  /**
   * The provider's handle on the card the guest just proved.
   *
   * This is what makes a guarantee worth anything: without it the platform has
   * verified a card it cannot subsequently charge, and every cancellation
   * penalty and no-show fee under rule #42 quietly becomes uncollectable.
   */
  providerMethodRef?: string
  failureReason?: string
}
