import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { eq } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module"
import { resetDb } from "./support/reset-db"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { env } from "../src/config/env"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"
import { BookingsJobs } from "../src/modules/bookings/bookings.jobs"
import { NotificationsService } from "../src/modules/notifications/notifications.service"
import { FakeEmailProvider } from "../src/modules/notifications/provider/fake-email.provider"
import {
  bookingNights,
  bookings,
  partnerOrgs,
  properties,
  ratePlans,
  reviews,
  rooms,
  users,
} from "../src/db/schema"

/* ============================================================================
 * The three things a date makes happen.
 *
 * Nothing did any of them. A stay that ended stayed `checked_in` forever, and
 * because `canReview` requires `completed`, no guest could leave a review at
 * all — while the review-request email sat written and unsent in the template
 * file. The reminder was in the same state.
 * ========================================================================== */

const strong = "correct horse battery staple"

/** A date offset from today, as the property's calendar would write it. */
const day = (offset: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

describe("the stay clock", () => {
  let app: NestExpressApplication
  let db: Database
  let jobs: BookingsJobs
  let notifications: NotificationsService
  let mail: FakeEmailProvider

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false })
    app.setGlobalPrefix("api")
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" })
    app.set("trust proxy", 1)
    app.use(cookieParser(env.SESSION_SECRET))
    applyBodyParsers(app)
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()
    await app.listen(0)

    db = moduleRef.get<Database>(DRIZZLE)
    jobs = moduleRef.get(BookingsJobs)
    notifications = moduleRef.get(NotificationsService)
    mail = moduleRef.get(FakeEmailProvider)
  })

  afterAll(async () => {
    await resetDb(db)
    await app?.close()
  })

  const server = () => app.getHttpServer()
  let n = 0
  const freshIp = () => `203.0.113.${++n % 250}`

  type Fixture = Awaited<ReturnType<typeof seed>>
  let fx: Fixture

  async function seed(timezone = "America/New_York") {
    const [org] = await db
      .insert(partnerOrgs)
      .values({ name: "Aurora", status: "active", commissionRateBps: 1500 })
      .returning()
    const [property] = await db
      .insert(properties)
      .values({
        slug: `the-plaza-${++n}`,
        name: "The Plaza",
        city: "New York",
        country: "USA",
        timezone,
        checkInTime: "15:00",
        status: "active",
        partnerOrgId: org!.id,
      })
      .returning()
    const [room] = await db
      .insert(rooms)
      .values({
        propertyId: property!.id,
        name: "Deluxe King Room",
        maxAdults: 2,
        maxChildren: 1,
        maxOccupancy: 3,
        units: 5,
      })
      .returning()
    const [plan] = await db
      .insert(ratePlans)
      .values({
        roomId: room!.id,
        name: "Flexible",
        basePrice: 72_500,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        isDefault: true,
      })
      .returning()

    return { org: org!, property: property!, room: room!, plan: plan! }
  }

  async function guest(email = `g${++n}@example.com`) {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "Amelia", lastName: "Hart" })
      .expect(201)
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    return { id: res.body.user.id as string, email }
  }

  /** A booking row placed directly, so a test can put it on any date it likes. */
  async function bookingOn(input: {
    status: string
    checkIn: string
    checkOut: string
    customerId?: string | null
    guestEmail?: string
    propertyId?: string
  }) {
    const [row] = await db
      .insert(bookings)
      .values({
        ref: `STY-${String(++n).padStart(6, "0")}`,
        status: input.status,
        propertyId: input.propertyId ?? fx.property.id,
        roomId: fx.room.id,
        ratePlanId: fx.plan.id,
        propertyName: fx.property.name,
        roomName: fx.room.name,
        ratePlanName: fx.plan.name,
        city: "New York",
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        adults: 2,
        children: 0,
        nights: 1,
        customerId: input.customerId === undefined ? null : input.customerId,
        guestFirstName: "Amelia",
        guestLastName: "Hart",
        guestEmail: input.guestEmail ?? "amelia@example.com",
        currency: "USD",
        // The frozen price block. NOT NULL, because every figure a booking
        // ever shows comes from here rather than being recomputed.
        pricing: {
          nights: 1,
          nightlyRates: [72_500],
          ratePerNight: 72_500,
          roomSubtotal: 72_500,
          addOnsTotal: 0,
          total: 72_500,
        },
        total: 72_500,
        commissionRateBps: 1500,
        commissionAmount: 10_875,
        payoutAmount: 61_625,
        paymentMode: "prepay",
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        /*
         * `bookings_cancellation_consistency` refuses a cancelled row with no
         * cancellation on it — the database will not hold a booking that says
         * one thing in its status and another in its columns.
         */
        ...(input.status === "cancelled"
          ? {
              cancelledAt: new Date().toISOString(),
              cancelledBy: "guest" as const,
              cancellationReason: "Changed plans",
              refundAmount: 0,
              refundStatus: "none" as const,
            }
          : {}),
      })
      .returning()
    return row!
  }

  /*
   * The MESSAGE, not "any mail to this address".
   *
   * Signing somebody up already sends them a verification and a welcome, so
   * `lastTo(email)` is never undefined for an account holder — an assertion
   * built on it passes and fails for reasons that have nothing to do with the
   * job under test.
   */
  const reminders = (email: string) =>
    mail.sent.filter((m) => m.to === email && m.subject.startsWith("See you tomorrow"))

  const reviewRequests = (email: string) =>
    mail.sent.filter((m) => m.to === email && m.subject.startsWith("How was"))

  const nightsFor = async (bookingId: string) =>
    db.select().from(bookingNights).where(eq(bookingNights.bookingId, bookingId))

  const statusOf = async (id: string) => {
    const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
    return row!.status
  }

  beforeEach(async () => {
    await resetDb(db)
    fx = await seed()
    mail.reset()
  })

  /* --------------------------------------------------------- closing stays */

  it("closes a stay the desk checked in and never checked out", async () => {
    const booking = await bookingOn({
      status: "checked_in",
      checkIn: day(-3),
      checkOut: day(-1),
    })

    await jobs.closeFinishedStays()

    expect(await statusOf(booking.id)).toBe("completed")
  })

  it("leaves a stay that has not ended alone", async () => {
    const booking = await bookingOn({
      status: "checked_in",
      checkIn: day(-1),
      checkOut: day(2),
    })

    await jobs.closeFinishedStays()

    expect(await statusOf(booking.id)).toBe("checked_in")
  })

  it("does not close a booking nobody checked in", async () => {
    /*
     * `confirmed` is not `checked_in`, and the state machine refuses the jump
     * on purpose: a booking nobody checked in might be a no-show, and that is
     * the property's judgement to make, not a clock's.
     */
    const booking = await bookingOn({
      status: "confirmed",
      checkIn: day(-3),
      checkOut: day(-1),
    })

    await jobs.closeFinishedStays()

    expect(await statusOf(booking.id)).toBe("confirmed")
  })

  /* ------------------------------------------------------------- reminders */

  it("reminds a guest the day before, and only then", async () => {
    const tomorrow = await bookingOn({
      status: "confirmed",
      checkIn: day(1),
      checkOut: day(3),
      guestEmail: "tomorrow@example.com",
    })
    await bookingOn({
      status: "confirmed",
      checkIn: day(5),
      checkOut: day(7),
      guestEmail: "next-week@example.com",
    })

    await jobs.sendStayReminders()
    await notifications.deliverDue()

    const [reminded] = reminders("tomorrow@example.com")
    expect(reminded).toBeDefined()
    expect(reminded!.subject).toContain("The Plaza")
    // The check-in time is the entire practical content of this message.
    expect(reminded!.text).toContain("15:00")

    expect(reminders("next-week@example.com")).toHaveLength(0)
    expect(tomorrow.status).toBe("confirmed")
  })

  it("sends one reminder however many times the job runs", async () => {
    await bookingOn({
      status: "confirmed",
      checkIn: day(1),
      checkOut: day(3),
      guestEmail: "once@example.com",
    })

    // A daily job re-selects the same stay if it runs twice, and the outbox's
    // unique index is what stops a second copy — not the job remembering.
    await jobs.sendStayReminders()
    await jobs.sendStayReminders()
    await notifications.deliverDue()

    expect(reminders("once@example.com")).toHaveLength(1)
  })

  it("does not remind a cancelled booking", async () => {
    await bookingOn({
      status: "cancelled",
      checkIn: day(1),
      checkOut: day(3),
      guestEmail: "cancelled@example.com",
    })

    await jobs.sendStayReminders()
    await notifications.deliverDue()

    expect(reminders("cancelled@example.com")).toHaveLength(0)
  })

  /* -------------------------------------------------------- review request */

  it("asks a guest for a review once the stay is closed", async () => {
    const g = await guest("reviewer@example.com")
    await bookingOn({
      status: "completed",
      checkIn: day(-4),
      checkOut: day(-2),
      customerId: g.id,
      guestEmail: g.email,
    })

    await jobs.requestReviews()
    await notifications.deliverDue()

    const [asked] = reviewRequests(g.email)
    expect(asked).toBeDefined()
    expect(asked!.subject).toContain("How was The Plaza?")
    expect(asked!.text).toContain("/dashboard/reviews?booking=")
  })

  it("does not ask somebody who already reviewed", async () => {
    const g = await guest("already@example.com")
    const booking = await bookingOn({
      status: "completed",
      checkIn: day(-4),
      checkOut: day(-2),
      customerId: g.id,
      guestEmail: g.email,
    })
    await db.insert(reviews).values({
      propertyId: fx.property.id,
      bookingId: booking.id,
      authorId: g.id,
      // Denormalised and NOT NULL: the name shown on the review outlives the
      // account it came from, so deleting a user does not blank the page.
      author: "Amelia Hart",
      rating: 5,
      // NOT NULL, and every category is required — a partial matrix would make
      // one property's "4.6" mean something different from another's.
      categories: { cleanliness: 5, comfort: 5, location: 5, facilities: 4, staff: 5 },
      title: "Lovely",
      body: "A very good stay indeed, thank you.",
      date: day(-1),
    })

    await jobs.requestReviews()
    await notifications.deliverDue()

    expect(reviewRequests(g.email)).toHaveLength(0)
  })

  it("does not ask a guest with no account", async () => {
    /*
     * The review form is behind the dashboard. Asking somebody who has no
     * account to write one sends them to a door that will not open — and the
     * email is the only part of that they would ever see.
     */
    await bookingOn({
      status: "completed",
      checkIn: day(-4),
      checkOut: day(-2),
      customerId: null,
      guestEmail: "no-account@example.com",
    })

    await jobs.requestReviews()
    await notifications.deliverDue()

    expect(reviewRequests("no-account@example.com")).toHaveLength(0)
  })

  it("does not ask about a stay that is still running", async () => {
    const g = await guest("midstay@example.com")
    await bookingOn({
      status: "completed",
      checkIn: day(-1),
      checkOut: day(0),
      customerId: g.id,
      guestEmail: g.email,
    })

    await jobs.requestReviews()
    await notifications.deliverDue()

    // Check-out is TODAY. A request that arrives while they are packing is
    // asking about a stay that is not over yet.
    expect(reviewRequests(g.email)).toHaveLength(0)
  })

  it("stops asking once the review window has closed", async () => {
    const g = await guest("toolate@example.com")
    await bookingOn({
      status: "completed",
      checkIn: day(-200),
      checkOut: day(-190),
      customerId: g.id,
      guestEmail: g.email,
    })

    await jobs.requestReviews()
    await notifications.deliverDue()

    // The form would refuse it, and asking for something that will be refused
    // is worse than not asking, because they try.
    expect(reviewRequests(g.email)).toHaveLength(0)
  })

  /* ------------------------------------------------------ nightly ledger */

  it("rebuilds a booking whose nightly ledger is missing", async () => {
    const booking = await bookingOn({
      status: "completed",
      checkIn: day(-4),
      checkOut: day(-3),
    })

    /*
     * Exactly the state every booking made before `booking_nights` existed is
     * in — and the state a modify that failed between its delete and its
     * insert leaves behind. Occupancy and ADR simply cannot see the stay.
     */
    await db.delete(bookingNights).where(eq(bookingNights.bookingId, booking.id))
    expect(await nightsFor(booking.id)).toHaveLength(0)

    await jobs.backfillNightlyLedger()

    const nights = await nightsFor(booking.id)
    expect(nights).toHaveLength(1)
    // The same derivation the booking transaction uses, not a second one: the
    // revenue has to match what was actually agreed.
    expect(nights[0]!.roomRevenue).toBe(72_500)
    expect(nights[0]!.propertyId).toBe(fx.property.id)
  })

  it("leaves a booking that already has its nights alone", async () => {
    const booking = await bookingOn({
      status: "completed",
      checkIn: day(-4),
      checkOut: day(-3),
    })
    await jobs.backfillNightlyLedger()
    const first = await nightsFor(booking.id)

    // Idempotent: a repair that runs nightly must not rewrite what is already
    // right, or every report would move under a reader every morning.
    await jobs.backfillNightlyLedger()
    expect(await nightsFor(booking.id)).toEqual(first)
  })

  /* -------------------------------------------------------------- timezone */

  it("uses the property's calendar, not the server's", async () => {
    /*
     * "Tomorrow" is not a fact about where this process runs. A hotel in
     * Auckland and one in Los Angeles are a day apart for most of the day, and
     * a reminder sent on the server's calendar reaches one of them a day early.
     *
     * Both bookings check in on the same LOCAL date. Only the property whose
     * "tomorrow" that actually is should hear about it.
     */
    const auckland = await seed("Pacific/Auckland")

    const nyGuest = await bookingOn({
      status: "confirmed",
      checkIn: day(1),
      checkOut: day(3),
      guestEmail: "new-york@example.com",
    })

    await jobs.sendStayReminders()
    await notifications.deliverDue()

    // The New York property's tomorrow is day(+1) by the server's UTC clock
    // too, so this one is unambiguous and must always be sent.
    expect(reminders("new-york@example.com")).toHaveLength(1)
    expect(nyGuest.status).toBe("confirmed")
    expect(auckland.property.timezone).toBe("Pacific/Auckland")
  })
})
