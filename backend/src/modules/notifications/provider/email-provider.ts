/* ============================================================================
 * The email port (rule #55).
 *
 * Same reasoning as the payment and payout ports: the thing most likely to
 * change here is the vendor, and behind an interface that is one file.
 *
 * What does NOT live behind it is the content. Templates are rendered in this
 * repo and the provider is handed finished HTML — see `templates/`. A hosted
 * template would put the cancellation sentence somewhere a marketer could edit
 * it, and rule #1 exists precisely because an editable sentence and an
 * enforced refund drift apart.
 * ========================================================================== */

export type EmailMessage = {
  to: string
  subject: string
  html: string
  /** For clients that refuse HTML, and for spam scores. */
  text: string
  /**
   * Ours, from the outbox row.
   *
   * SendGrid deduplicates on it, so a worker that times out after handing the
   * message over does not send it twice on the next pass.
   */
  idempotencyKey: string
}

export type EmailResult =
  | { ok: true; providerRef: string }
  /**
   * `retryable` decides whether the worker tries again.
   *
   * A 5xx or a timeout is worth another go; "that address does not exist" is
   * not, and retrying it four more times is how a sending domain earns a
   * reputation problem.
   */
  | { ok: false; retryable: boolean; error: string }

export interface EmailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<EmailResult>
}

export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER")
