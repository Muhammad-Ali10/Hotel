import type { NotificationTemplate } from "@stayora/shared"

import { env } from "../../config/env"

/* ============================================================================
 * Message content, in the repo (rule #55).
 *
 * Not hosted at SendGrid, and the reason is rule #1. A booking confirmation
 * carries the cancellation sentence, which is GENERATED from the same fields
 * `refundFor()` reads. Move that text somewhere a marketer can edit and the
 * sentence a guest was shown and the refund the system pays stop being the
 * same promise — which is the exact drift rule #1 was written to prevent.
 *
 * Everything here is plain interpolation. No template engine: the messages are
 * short, the data is already shaped by the caller, and a dependency that can
 * execute arbitrary expressions inside a string is a large door to open for a
 * paragraph of text.
 * ========================================================================== */

export type Rendered = { subject: string; html: string; text: string }

/** Whatever the caller froze into the outbox row at enqueue time. */
export type TemplatePayload = Record<string, unknown>

const str = (payload: TemplatePayload, key: string, fallback = ""): string => {
  const value = payload[key]
  return value === undefined || value === null ? fallback : String(value)
}

/**
 * Escapes text going into HTML.
 *
 * Every value here is somebody's input at one remove — a guest's name, a
 * property's name, the text of a review. An unescaped one turns a
 * confirmation email into a delivery mechanism for whatever they typed.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const money = (cents: unknown): string => {
  const n = typeof cents === "number" ? cents : Number(cents ?? 0)
  return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const link = (path: string): string => `${env.WEB_ORIGIN}${path}`

/** One frame for every message, so the product looks like one product. */
function wrap(heading: string, body: string): string {
  return [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#141414">`,
    `<h1 style="font-size:20px;margin:0 0 16px">${esc(heading)}</h1>`,
    body,
    `<p style="margin-top:32px;font-size:12px;color:#6b6b6b">Stayora</p>`,
    `</div>`,
  ].join("")
}

const p = (text: string) => `<p style="margin:0 0 12px;line-height:1.6">${text}</p>`

const button = (label: string, href: string) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#141414;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${esc(label)}</a></p>`

/* -------------------------------------------------------------- renderers -- */

type Renderer = (payload: TemplatePayload) => Rendered

