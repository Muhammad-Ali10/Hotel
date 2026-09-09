import type { UUID } from "../types/common"
import type { NotificationAudience, NotificationType } from "../types/support"

/* ============================================================================
 * What the product tells people, and when (rules #55–#57).
 *
 * The catalogue lives in the domain rather than scattered across the modules
 * that fire the events. Two reasons: "which of these can I switch off" has to
 * be answerable in one place for a settings screen to be honest, and a message
 * added next month has to declare its class rather than default into whatever
 * the caller happened to pass.
 * ========================================================================== */

/**
 * How much of a choice the recipient gets (rule #56).
 *
 * `essential` is not a category of importance, it is a category of CONSENT.
 * A booking confirmation and a refund notice are records of something that
 * happened to somebody's money — not marketing that happens to be useful — and
 * switching them off is not a preference anyone can meaningfully express in
 * advance.
 */
export type NotificationClass = "essential" | "useful" | "marketing"

/** Where a message can go. SMS is a port with no adapter yet. */
export type NotificationChannel = "email" | "in_app"

/*
 * `NotificationType` and `NotificationAudience` already live in
 * `types/support.ts`, where the dashboard's own shape was modelled. Redefining
 * them here would give the product two spellings of the same idea, which is
 * the split this package exists to close.
 */

export type NotificationDefinition = {
  /** Stable key. Stored on every row — never renamed, only deprecated. */
  template: string
  klass: NotificationClass
  kind: NotificationType
  audience: NotificationAudience
  channels: readonly NotificationChannel[]
}

/**
 * Every message the product sends.
 *
 * Adding one here is the whole registration: the class decides whether it can
 * be switched off, the channels decide where it goes, and nothing can send a
 * message that is not in this list.
 */
