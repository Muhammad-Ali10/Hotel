import { randomUUID } from "node:crypto"

import { Injectable } from "@nestjs/common"

import type { PayoutProvider, TransferInput, TransferResult } from "./payout-provider"

/**
 * The payout provider used by tests and local development.
 *
 * Idempotent by the same key the real one would use, and steered by the amount
 * so a test can ask for the failure it wants:
 *
 *   amount ending in 01 → the transfer is rejected
 *   anything else       → it goes through
 */
@Injectable()
export class FakePayoutProvider implements PayoutProvider {
  readonly name = "fake"

  private readonly sent = new Map<string, TransferResult>()

  transfer(input: TransferInput): Promise<TransferResult> {
    // A retry with the same key is the same transfer, not a second one. This
    // is the behaviour worth reproducing: the bug it prevents is money leaving
    // twice, and it is not recoverable.
    const already = this.sent.get(input.idempotencyKey)
    if (already) return Promise.resolve(already)

    const result: TransferResult =
      input.amount % 100 === 1
        ? {
            providerRef: `fake_tr_${randomUUID()}`,
            outcome: "failed",
            failureReason: "The destination account rejected the transfer.",
          }
        : { providerRef: `fake_tr_${randomUUID()}`, outcome: "paid" }

    this.sent.set(input.idempotencyKey, result)
    return Promise.resolve(result)
  }

  /** How many DISTINCT transfers were sent — the number a test asserts on. */
  get transferCount(): number {
    return this.sent.size
  }

  reset(): void {
    this.sent.clear()
  }
}
