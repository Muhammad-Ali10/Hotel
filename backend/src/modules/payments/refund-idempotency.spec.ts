import { describe, expect, it } from "vitest"

import { FakePaymentProvider } from "./provider/fake.provider"

/**
 * The refund idempotency key, and what it can and cannot tell apart.
 *
 * `PaymentsService.refund()` derives its key as `refund:<paymentId>:<amount>`.
 * That is right for a RETRY — asking the provider for the same refund twice
 * must not send money twice — and wrong for two genuinely different refunds
 * that happen to be the same amount, which the admin goodwill path makes
 * reachable for the first time.
 *
 * These tests pin the provider's behaviour, which is what the bug rests on.
 */
describe("refund idempotency", () => {
  async function chargedIntent(amount: number) {
    const provider = new FakePaymentProvider()
    const intent = await provider.createIntent({
      paymentId: "pay_1",
      amount,
      currency: "USD",
      description: "Test stay",
      returnUrl: "https://stayora.test/return",
      customer: { email: "guest@stayora.test", name: "Amelia Hart" },
    })
    await provider.capture({ providerRef: intent.providerRef, amount })
    return { provider, providerRef: intent.providerRef }
  }

  it("refuses to send the same refund twice — which is the point", async () => {
    const { provider, providerRef } = await chargedIntent(100_000)
    const key = "refund:pay_1:10000"

    const first = await provider.refund({ providerRef, amount: 10_000, idempotencyKey: key })
    const retry = await provider.refund({ providerRef, amount: 10_000, idempotencyKey: key })

    expect(first.refunded).toBe(10_000)
    // The SAME figure comes back, and no second refund was sent.
    expect(retry.refunded).toBe(10_000)
  })

  /*
   * The failure this pins down.
   *
   * Two DIFFERENT goodwill refunds of $100 each derive the same key, so the
   * provider replays the first and reports $100 — while the caller records
   * another $100 against the ledger. The books then say $200 went back and the
   * guest received $100.
   *
   * Reachable only now: until the admin refund existed, nothing issued two
   * separate refunds of the same amount against one payment.
   */
  it("cannot tell two distinct refunds of equal size apart on the amount alone", async () => {
    const { provider, providerRef } = await chargedIntent(100_000)
    const derivedKey = (amount: number) => `refund:pay_1:${amount}`

    await provider.refund({ providerRef, amount: 10_000, idempotencyKey: derivedKey(10_000) })
    const second = await provider.refund({
      providerRef,
      amount: 10_000,
      idempotencyKey: derivedKey(10_000),
    })

    // Reports success, sent nothing. A caller that trusts this and increments
    // its own ledger has just lost $100 of the guest's money on paper.
    expect(second.refunded).toBe(10_000)
  })

  /**
   * The fix: a key that identifies the INSTRUCTION, not the amount.
   *
   * A retry of one instruction carries the same key and is deduplicated; two
   * separate decisions carry different keys and both go out.
   */
  it("tells them apart when the key names the instruction", async () => {
    const { provider, providerRef } = await chargedIntent(100_000)

    const a = await provider.refund({
      providerRef,
      amount: 10_000,
      idempotencyKey: "refund:pay_1:goodwill-a",
    })
    const b = await provider.refund({
      providerRef,
      amount: 10_000,
      idempotencyKey: "refund:pay_1:goodwill-b",
    })
    const retryOfA = await provider.refund({
      providerRef,
      amount: 10_000,
      idempotencyKey: "refund:pay_1:goodwill-a",
    })

    expect(a.refunded).toBe(10_000)
    expect(b.refunded).toBe(10_000)
    // The retry replays rather than sending a third.
    expect(retryOfA.refunded).toBe(10_000)
  })

  it("never refunds more than was captured, whatever the keys say", async () => {
    const { provider, providerRef } = await chargedIntent(15_000)

    const a = await provider.refund({ providerRef, amount: 10_000, idempotencyKey: "k1" })
    const b = await provider.refund({ providerRef, amount: 10_000, idempotencyKey: "k2" })

    expect(a.refunded).toBe(10_000)
    // Only $50 was left. The provider is the last line, and it holds.
    expect(b.refunded).toBe(5_000)
  })
})