export const NOTIFICATIONS = {
  /* ------------------------------------------------------------- account -- */
  welcome: {
    template: "welcome",
    klass: "essential",
    kind: "system",
    audience: "customer",
    channels: ["email"],
  },
  /**
   * Sent to an address that ALREADY has an account, when somebody tries to
   * sign up with it (rule #58).
   *
   * This is what lets signup stop saying "that email is taken": the truth goes
   * to the person who owns the address, not to whoever typed it into a form.
   */
  signup_existing_account: {
    template: "signup_existing_account",
    klass: "essential",
    kind: "system",
    audience: "customer",
    channels: ["email"],
  },
  verify_email: {
    template: "verify_email",
    klass: "essential",
    kind: "system",
    audience: "customer",
    channels: ["email"],
  },
  password_reset: {
    template: "password_reset",
    klass: "essential",
    kind: "system",
    audience: "customer",
    channels: ["email"],
  },
  password_changed: {
    template: "password_changed",
    klass: "essential",
    kind: "system",
    audience: "customer",
    channels: ["email", "in_app"],
  },

  /* ------------------------------------------------------------ bookings -- */
  booking_confirmed: {
    template: "booking_confirmed",
    klass: "essential",
    kind: "booking",
    audience: "customer",
    channels: ["email", "in_app"],
  },
  booking_cancelled: {
    template: "booking_cancelled",
    klass: "essential",
    kind: "booking",
    audience: "customer",
    channels: ["email", "in_app"],
  },
  /**
   * The hold ran out before the payment landed.
   *
   * Not `booking_cancelled`, though the row ends in the same state. The guest
   * did not cancel anything — they were mid-checkout and something took them
   * away — so being told "your booking is cancelled" reads as a decision
   * somebody made about them. And the useful part is the opposite of a
   * cancellation notice: the room went back on sale, so it is very likely
   * still there, and the message should say so and link them back.
   *
   * `essential` for the same reason every other booking message is: it is not
   * news about the product, it is news about their own money and their own
   * plans, and a setting that could silence it would only ever silence it by
   * accident.
   */
  booking_hold_expired: {
    template: "booking_hold_expired",
    klass: "essential",
    kind: "booking",
    audience: "customer",
    channels: ["email", "in_app"],
  },
  booking_modified: {
    template: "booking_modified",
    klass: "essential",
    kind: "booking",
    audience: "customer",
    channels: ["email", "in_app"],
  },
  refund_issued: {
    template: "refund_issued",
    klass: "essential",
    kind: "booking",
    audience: "customer",
    channels: ["email", "in_app"],
  },
  /** "Your stay is tomorrow." Useful, and genuinely switchable. */
  stay_reminder: {
    template: "stay_reminder",
    klass: "useful",
    kind: "booking",
    audience: "customer",
    channels: ["email", "in_app"],
  },
  review_request: {
    template: "review_request",
    klass: "useful",
    kind: "review",
    audience: "customer",
    channels: ["email", "in_app"],
  },
  offer: {
    template: "offer",
    klass: "marketing",
    kind: "offer",
    audience: "customer",
    channels: ["email", "in_app"],
  },

  /* ------------------------------------------------------------- partner -- */
  /**
   * Somebody has been asked to join a property's team (rule #60).
   *
   * `essential`: it is the only way the invitation arrives, and it goes to an
   * address that may have no account and therefore no preferences at all.
   */
  partner_invite: {
    template: "partner_invite",
    klass: "essential",
    kind: "system",
    audience: "partner",
    channels: ["email"],
  },
  partner_new_booking: {
    template: "partner_new_booking",
    klass: "useful",
    kind: "booking",
    audience: "partner",
    channels: ["email", "in_app"],
  },
  partner_booking_cancelled: {
    template: "partner_booking_cancelled",
    klass: "useful",
    kind: "booking",
    audience: "partner",
    channels: ["email", "in_app"],
  },
  partner_new_review: {
    template: "partner_new_review",
    klass: "useful",
    kind: "review",
    audience: "partner",
    channels: ["email", "in_app"],
  },
  /** Money left for their bank. Not switchable — it is a payment advice. */
  partner_payout_sent: {
    template: "partner_payout_sent",
    klass: "essential",
    kind: "system",
    audience: "partner",
    channels: ["email", "in_app"],
  },
  partner_payout_failed: {
    template: "partner_payout_failed",
    klass: "essential",
    kind: "system",
    audience: "partner",
    channels: ["email", "in_app"],
  },
  /**
   * The month's commission bill (rule #91).
   *
   * `essential` — a partner cannot switch off the message that tells them they
   * owe money. Turning it off and then being moved back to `deduct` for
   * non-payment (rule #95) would be a penalty nobody warned them about.
   */
  invoice_issued: {
    template: "invoice_issued",
    klass: "essential",
    kind: "system",
    audience: "partner",
    channels: ["email", "in_app"],
  },
  /** It has run out of time, and what that costs (rule #95). */
  invoice_overdue: {
    template: "invoice_overdue",
    klass: "essential",
    kind: "system",
    audience: "partner",
    channels: ["email", "in_app"],
  },

  /* --------------------------------------------- registration (rule #103) */

  /**
   * The wizard is over and the account is real.
   *
   * `essential`, like every other message about somebody's own account: this
   * is the one that tells a partner their property is live and where to sign
   * in, and nobody should be able to switch it off and then wonder.
   */
  registration_approved: {
    template: "registration_approved",
    klass: "essential",
    kind: "system",
    audience: "partner",
    channels: ["email", "in_app"],
  },
  /** The platform said no, and why — the note is the whole point. */
  registration_rejected: {
    template: "registration_rejected",
    klass: "essential",
    kind: "system",
    audience: "partner",
    channels: ["email", "in_app"],
  },
} as const satisfies Record<string, NotificationDefinition>

export type NotificationTemplate = keyof typeof NOTIFICATIONS

