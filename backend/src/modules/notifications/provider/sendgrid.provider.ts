import { Injectable, Logger } from "@nestjs/common"

import { env } from "../../../config/env"
import type { EmailMessage, EmailProvider, EmailResult } from "./email-provider"

/**
 * Twilio SendGrid (rule #55).
 *
 * Written against the REST API directly rather than the SDK: the surface used
 * here is one POST, and a dependency that ships its own HTTP client, retry
 * policy and logging is a lot of behaviour to inherit for that.
 */
@Injectable()
export class SendGridProvider implements EmailProvider {
  readonly name = "sendgrid"
  private readonly logger = new Logger(SendGridProvider.name)

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!env.SENDGRID_API_KEY) {
      // Configured out. Not retryable — the next attempt has the same config.
      return { ok: false, retryable: false, error: "SENDGRID_API_KEY is not set" }
    }

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
          // SendGrid collapses repeats of the same key, so a worker that dies
          // after handing a message over does not send it again next pass.
          "Idempotency-Key": message.idempotencyKey,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: env.MAIL_FROM, name: env.MAIL_FROM_NAME },
          subject: message.subject,
          content: [
            { type: "text/plain", value: message.text },
            { type: "text/html", value: message.html },
          ],
        }),
        // Without this a hung connection holds a worker slot indefinitely.
        signal: AbortSignal.timeout(15_000),
      })

      if (response.ok) {
        return { ok: true, providerRef: response.headers.get("x-message-id") ?? "" }
      }

      const body = await response.text().catch(() => "")

      /*
       * 4xx is the address or the payload, and both are the same next time.
       * Retrying them four more times is how a sending domain earns a
       * reputation problem; 429 is the exception, because it clears.
       */
      const retryable = response.status >= 500 || response.status === 429
      return {
        ok: false,
        retryable,
        error: `SendGrid ${response.status}: ${body.slice(0, 300)}`,
      }
    } catch (error) {
      // A timeout or a DNS wobble. Worth another go.
      const reason = error instanceof Error ? error.message : String(error)
      this.logger.warn(`SendGrid request failed: ${reason}`)
      return { ok: false, retryable: true, error: reason }
    }
  }
}