const RENDERERS: Record<NotificationTemplate, Renderer> = {
  welcome: (d) => {
    const name = str(d, "firstName", "there")
    return {
      subject: "Welcome to Stayora",
      text: `Hi ${name}, your Stayora account is ready. Start exploring: ${link("/hotels")}`,
      html: wrap(
        `Welcome, ${name}`,
        p("Your account is ready.") + button("Find somewhere to stay", link("/hotels")),
      ),
    }
  },

  /**
   * The message that lets signup stop leaking (rule #58).
   *
   * Signup answers everybody identically; the truth arrives here, at the
   * address itself — so only the person who owns it learns anything.
   */
  signup_existing_account: () => ({
    subject: "You already have a Stayora account",
    text: `Somebody tried to create an account with this address. You already have one — sign in at ${link("/login")}. If it was not you, you can ignore this message; nothing has changed.`,
    html: wrap(
      "You already have an account",
      p("Somebody tried to create a Stayora account with this email address.") +
        p("You already have one, so nothing was created.") +
        button("Sign in", link("/login")) +
        p("If this was not you, you can ignore this message — nothing has changed."),
    ),
  }),

  verify_email: (d) => {
    const href = link(`/verify-email?token=${str(d, "token")}`)
    return {
      subject: "Confirm your email address",
      text: `Confirm your address to finish setting up your Stayora account: ${href}`,
      html: wrap(
        "Confirm your email",
        p("One step left on your Stayora account.") + button("Confirm my email", href),
      ),
    }
  },

  password_reset: (d) => {
    const href = link(`/reset-password?token=${str(d, "token")}`)
    return {
      subject: "Reset your Stayora password",
      text: `Reset your password: ${href}\n\nThis link works once and expires in an hour. If you did not ask for it, ignore this message — your password has not changed.`,
      html: wrap(
        "Reset your password",
        button("Choose a new password", href) +
          p("This link works once and expires in an hour.") +
          p("If you did not ask for it, ignore this message — your password has not changed."),
      ),
    }
  },

  /**
   * Sent AFTER the fact, on purpose.
   *
   * If the change was not theirs, this is the message that tells them — and it
   * is worth sending even though it can do nothing to stop it, because it is
   * the only way they find out at all.
   */
  password_changed: () => ({
    subject: "Your Stayora password was changed",
    text: `Your password was changed just now, and every other device was signed out. If this was not you, reset your password immediately: ${link("/forgot-password")}`,
    html: wrap(
      "Your password was changed",
      p("Your password was changed just now, and every other device was signed out.") +
        p("If this was not you, reset it immediately.") +
        button("Reset my password", link("/forgot-password")),
    ),
  }),

  booking_confirmed: (d) => {
    const ref = str(d, "ref")
    const property = str(d, "propertyName")
    return {
      subject: `Your stay at ${property} is confirmed — ${ref}`,
      text: [
        `${property} · ${str(d, "checkIn")} to ${str(d, "checkOut")}`,
        `${str(d, "roomName")} · ${str(d, "ratePlanName")}`,
        `Total ${money(d.total)}`,
        "",
        str(d, "cancellationText"),
        "",
        link(`/dashboard/bookings/${ref}`),
      ].join("\n"),
      html: wrap(
        "Your stay is confirmed",
        p(`<strong>${esc(property)}</strong>`) +
          p(`${esc(str(d, "checkIn"))} to ${esc(str(d, "checkOut"))}`) +
          p(`${esc(str(d, "roomName"))} · ${esc(str(d, "ratePlanName"))}`) +
          p(`Total <strong>${money(d.total)}</strong>`) +
          p(`Reference <strong>${esc(ref)}</strong>`) +
          /*
           * The whole reason this template lives in the repo: the sentence
           * comes from `policyText()`, generated from the same fields
           * `refundFor()` reads.
           */
          p(esc(str(d, "cancellationText"))) +
          button("View booking", link(`/dashboard/bookings/${ref}`)),
      ),
    }
  },

  /**
   * The hold ran out, and the room is probably still free.
   *
   * Written as an invitation rather than a notice. The guest was in the middle
   * of paying; something interrupted them. Telling them "your booking is
   * cancelled" and stopping there describes the database, not their situation
   * — the useful facts are that no money moved, that the room went straight
   * back on sale, and that the same page is one click away.
   *
   * The property is named and the dates repeated because this may arrive
   * hours later, in a list of other mail, with no memory of which tab it was.
   */
  booking_hold_expired: (d) => {
    const property = str(d, "propertyName")
    const back = `/hotels/${str(d, "propertySlug")}`
    return {
      subject: `Your booking at ${property} wasn't completed`,
      text: [
        `We held ${str(d, "roomName")} at ${property} for you, but the payment wasn't finished in time, so the room has gone back on sale.`,
        "",
        `${str(d, "checkIn")} to ${str(d, "checkOut")}`,
        "",
        "Nothing has been charged.",
        "",
        "It is usually still available — you can pick it up again here:",
        link(back),
      ].join("\n"),
      html: wrap(
        "Your booking wasn't completed",
        p(
          `We held <strong>${esc(str(d, "roomName"))}</strong> at ` +
            `<strong>${esc(property)}</strong> for you, but the payment wasn't ` +
            `finished in time, so the room has gone back on sale.`
        ) +
          p(`${esc(str(d, "checkIn"))} to ${esc(str(d, "checkOut"))}`) +
          p("<strong>Nothing has been charged.</strong>") +
          p(
            `It is usually still available — ` +
              `<a href="${link(back)}">pick it up again</a>.`
          )
      ),
    }
  },

  /**
   * What the money did, in the guest's terms.
   *
   * Driven by `settlementFor`'s decision rather than by a refund figure,
   * because the two payment modes move money in OPPOSITE directions for the
   * same policy: a prepaid booking gets some back, a guaranteed one has its
   * saved card charged. Reporting the refund figure to a guaranteed guest told
   * them they were owed money at the moment they were being billed.
   */
  booking_cancelled: (d) => {
    const action = str(d, "action", "none")
    const amount = money(d.amount)

    const line =
      action === "refund"
        ? {
            short: `A refund of ${amount} is on its way.`,
            long: p(`Refund <strong>${amount}</strong>`) +
              p("It usually reaches your account within a few working days."),
          }
        : action === "charge_penalty"
          ? {
              short: `A cancellation charge of ${amount} has been made to your card.`,
              long: p(`Cancellation charge <strong>${amount}</strong>`) +
                p("This is the amount your rate's cancellation policy allows."),
            }
          : {
              short: "Nothing has been charged and there is nothing to refund.",
              long: p("Nothing has been charged, and there is nothing to refund."),
            }

    return {
      subject: `Your booking at ${str(d, "propertyName")} is cancelled`,
      text: `Booking ${str(d, "ref")} at ${str(d, "propertyName")} has been cancelled. ${line.short}`,
      html: wrap(
        "Your booking is cancelled",
        p(`<strong>${esc(str(d, "propertyName"))}</strong> · ${esc(str(d, "ref"))}`) + line.long,
      ),
    }
  },

  booking_modified: (d) => ({
    subject: `Your stay at ${str(d, "propertyName")} has changed`,
    text: `Booking ${str(d, "ref")} now runs ${str(d, "checkIn")} to ${str(d, "checkOut")}. New total ${money(d.total)}.`,
    html: wrap(
      "Your stay has changed",
      p(`<strong>${esc(str(d, "propertyName"))}</strong> · ${esc(str(d, "ref"))}`) +
        p(`${esc(str(d, "checkIn"))} to ${esc(str(d, "checkOut"))}`) +
        p(`New total <strong>${money(d.total)}</strong>`),
    ),
  }),

  refund_issued: (d) => ({
    subject: `Refund of ${money(d.amount)} is on its way`,
    text: `A refund of ${money(d.amount)} for booking ${str(d, "ref")} has been sent to your card.`,
    html: wrap(
      "Your refund is on its way",
      p(`<strong>${money(d.amount)}</strong> for booking ${esc(str(d, "ref"))}`) +
        p("It usually reaches your account within a few working days."),
    ),
  }),

  stay_reminder: (d) => ({
    subject: `See you tomorrow at ${str(d, "propertyName")}`,
    text: `Your stay at ${str(d, "propertyName")} starts ${str(d, "checkIn")}. Check-in from ${str(d, "checkInTime")}.`,
    html: wrap(
      "Your stay is tomorrow",
      p(`<strong>${esc(str(d, "propertyName"))}</strong>`) +
        p(`Check-in from ${esc(str(d, "checkInTime"))}`),
    ),
  }),

  review_request: (d) => ({
    subject: `How was ${str(d, "propertyName")}?`,
    text: `Tell other travellers about your stay at ${str(d, "propertyName")}: ${link(`/dashboard/reviews?booking=${str(d, "bookingId")}`)}`,
    html: wrap(
      "How was your stay?",
      p(`A few words about <strong>${esc(str(d, "propertyName"))}</strong> helps the next traveller.`) +
        button("Write a review", link(`/dashboard/reviews?booking=${str(d, "bookingId")}`)),
    ),
  }),

  offer: (d) => ({
    subject: str(d, "title", "An offer from Stayora"),
    text: str(d, "body"),
    html: wrap(str(d, "title", "An offer from Stayora"), p(esc(str(d, "body")))),
  }),

  partner_invite: (d) => {
    const href = link(`/extranet/join?token=${str(d, "token")}`)
    const org = str(d, "orgName")
    return {
      subject: `${str(d, "invitedBy")} invited you to ${org} on Stayora`,
      text: `You have been invited to join ${org} on Stayora as ${str(d, "role")}. Accept: ${href}

This link works once and expires in 7 days.`,
      html: wrap(
        `Join ${org} on Stayora`,
        p(`${esc(str(d, "invitedBy"))} has invited you as <strong>${esc(str(d, "role"))}</strong>.`) +
          button("Accept the invitation", href) +
          p("This link works once and expires in 7 days.") +
          p("If you do not have a Stayora account yet, you can create one first — use this same address."),
      ),
    }
  },

  partner_new_booking: (d) => ({
    subject: `New booking — ${str(d, "ref")}`,
    text: `${str(d, "guestName")} booked ${str(d, "roomName")} from ${str(d, "checkIn")} to ${str(d, "checkOut")}. Total ${money(d.total)}.`,
    html: wrap(
      "New booking",
      p(`<strong>${esc(str(d, "guestName"))}</strong> · ${esc(str(d, "ref"))}`) +
        p(`${esc(str(d, "roomName"))} · ${esc(str(d, "checkIn"))} to ${esc(str(d, "checkOut"))}`) +
        p(`Total <strong>${money(d.total)}</strong>`) +
        button("Open in the extranet", link("/extranet/reservations")),
    ),
  }),

  partner_booking_cancelled: (d) => ({
    subject: `Cancellation — ${str(d, "ref")}`,
    text: `${str(d, "guestName")} cancelled ${str(d, "ref")}. You keep ${money(d.charged)}.`,
    html: wrap(
      "A booking was cancelled",
      p(`<strong>${esc(str(d, "guestName"))}</strong> · ${esc(str(d, "ref"))}`) +
        p(`You keep <strong>${money(d.charged)}</strong> under your cancellation policy.`),
    ),
  }),

  partner_new_review: (d) => ({
    subject: `A new ${str(d, "rating")}-star review`,
    text: `${str(d, "author")} left a ${str(d, "rating")}-star review: "${str(d, "title")}"`,
    html: wrap(
      "You have a new review",
      p(`<strong>${esc(str(d, "rating"))} stars</strong> from ${esc(str(d, "author"))}`) +
        p(esc(str(d, "title"))) +
        button("Read and reply", link("/extranet/reviews")),
    ),
  }),

  partner_payout_sent: (d) => ({
    subject: `Payout of ${money(d.net)} sent`,
    text: `Your payout for ${str(d, "periodStart")} to ${str(d, "periodEnd")} — ${money(d.net)} — is on its way to the account ending ${str(d, "last4")}.`,
    html: wrap(
      "Your payout is on its way",
      p(`<strong>${money(d.net)}</strong> for ${esc(str(d, "periodStart"))} to ${esc(str(d, "periodEnd"))}`) +
        p(`To the account ending ${esc(str(d, "last4"))}`) +
        button("See the statement", link("/extranet/finance")),
    ),
  }),

  partner_payout_failed: (d) => ({
    subject: "We could not send your payout",
    text: `Your payout for ${str(d, "periodStart")} to ${str(d, "periodEnd")} could not be sent: ${str(d, "reason")}. The balance carries into the next cycle.`,
    html: wrap(
      "We could not send your payout",
      p(esc(str(d, "reason"))) +
        p("Nothing is lost — the balance carries into your next payout.") +
        button("Check your payout details", link("/extranet/finance")),
    ),
  }),

  /**
   * The month's commission bill (rule #91).
   *
   * The booking count is in the body deliberately: a figure a partner can
   * check against their own records is one they pay, and "you owe us $2,400"
   * with no working is the slowest possible way to be paid.
   */
  invoice_issued: (d) => ({
    subject: `Your commission invoice ${str(d, "ref")}`,
    text: `Invoice ${str(d, "ref")} for ${money(d.amount)} covers ${str(d, "bookings")} bookings and is due by ${str(d, "dueDate")}. Every booking is itemised in your extranet.`,
    html: wrap(
      `Invoice ${esc(str(d, "ref"))}`,
      p(
        `${esc(money(d.amount))} across ${esc(str(d, "bookings"))} bookings, due by ${esc(str(d, "dueDate"))}.`,
      ) +
        p("Every booking on this invoice is listed in your extranet, so you can check it against your own records.") +
        button("View the invoice", link("/extranet/finance/invoices")),
    ),
  }),

  /** It has run out of time, and what that costs (rule #95). */
  invoice_overdue: (d) => ({
    subject: `Invoice ${str(d, "ref")} is overdue`,
    text: `Invoice ${str(d, "ref")} for ${money(d.amount)} was due on ${str(d, "dueDate")}. Commission is now being deducted from your bookings again, and payouts are paused until the balance is cleared. Your properties stay bookable.`,
    html: wrap(
      `Invoice ${esc(str(d, "ref"))} is overdue`,
      p(`${esc(money(d.amount))} was due on ${esc(str(d, "dueDate"))}.`) +
        p("Commission is being deducted from your bookings again, and payouts are paused until the balance clears.") +
        p("Your properties stay bookable — guests who have already booked are not affected.") +
        button("Settle the invoice", link("/extranet/finance/invoices")),
    ),
  }),

  /* --------------------------------------------- registration (rule #103) */

  registration_approved: (d) => ({
    subject: `${str(d, "propertyName")} is live on Stayora`,
    text: `Your registration has been approved and ${str(d, "propertyName")} is now bookable. Sign in to the extranet to manage your rates, availability and reservations.${str(d, "note") ? ` Note from our team: ${str(d, "note")}` : ""}`,
    html: wrap(
      `${esc(str(d, "propertyName"))} is live`,
      p("Your registration has been approved and the property is now bookable.") +
        (str(d, "note") ? p(`Note from our team: ${esc(str(d, "note"))}`) : "") +
        p("Your bank account still needs to be verified before the first payout — we will be in touch about that separately.") +
        button("Open the extranet", link("/extranet")),
    ),
  }),

  /**
   * The note is the whole message.
   *
   * "Rejected" on its own is a support ticket, every time — which is why the
   * contract requires a reason before it will accept the decision.
   */
  registration_rejected: (d) => ({
    subject: "About your Stayora registration",
    text: `We are not able to approve your registration at this time. ${str(d, "note")}`,
    html: wrap(
      "About your registration",
      p("We are not able to approve your registration at this time.") +
        p(esc(str(d, "note"))) +
        p("If you think this is a mistake, reply to this email and a person will look at it."),
    ),
  }),
}

/**
 * Renders one message.
 *
 * `RENDERERS` is typed as a total map over `NotificationTemplate`, so adding a
 * message to the catalogue without writing its content is a compile error
 * rather than an empty email.
 */
export function render(template: NotificationTemplate, payload: TemplatePayload): Rendered {
  return RENDERERS[template](payload)
}