/**
 * What a settings screen calls each message.
 *
 * Separate from the definition above because it is a different KIND of fact:
 * the definition decides where a message goes and whether it can be refused,
 * this decides what to call it when asking. Keeping it here rather than in
 * each surface is what stops the partner's extranet and the guest's dashboard
 * from inventing two names for the same switch.
 *
 * The `satisfies` is the point: a template added to the catalogue without copy
 * stops the build, rather than shipping a switch labelled `partner_new_review`.
 */
export const NOTIFICATION_COPY = {
  welcome: {
    label: "Welcome",
    description: "Sent once, when the account is created.",
  },
  signup_existing_account: {
    label: "Sign-up on an existing address",
    description: "Tells you somebody tried to register with your email.",
  },
  verify_email: {
    label: "Verify your email",
    description: "The link that proves the address is yours.",
  },
  password_reset: {
    label: "Password reset",
    description: "The link that lets you set a new password.",
  },
  password_changed: {
    label: "Password changed",
    description: "Confirms a password change, so an unexpected one is visible.",
  },
  booking_confirmed: {
    label: "Booking confirmed",
    description: "The record of a stay that was paid for.",
  },
  booking_cancelled: {
    label: "Booking cancelled",
    description: "What was cancelled, and what is being refunded.",
  },
  booking_hold_expired: {
    label: "Booking not completed",
    description: "When a payment is not finished in time and the room goes back on sale.",
  },
  booking_modified: {
    label: "Booking changed",
    description: "New dates, rooms or guests, and the difference in price.",
  },
  refund_issued: {
    label: "Refund issued",
    description: "Confirms money sent back, and to which card.",
  },
  stay_reminder: {
    label: "Stay reminder",
    description: "A few days before check-in, with the address and the times.",
  },
  review_request: {
    label: "Review request",
    description: "After a stay, asking how it went.",
  },
  offer: {
    label: "Offers and inspiration",
    description: "Deals and destinations. Nothing about a stay you have booked.",
  },
  partner_invite: {
    label: "Team invitation",
    description: "Somebody invited you to a property's account.",
  },
  partner_new_booking: {
    label: "New booking",
    description: "A guest has booked one of your rooms.",
  },
  partner_booking_cancelled: {
    label: "Booking cancelled",
    description: "A guest cancelled, with the dates that are now free again.",
  },
  partner_new_review: {
    label: "New review",
    description: "A guest reviewed a stay at your property.",
  },
  partner_payout_sent: {
    label: "Payout sent",
    description: "Money on its way to your account, and what it covers.",
  },
  partner_payout_failed: {
    label: "Payout failed",
    description: "A transfer that did not go through, and what to fix.",
  },
  invoice_issued: {
    label: "Invoice issued",
    description: "A new commission invoice, with what is due and by when.",
  },
  invoice_overdue: {
    label: "Invoice overdue",
    description: "An invoice past its due date.",
  },
  registration_approved: {
    label: "Registration approved",
    description: "Your property was accepted and can start selling.",
  },
  registration_rejected: {
    label: "Registration declined",
    description: "Your application was not accepted, and why.",
  },
} as const satisfies Record<NotificationTemplate, { label: string; description: string }>

/** The words for one message. */
export function copyOf(template: NotificationTemplate): {
  label: string
  description: string
} {
  return NOTIFICATION_COPY[template]
}

export function definitionOf(template: NotificationTemplate): NotificationDefinition {
  return NOTIFICATIONS[template]
}

/* ----------------------------------------------------------- preferences -- */

/**
 * What a person has chosen.
 *
 * `marketing` starts FALSE (rule #56). Opt-in is the only honest default for a
 * message nobody asked for, and it is what the law expects in most markets a
 * booking site reaches.
 */
export type NotificationSettings = {
  emailUseful: boolean
  emailMarketing: boolean
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailUseful: true,
  emailMarketing: false,
}

