import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

import { Injectable } from "@nestjs/common"
import type { ProviderEvent } from "@stayora/shared"

import { env } from "../../../config/env"
import type {
  CaptureInput,
  ChargeSavedCardInput,
  CreateIntentInput,
  PaymentProvider,
  ProviderIntent,
  ProviderResult,
  RefundInput,
  RefundResult,
} from "./payment-provider"

/**
 * The provider used by tests and local development.
 *
 * It is not a stub that returns success. It reproduces the behaviour that
 * breaks real integrations — 3-D Secure detours, declines, retried webhooks —
 * because those paths are the ones worth having tests for, and they are the
 * hardest to trigger against a sandbox on demand.
 *
 * Behaviour is steered by the amount, so a test asks for what it wants:
 *
 *   amount ending in 01 → the card is declined
 *   amount ending in 02 → 3-D Secure: the intent needs the guest first
 *   anything else       → straight through
 *
 * A guarantee (amount 0) authorizes and hands back a saved-card reference.
 */
@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake"

  private readonly intents = new Map<
    string,
    { paymentId: string; amount: number; refunded: number; methodRef: string }
  >()

  createIntent(input: CreateIntentInput): Promise<ProviderIntent> {
    const providerRef = `fake_pi_${randomUUID()}`
    this.intents.set(providerRef, {
      paymentId: input.paymentId,
      amount: input.amount,
      refunded: 0,
      methodRef: `fake_pm_${randomUUID()}`,
    })

    const requiresAction = input.amount % 100 === 2
    return Promise.resolve({
      providerRef,
      clientSecret: `${providerRef}_secret`,
      redirectUrl: requiresAction ? `https://fake-3ds.test/${providerRef}` : null,
      requiresAction,
    })
  }

  capture(input: CaptureInput): Promise<ProviderResult> {
    const intent = this.intents.get(input.providerRef)
    return Promise.resolve(
      intent === undefined
        ? { providerRef: input.providerRef, outcome: "failed", failureReason: "No such intent" }
        : { providerRef: input.providerRef, outcome: "captured", ...CARD }
    )
  }

  chargeSavedCard(input: ChargeSavedCardInput): Promise<ProviderResult> {
    const providerRef = `fake_pi_${randomUUID()}`
    if (input.amount % 100 === 1) {
      return Promise.resolve({
        providerRef,
        outcome: "failed",
        failureReason: "Your card was declined.",
      })
    }

    this.intents.set(providerRef, {
      paymentId: input.paymentId,
      amount: input.amount,
      refunded: 0,
      methodRef: input.providerMethodRef,
    })
    return Promise.resolve({ providerRef, outcome: "captured", ...CARD })
  }

  refund(input: RefundInput): Promise<RefundResult> {
    const intent = this.intents.get(input.providerRef)
    if (!intent) return Promise.resolve({ refunded: 0, replayed: false })

    /*
     * Idempotent by construction: the same key never refunds twice.
     *
     * `replayed` is what the caller needs to know. The amount alone looks
     * identical to a fresh refund, and a caller that increments its ledger on
     * it records money that never left.
     */
    const already = this.refunds.get(input.idempotencyKey)
    if (already !== undefined) return Promise.resolve({ refunded: already, replayed: true })

    const refunded = Math.min(input.amount, intent.amount - intent.refunded)
    intent.refunded += refunded
    this.refunds.set(input.idempotencyKey, refunded)
    return Promise.resolve({ refunded, replayed: false })
  }

  cancelIntent(providerRef: string): Promise<void> {
    this.intents.delete(providerRef)
    return Promise.resolve()
  }

  /**
   * Signed exactly the way a real provider signs: HMAC over the RAW bytes.
   *
   * Tests go through the same verification the production adapter does, so a
   * regression in "we forgot to keep the raw body" fails here rather than in
   * the first webhook of the first real payment.
   */
  parseWebhook(rawBody: Buffer, signature: string | undefined): ProviderEvent | null {
    if (!signature) return null

    const expected = signWebhook(rawBody)
    const given = Buffer.from(signature, "utf8")
    const want = Buffer.from(expected, "utf8")
    // Length check first — `timingSafeEqual` throws on a mismatch.
    if (given.length !== want.length || !timingSafeEqual(given, want)) return null

    try {
      return JSON.parse(rawBody.toString("utf8")) as ProviderEvent
    } catch {
      return null
    }
  }

  /* --------------------------------------------------------- test helpers -- */

  private readonly refunds = new Map<string, number>()

  /** The saved-card reference this intent would report on its webhook. */
  methodRefFor(providerRef: string): string | undefined {
    return this.intents.get(providerRef)?.methodRef
  }
}

const CARD = { cardBrand: "visa", cardLast4: "4242" } as const

/**
 * The signing helper, exported so tests can produce a valid webhook.
 *
 * Deriving from `SESSION_SECRET` keeps the fake out of the environment
 * schema — a real adapter carries its own secret, and adding one for a test
 * double would make it look like a deployable option.
 */
export function signWebhook(rawBody: Buffer): string {
  return createHmac("sha256", `${env.SESSION_SECRET}:fake-webhook`).update(rawBody).digest("hex")
}
