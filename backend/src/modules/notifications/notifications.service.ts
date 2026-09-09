import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common"
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  MAX_SEND_ATTEMPTS,
  NOTIFICATIONS,
  dedupeKey,
  copyOf,
  definitionOf,
  isSwitchable,
  maySend,
  overrideKey,
  retryDelaySeconds,
  type NotificationAudience,
  type NotificationChannel,
  type NotificationOverrides,
  type NotificationSettings,
  type NotificationTemplate,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import {
  NotificationsRepository,
  type NotificationRow,
  type OutboxRow,
} from "./notifications.repository"
import { EMAIL_PROVIDER, type EmailProvider } from "./provider/email-provider"
import { render, type TemplatePayload } from "./templates"
import { env } from "../../config/env"

/**
 * How long a claimed message is invisible to other workers.
 *
 * A lease rather than a `sending` status: it needs no extra state and no
 * reaper, because a worker that dies simply stops renewing and the row falls
 * due again by itself.
 */
const CLAIM_LEASE_SECONDS = 300

/** Anything the caller can pass so the write joins their transaction. */
type Executor = Parameters<NotificationsRepository["enqueue"]>[1]

export type NotifyInput = {
  template: NotificationTemplate
  /** The thing this is about — a booking, a payout, a reset. */
  subjectId: string
  /** `null` for an address with no account behind it. */
  userId: string | null
  toEmail: string
  payload: TemplatePayload
  /** In-app title and body. Omitted for email-only messages. */
  inApp?: { title: string; message: string; href?: string }
}

/**
 * What `notify` actually did.
 *
 * Almost every caller ignores it, and should: a booking confirmation happens
 * whether or not the guest wants the email. It exists for the one caller that
 * has to REPORT a number to a person — an administrator sending an
 * announcement is owed the count of messages that were really queued, not the
 * count of customers who were considered and mostly declined. A number on a
 * screen that means "considered" while reading "queued" is the kind of thing
 * somebody plans a campaign around.
 */
export type NotifyResult = { emailed: boolean; inApped: boolean }

/**
 * A message due this long ago and still waiting is not backing off, it is
 * stuck. The delivery job runs every minute, so ten of them is a wide margin —
 * wide enough that a slow provider or a restart does not raise an alarm.
 */