/**
 * Whether this message may go down this channel to this person (rule #56).
 *
 * `essential` ignores the settings entirely, and that is the point.
 *
 * In-app is treated differently from email on purpose: a dashboard entry sits
 * there until somebody opens their own dashboard, so nothing arrives
 * uninvited. Only the channels that push into a person's day are gated — with
 * the exception of marketing, which is gated everywhere, because a promotional
 * card in a notifications list is still a promotion nobody asked for.
 */
/**
 * One switch a person has flipped for one message on one channel (rule #105).
 *
 * Sparse: no entry means "whatever the class decides", which is what everybody
 * gets until they change something. Storing every combination for every
 * account would be thousands of rows to say what the defaults already say.
 */
export type NotificationOverrides = Partial<
  Record<`${NotificationTemplate}:${NotificationChannel}`, boolean>
>

export function overrideKey(
  template: NotificationTemplate,
  channel: NotificationChannel
): `${NotificationTemplate}:${NotificationChannel}` {
  return `${template}:${channel}`
}

/**
 * Which messages a person is allowed to switch off (rule #56).
 *
 * `essential` is not on the list, and that is the contract rather than an
 * oversight: an invoice, a payout and a booking confirmation are records of
 * something that happened to somebody's money. Offering a toggle would promise
 * a choice the system will not honour — so the toggle does not exist.
 */
export function isSwitchable(template: NotificationTemplate): boolean {
  return NOTIFICATIONS[template].klass !== "essential"
}

export function maySend(input: {
  template: NotificationTemplate
  channel: NotificationChannel
  settings: NotificationSettings
  /** Per-message switches, which win over the coarse ones. */
  overrides?: NotificationOverrides
}): boolean {
  const definition = NOTIFICATIONS[input.template]

  /*
   * `as const` narrows each entry's `channels` to its own literal tuple, so
   * `.includes` would only accept the exact members that entry happens to
   * carry. Widening once here keeps the catalogue's precision where it is
   * useful — reading a definition — without it fighting the lookup.
   */
  const channels: readonly NotificationChannel[] = definition.channels
  // A message can only go where its own definition says it goes.
  if (!channels.includes(input.channel)) return false
  /*
   * Essential is checked BEFORE the overrides, deliberately.
   *
   * A stored override for an essential message should never be able to
   * silence it — and one can exist: a template's class can change after
   * somebody has already switched it off.
   */
  if (definition.klass === "essential") return true

  /*
   * A per-message switch beats the coarse one, in both directions. Somebody
   * who turned email off but wants to hear about new bookings gets exactly
   * that, and somebody who left email on but muted review alerts does too.
   */
  const override = input.overrides?.[overrideKey(input.template, input.channel)]
  if (override !== undefined) return override

  if (definition.klass === "marketing") return input.settings.emailMarketing

  // `useful`: always allowed in-app, and gated by the setting over email.
  return input.channel === "in_app" ? true : input.settings.emailUseful
}

/* ---------------------------------------------------------------- outbox -- */

/** Attempts before a message is left alone for a human to look at. */
export const MAX_SEND_ATTEMPTS = 5

/**
 * How long to wait before trying again, in seconds.
 *
 * Exponential, because the usual reasons a send fails — a provider blip, a
 * rate limit, a DNS wobble — all clear on their own given a little room.
 * Retrying hard makes every one of them worse.
 */
export function retryDelaySeconds(attempt: number): number {
  return Math.min(60 * 2 ** Math.max(0, attempt - 1), 3600)
}

export type OutboxKey = {
  template: NotificationTemplate
  /** The thing this is about — a booking, a payout, a reset. */
  subjectId: UUID | string
}

/**
 * The key that stops one event being sent twice.
 *
 * A booking is confirmed once, however many times a webhook is redelivered or
 * a job re-runs. Without this the guest gets the same email four times and
 * stops trusting any of them.
 */
export function dedupeKey(key: OutboxKey): string {
  return `${key.template}:${key.subjectId}`
}
