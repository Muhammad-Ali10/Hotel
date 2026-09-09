import { describe, expect, it } from "vitest"

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  MAX_SEND_ATTEMPTS,
  NOTIFICATIONS,
  dedupeKey,
  definitionOf,
  isSwitchable,
  maySend,
  retryDelaySeconds,
  type NotificationSettings,
  type NotificationTemplate,
} from "./notifications"

const settings = (over: Partial<NotificationSettings> = {}): NotificationSettings => ({
  ...DEFAULT_NOTIFICATION_SETTINGS,
  ...over,
})

const templates = Object.keys(NOTIFICATIONS) as NotificationTemplate[]

describe("the catalogue", () => {
  it("gives every message a class, a kind and somewhere to go", () => {
    for (const template of templates) {
      const definition = definitionOf(template)
      expect(definition.template).toBe(template)
      expect(definition.channels.length).toBeGreaterThan(0)
    }
  })

  it("keeps the key and the entry in step", () => {
    // The template string is stored on every row. A key that disagreed with
    // its own `template` field would send one thing and record another.
    for (const template of templates) {
      expect(NOTIFICATIONS[template].template).toBe(template)
    }
  })
})

describe("maySend", () => {
  it("sends an essential message whatever the settings say (rule #56)", () => {
    // A booking confirmation is a record of something that happened to
    // somebody's money. Switching it off is not a preference anyone can
    // meaningfully express in advance.
    const off = settings({ emailUseful: false, emailMarketing: false })

    for (const template of ["booking_confirmed", "refund_issued", "password_reset"] as const) {
      expect(maySend({ template, channel: "email", settings: off })).toBe(true)
    }
  })

  it("lets a guest switch off the useful ones", () => {
    expect(
      maySend({ template: "stay_reminder", channel: "email", settings: settings() })
    ).toBe(true)
    expect(
      maySend({
        template: "stay_reminder",
        channel: "email",
        settings: settings({ emailUseful: false }),
      })
    ).toBe(false)
  })

  it("keeps marketing off until it is asked for", () => {
    // Opt-in is the only honest default for a message nobody asked for.
    expect(DEFAULT_NOTIFICATION_SETTINGS.emailMarketing).toBe(false)
    expect(maySend({ template: "offer", channel: "email", settings: settings() })).toBe(false)
    expect(
      maySend({ template: "offer", channel: "email", settings: settings({ emailMarketing: true }) })
    ).toBe(true)
  })

  it("gates marketing in-app too", () => {
    // A promotional card in a notifications list is still a promotion nobody
    // asked for.
    expect(maySend({ template: "offer", channel: "in_app", settings: settings() })).toBe(false)
  })

  it("still shows a useful message in the dashboard when its email is off", () => {
    /*
     * The distinction that makes the setting honest: switching off "stay
     * reminders" means stop emailing me, not hide it from my own dashboard.
     * Nothing arrives uninvited in-app — the person has to open it.
     */
    expect(
      maySend({
        template: "stay_reminder",
        channel: "in_app",
        settings: settings({ emailUseful: false }),
      })
    ).toBe(true)
  })

  it("refuses a channel the message does not use", () => {
    // `password_reset` is email only: an in-app notice about a reset would be
    // visible only to somebody already signed in, which is nobody who needs it.
    expect(definitionOf("password_reset").channels).toEqual(["email"])
    expect(
      maySend({ template: "password_reset", channel: "in_app", settings: settings() })
    ).toBe(false)
  })

  it("never lets a setting silence a payout advice", () => {
    // Money leaving for somebody's bank is not a preference.
    for (const template of ["partner_payout_sent", "partner_payout_failed"] as const) {
      expect(
        maySend({
          template,
          channel: "email",
          settings: settings({ emailUseful: false, emailMarketing: false }),
        })
      ).toBe(true)
    }
  })
})

describe("retries", () => {
  it("backs off exponentially and then stops climbing", () => {
    // The usual reasons a send fails all clear on their own given room.
    expect(retryDelaySeconds(1)).toBe(60)
    expect(retryDelaySeconds(2)).toBe(120)
    expect(retryDelaySeconds(3)).toBe(240)
    expect(retryDelaySeconds(20)).toBe(3600)
  })

  it("treats a zeroth attempt as the first", () => {
    expect(retryDelaySeconds(0)).toBe(60)
  })

  it("gives up after the documented number of tries", () => {
    expect(MAX_SEND_ATTEMPTS).toBe(5)
  })
})

describe("dedupeKey", () => {
  it("is stable for one event", () => {
    // A booking is confirmed once, however many times a webhook is redelivered.
    const key = dedupeKey({ template: "booking_confirmed", subjectId: "b1" })
    expect(dedupeKey({ template: "booking_confirmed", subjectId: "b1" })).toBe(key)
  })

  it("separates two messages about the same thing", () => {
    expect(dedupeKey({ template: "booking_confirmed", subjectId: "b1" })).not.toBe(
      dedupeKey({ template: "booking_cancelled", subjectId: "b1" })
    )
  })
})

describe("per-message switches (rule #105)", () => {
  it("beats the coarse setting, in both directions", () => {
    // Email off overall, but this one message wanted.
    expect(
      maySend({
        template: "partner_new_booking",
        channel: "email",
        settings: settings({ emailUseful: false }),
        overrides: { "partner_new_booking:email": true },
      })
    ).toBe(true)

    // Email on overall, but this one message muted.
    expect(
      maySend({
        template: "partner_new_review",
        channel: "email",
        settings: settings({ emailUseful: true }),
        overrides: { "partner_new_review:email": false },
      })
    ).toBe(false)
  })

  it("cannot silence an essential message", () => {
    /*
     * A stored override for an essential message must never win — and one CAN
     * exist, because a template's class can change after somebody has already
     * switched it off.
     */
    expect(
      maySend({
        template: "booking_confirmed",
        channel: "email",
        settings: settings({ emailUseful: false }),
        overrides: { "booking_confirmed:email": false },
      })
    ).toBe(true)
  })

  it("still refuses a channel the message does not use", () => {
    /*
     * A real gap, not a hypothetical one.
     *
     * This used to search for a missing channel among `email`, `sms` and
     * `in_app` — `sms` is not a `NotificationChannel` at all, so the search
     * never typechecked and, on the template it picked, never found anything
     * either: `partner_new_review` uses both real channels, so the test bailed
     * out before asserting. `welcome` is email-only, which is the case worth
     * pinning: an override must not be able to invent an in-app route.
     */
    expect(definitionOf("welcome").channels).not.toContain("in_app")

    expect(
      maySend({
        template: "welcome",
        channel: "in_app",
        settings: settings(),
        overrides: { "welcome:in_app": true },
      })
    ).toBe(false)
  })

  it("falls back to the class when nothing was switched", () => {
    expect(
      maySend({
        template: "partner_new_booking",
        channel: "email",
        settings: settings({ emailUseful: true }),
        overrides: {},
      })
    ).toBe(true)
    expect(
      maySend({
        template: "partner_new_booking",
        channel: "email",
        settings: settings({ emailUseful: false }),
      })
    ).toBe(false)
  })

  it("says which messages may be switched at all", () => {
    // The switchable ones are exactly the non-essential ones.
    expect(isSwitchable("booking_confirmed")).toBe(false)
    expect(isSwitchable("invoice_issued")).toBe(false)
    expect(isSwitchable("partner_new_review")).toBe(true)
    expect(isSwitchable("offer")).toBe(true)
  })
})

