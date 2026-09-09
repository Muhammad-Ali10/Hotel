import { randomUUID } from "node:crypto"

import { Injectable } from "@nestjs/common"

import type { EmailMessage, EmailProvider, EmailResult } from "./email-provider"

/**
 * The email provider used by tests and local development.
 *
 * It keeps what it was handed, so a test can assert on the message a guest
 * would actually have received — the subject, the figures, the cancellation
 * sentence — rather than only that something was queued.
 *
 * Failures are steered by the address, so a test asks for what it wants:
 *
 *   bounce@…  → permanent failure, never retried
 *   flaky@…   → fails the first two attempts, then succeeds
 */
@Injectable()
export class FakeEmailProvider implements EmailProvider {
  readonly name = "fake"

  private readonly outbox: EmailMessage[] = []
  private readonly attemptsByKey = new Map<string, number>()

  send(message: EmailMessage): Promise<EmailResult> {
    const attempt = (this.attemptsByKey.get(message.idempotencyKey) ?? 0) + 1
    this.attemptsByKey.set(message.idempotencyKey, attempt)

    if (message.to.startsWith("bounce@")) {
      // The address does not exist. The next attempt has the same address.
      return Promise.resolve({
        ok: false,
        retryable: false,
        error: "550 mailbox unavailable",
      })
    }

    if (message.to.startsWith("flaky@") && attempt <= 2) {
      return Promise.resolve({ ok: false, retryable: true, error: "503 try again" })
    }

    this.outbox.push(message)
    return Promise.resolve({ ok: true, providerRef: `fake_msg_${randomUUID()}` })
  }

  /* --------------------------------------------------------- test helpers -- */

  /** Everything actually delivered, in order. */
  get sent(): readonly EmailMessage[] {
    return this.outbox
  }

  /** The most recent message to an address, for asserting on its content. */
  lastTo(email: string): EmailMessage | undefined {
    return [...this.outbox].reverse().find((m) => m.to === email)
  }

  countTo(email: string): number {
    return this.outbox.filter((m) => m.to === email).length
  }

  reset(): void {
    this.outbox.length = 0
    this.attemptsByKey.clear()
  }
}