const STUCK_AFTER_MINUTES = 10

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly repo: NotificationsRepository,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider
  ) {}

  /* --------------------------------------------------------------- notify */

  /**
   * Records that something happened, and queues whatever should go out (#57).
   *
   * `tx` is the point of the signature. Passing the caller's transaction means
   * the notification lands with the booking or not at all — and nothing about
   * SendGrid's availability can reach the path that confirms a reservation.
   *
   * Never throws. A message that cannot be recorded must not undo the thing it
   * was describing; the worst outcome here is a guest who was not told, and
   * the worst outcome of the alternative is a booking that silently failed.
   */
  async notify(input: NotifyInput, tx?: Executor): Promise<NotifyResult> {
    let emailed = false
    let inApped = false

    try {
      const definition = definitionOf(input.template)
      const settings = input.userId ? await this.settingsFor(input.userId) : DEFAULT_NOTIFICATION_SETTINGS
      // Per-message switches (rule #105). Empty for a recipient with no
      // account — there is nobody whose preference it could be.
      const overrides = input.userId ? await this.overridesFor(input.userId) : {}

      if (
        input.inApp &&
        input.userId &&
        maySend({ template: input.template, channel: "in_app", settings, overrides })
      ) {
        await this.repo.createInApp(
          {
            userId: input.userId,
            template: input.template,
            kind: definition.kind,
            audience: definition.audience,
            title: input.inApp.title,
            message: input.inApp.message,
            href: input.inApp.href ?? null,
          },
          tx
        )
        inApped = true
      }

      if (maySend({ template: input.template, channel: "email", settings, overrides })) {
        await this.repo.enqueue(
          {
            userId: input.userId,
            template: input.template,
            dedupeKey: dedupeKey({ template: input.template, subjectId: input.subjectId }),
            channel: "email",
            toEmail: input.toEmail,
            payload: input.payload,
          },
          tx
        )
        emailed = true
      }
    } catch (error) {
      this.logger.error(
        `Could not record notification ${input.template}`,
        error instanceof Error ? error.stack : error
      )
    }

    return { emailed, inApped }
  }

  /* ---------------------------------------------------------------- offer */

  /**
   * An announcement to every customer who agreed to hear from us.
   *
   * The `offer` template has existed since the notification registry was
   * written, complete with a subject and a body, and nothing has ever sent
   * one — it was a message the product could describe but not deliver.
   *
   * Three things make this safe to expose to an administrator:
   *
   *  - **Consent is not a parameter.** The audience is fixed in the query and
   *    every message still passes `maySend`, which reads the person's own
   *    marketing switch. There is no shape of request that reaches somebody
   *    who said no.
   *  - **The idempotency key is the campaign.** `subjectId` is the key and the
   *    recipient together, so a retried request enqueues nothing new, while a
   *    genuinely new announcement is a different key and goes out properly.
   *    Without the recipient in there the unique index would deliver the whole
   *    campaign to the first customer and nobody else.
   *  - **It queues, it does not send.** Every message goes to the outbox and
   *    leaves through the same worker as everything else, so a campaign cannot
   *    monopolise the provider or hold an HTTP request open for ten thousand
   *    round trips.
   */
  async sendOffer(input: {
    title: string
    body: string
    idempotencyKey: string
  }): Promise<{ queued: number }> {
    const PAGE = 500
    const MAX_PAGES = 200

    let afterId: string | null = null
    let queued = 0

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const customers = await this.repo.customersForOffer({ limit: PAGE, afterId })
      if (customers.length === 0) break

      for (const customer of customers) {
        const result = await this.notify({
          template: "offer",
          subjectId: `${input.idempotencyKey}:${customer.id}`,
          userId: customer.id,
          toEmail: customer.email,
          payload: { title: input.title, body: input.body },
          inApp: { title: input.title, message: input.body.slice(0, 200) },
        })
        // Only what was really enqueued. Everyone else declined marketing, and
        // reporting them as sent would overstate every campaign ever run.
        if (result.emailed) queued++
      }

      if (customers.length < PAGE) break
      afterId = customers[customers.length - 1]!.id
    }

    this.logger.log(`Offer "${input.title}" queued for ${queued} customers`)
    return { queued }
  }

  /* --------------------------------------------------------------- worker */

  /**
   * Sends what is due.
   *
   * Each message is handled on its own: one bad address must not stop the
   * queue behind it, which is exactly what a single try/catch around the loop
   * would do.
   */
  /**
   * Is mail actually going out?
   *
   * The verdict, not just the numbers, because the numbers only mean something
   * next to the configuration. `pending: 40` is a healthy queue on a busy
   * morning and a dead one on a quiet afternoon; what settles it is whether
   * anything has been SENT recently and how long the oldest message has waited.
   *
   * `driver: "fake"` is called out on its own. It is the correct setting for
   * local work and for tests, and it is also the one that looks perfect in
   * production: every message is accepted, marked sent, and delivered nowhere.
   */
  async deliveryHealth(now = new Date()) {
    const counts = await this.repo.deliveryHealth({
      now: now.toISOString(),
      stuckAfterMinutes: STUCK_AFTER_MINUTES,
    })

    const sending = env.MAIL_DRIVER !== "fake"

    const status = !sending
      ? ("not_sending" as const)
      : counts.stuck > 0
        ? ("stuck" as const)
        : counts.failedLastHour > 0 && counts.sentLastHour === 0
          ? ("failing" as const)
          : ("ok" as const)

    return {
      status,
      driver: env.MAIL_DRIVER,
      from: env.MAIL_FROM,
      stuckAfterMinutes: STUCK_AFTER_MINUTES,
      ...counts,
    }
  }

  async deliverDue(now = new Date()) {
    const due = await this.repo.claimDue({
      now: now.toISOString(),
      limit: 50,
      // Long enough for the slowest send, short enough that a worker which
      // dies mid-message does not strand it for the afternoon.
      leaseSeconds: CLAIM_LEASE_SECONDS,
    })

    let sent = 0
    let failed = 0

    for (const row of due) {
      try {
        const result = await this.deliver(row, now)
        if (result === "sent") sent++
        if (result === "failed") failed++
      } catch (error) {
        this.logger.error(
          `Delivery of ${row.id} threw`,
          error instanceof Error ? error.stack : error
        )
      }
    }

    if (sent > 0 || failed > 0) {
      this.logger.log(`Notifications: ${sent} sent, ${failed} failed`)
    }
    return { sent, failed, examined: due.length }
  }

  private async deliver(row: OutboxRow, now: Date): Promise<"sent" | "failed" | "retry"> {
    /*
     * The settings are checked again HERE, not only at enqueue.
     *
     * Somebody who switched marketing off between the queue and the send has
     * said something more recent than the queue has, and the send is the last
     * moment the answer still matters.
     */
    if (row.userId) {
      const settings = await this.settingsFor(row.userId)
      if (
        !maySend({
          template: row.template as NotificationTemplate,
          channel: "email",
          settings,
        })
      ) {
        await this.repo.markSuppressed(row.id)
        return "failed"
      }
    }

    const content = render(row.template as NotificationTemplate, row.payload as TemplatePayload)

    const result = await this.email.send({
      to: row.toEmail,
      subject: content.subject,
      html: content.html,
      text: content.text,
      // The outbox id, so a worker that dies after handing the message over
      // does not send it again on the next pass.
      idempotencyKey: row.id,
    })

    if (result.ok) {
      await this.repo.markSent({ id: row.id, providerRef: result.providerRef, now: now.toISOString() })
      return "sent"
    }

    // `claimDue` already counted this try, so `row.attempts` includes it.
    const attempts = row.attempts
    const giveUp = !result.retryable || attempts >= MAX_SEND_ATTEMPTS

    await this.repo.markAttemptFailed({
      id: row.id,
      error: result.error,
      // `null` stops it: either the failure will not clear, or we have tried
      // enough times that continuing only damages the sending domain.
      nextAttemptAt: giveUp
        ? null
        : new Date(now.getTime() + retryDelaySeconds(attempts) * 1000).toISOString(),
      now: now.toISOString(),
    })

    return giveUp ? "failed" : "retry"
  }

  /* ----------------------------------------------------------- recipients */

  /** Who to tell at a property. `null` when the org has no active admin. */
  recipientForProperty(propertyId: string) {
    return this.repo.recipientForProperty(propertyId)
  }

  /** Who to tell at an organisation. */
  recipientForOrg(orgId: string) {
    return this.repo.recipientForOrg(orgId)
  }

  /* ----------------------------------------------------------------- read */

  async listFor(user: AuthenticatedUser, query: { limit: number; unreadOnly: boolean }) {
    const [rows, unread] = await Promise.all([
      this.repo.listFor({ userId: user.id, ...query }),
      this.repo.unreadCountFor(user.id),
    ])
    return { items: rows.map(toDto), unread }
  }

  /** 404, never 403 — a 403 would confirm the id is real (API1). */
  async markRead(input: { id: string; user: AuthenticatedUser }) {
    const row = await this.repo.markRead({
      id: input.id,
      userId: input.user.id,
      now: new Date().toISOString(),
    })
    // Already read is not a failure; not yours is.
    if (!row) throw new NotFoundException("Notification not found")
    return toDto(row)
  }

  async markAllRead(user: AuthenticatedUser) {
    const count = await this.repo.markAllRead(user.id, new Date().toISOString())
    return { read: count }
  }

  /* ------------------------------------------------------------- settings */

  async settingsFor(userId: string): Promise<NotificationSettings> {
    const row = await this.repo.settingsFor(userId)
    // Absent means the defaults, so nobody has to be given a row to sign up.
    return row
      ? {
          emailUseful: row.emailUseful,
          emailMarketing: row.emailMarketing,
        }
      : DEFAULT_NOTIFICATION_SETTINGS
  }

  /**
   * A person's per-message switches, keyed the way `maySend` reads them.
   */
  async overridesFor(userId: string): Promise<NotificationOverrides> {
    const rows = await this.repo.overridesFor(userId)
    const out: NotificationOverrides = {}
    for (const row of rows) {
      out[overrideKey(row.template as NotificationTemplate, row.channel as NotificationChannel)] =
        row.enabled
    }
    return out
  }

  /**
   * Every message a person may switch, with its current state.
   *
   * Built from the CATALOGUE rather than from what they have stored, so a
   * template added last week appears with its default rather than being
   * invisible until somebody touches it.
   *
   * `essential` is left out entirely (rule #56) — an invoice or a booking
   * confirmation is a record of something that happened to somebody's money,
   * and a switch that will not be honoured is worse than no switch.
   */
  async preferencesFor(user: AuthenticatedUser) {
    const [settings, overrides] = await Promise.all([
      this.settingsFor(user.id),
      this.overridesFor(user.id),
    ])

    /*
     * A partner has no business switching a guest's messages, or the reverse.
     *
     * `admin` sees everything: the platform's own staff are on the receiving
     * end of both sides, and hiding half the list from them would be hiding
     * the messages they are most likely to be debugging.
     */
    const audience = audienceFor(user)

    const items = (Object.keys(NOTIFICATIONS) as NotificationTemplate[])
      .filter((template) => isSwitchable(template))
      .map((template) => definitionOf(template))
      .filter((definition) => audience === null || definition.audience === audience)
      .map((definition) => {
        /*
         * Narrowed once, here. `definitionOf` returns the union of every
         * entry, and TypeScript widens `template` to `string` across it — so
         * each use inside the map would otherwise need its own assertion.
         */
        const template = definition.template as NotificationTemplate
        const channels = definition.channels as readonly NotificationChannel[]

        return {
          template,
          klass: definition.klass,
          /*
           * The words come from the catalogue, not from the screen.
           *
           * The extranet and the dashboard both render this list; humanising
           * `partner_new_review` in each of them is how one surface ends up
           * calling a switch something the other does not.
           */
          ...copyOf(template),
          channels: channels.map((channel) => ({
            channel,
            enabled: maySend({ template, channel, settings, overrides }),
            /** True when this is their own choice rather than the default. */
            isSet: overrides[overrideKey(template, channel)] !== undefined,
          })),
        }
      })

    return { settings, items }
  }

  /**
   * Flipping switches.
   *
   * An essential template is refused rather than ignored: silently accepting a
   * switch that will never be honoured is how a person ends up believing they
   * turned something off.
   */
  async savePreferences(input: {
    user: AuthenticatedUser
    rows: readonly { template: string; channel: string; enabled: boolean }[]
  }) {
    for (const row of input.rows) {
      const template = row.template as NotificationTemplate
      if (!(template in NOTIFICATIONS)) {
        throw new BadRequestException(`There is no message called ${row.template}`)
      }
      if (!isSwitchable(template)) {
        throw new BadRequestException(
          `${row.template} is essential and cannot be switched off`
        )
      }
      const definition = definitionOf(template)

      const channels: readonly string[] = definition.channels
      if (!channels.includes(row.channel)) {
        throw new BadRequestException(
          `${row.template} is never sent by ${row.channel}`
        )
      }

      /*
       * The same audience rule the LIST applies (rule #105).
       *
       * Without this the read path and the write path disagreed: the list a
       * partner is shown excludes a guest's messages, and a hand-made PATCH
       * for one was still stored — an override that will never be consulted,
       * against a message this account can never receive. Refused, not
       * ignored, for the same reason an essential template is.
       */
      const audience = audienceFor(input.user)
      if (audience !== null && definition.audience !== audience) {
        throw new BadRequestException(
          `${row.template} is not a message this account receives`
        )
      }
    }

    await this.repo.saveOverrides({ userId: input.user.id, rows: input.rows })
    return this.preferencesFor(input.user)
  }

  async saveSettings(input: { user: AuthenticatedUser; patch: Partial<NotificationSettings> }) {
    const row = await this.repo.saveSettings({ userId: input.user.id, patch: input.patch })
    return {
      emailUseful: row.emailUseful,
      emailMarketing: row.emailMarketing,
    }
  }
}

/**
 * Whose messages this account may see and switch.
 *
 * `null` for an admin, meaning "all of them": the platform's own staff sit on
 * the receiving end of both sides, and hiding half the catalogue from them
 * would hide exactly the messages they are most likely to be debugging.
 */
function audienceFor(user: AuthenticatedUser): NotificationAudience | null {
  if (user.role === "admin") return null
  return user.role === "partner" ? "partner" : "customer"
}

/** Explicit fields — a column added later cannot leak into a response (API3). */
function toDto(row: NotificationRow) {
  return {
    id: row.id,
    type: row.kind,
    audience: row.audience,
    title: row.title,
    message: row.message,
    href: row.href,
    read: row.readAt !== null,
    createdAt: row.createdAt,
  }
}
