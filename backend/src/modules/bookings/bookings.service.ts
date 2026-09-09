import { createHash } from "node:crypto"

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common"
import {
  addDays,
  bookingPricingSchema,
  canTransition,
  HOLD_MINUTES,
  commissionFor,
  policyFromColumns,
  policyText,
  settlementFor,
  makeBookingRef,
  nightsBetween,
  refundFor,
  storedCancellationPolicySchema,
  unitsLeft,
  type BookingActor,
  type BookingListQuery,
  type BookingStatus,
  type CancelledBy,
  type ISODate,
  type PartnerBookingListQuery,
  type PaymentMode,
} from "@stayora/shared"

import { AuthService, type AuthenticatedUser } from "../auth/auth.service"
import { NotificationsService } from "../notifications/notifications.service"
import { PaymentsService } from "../payments/payments.service"
import { InventoryRepository } from "../inventory/inventory.repository"
import { QuoteTokenService, type QuotePayload } from "../pricing/quote-token.service"
import { BookingsRepository, SoldOutError, type CreateBookingRow } from "./bookings.repository"
import { BookingsSupportRepository } from "./bookings-support.repository"

@Injectable()
export class BookingsService {
  constructor(
    private readonly repo: BookingsRepository,
    private readonly support: BookingsSupportRepository,
    private readonly inventory: InventoryRepository,
    private readonly tokens: QuoteTokenService,
    /*
     * Bookings and payments genuinely point at each other: a booking confirms
     * BECAUSE a payment settled, and a payment happens BECAUSE a booking was
     * cancelled. `forwardRef` is Nest's answer to a cycle that is real rather
     * than accidental — the alternative is an events bus, which would hide a
     * money transfer behind a listener nobody can find from here.
     */
    @Inject(forwardRef(() => PaymentsService))
    private readonly settlement: PaymentsService,
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService
  ) {}

  /* ---------------------------------------------------------------- create */

  /**
   * Creates a booking from a signed quote.
   *
   * The client sends the token it was given plus the guest's details — never a
   * price. The total comes out of the token, which this server signed, so a
   * tampered body cannot buy a cheap stay.
   */
  async create(input: {
    quoteToken: string
    idempotencyKey: string
    guest: {
      firstName: string
      lastName: string
      email: string
      phone: string
      country: string
    }
    arrivalTime: string
    specialRequests: string
    user: AuthenticatedUser
    now?: Date
  }) {
    const now = input.now ?? new Date()

    // Signature first, always — unverified bytes are never interpreted.
    const quote = this.tokens.verify(input.quoteToken, now)

    // The quote is the guest's own, or nobody's. A token issued to one account
    // must not be spendable by another (API1).
    if (quote.userId !== null && quote.userId !== input.user.id) {
      throw new ForbiddenException("That quote belongs to a different account")
    }

    /* ------------------------------------------------------- idempotency -- */

    const requestHash = hashRequest({ quote: input.quoteToken, guest: input.guest })
    const claim = await this.repo.claimIdempotencyKey({
      key: input.idempotencyKey,
      userId: input.user.id,
      requestHash,
    })

    if (!claim.claimed) {
      const existing = claim.existing
      // Same key, different body: the client has a bug, and silently returning
      // the first booking would hide it.
      if (existing && existing.requestHash !== requestHash) {
        throw new ConflictException("That idempotency key was used for a different request")
      }
      if (existing?.bookingId) {
        // A genuine retry — hand back the same booking rather than a second one.
        return this.detail(existing.bookingId, input.user)
      }
      // Claimed but not yet finished: the first attempt is still in flight.
      throw new ConflictException("That booking is already being created")
    }

    try {
      return await this.createFromQuote({ quote, ...input, now })
    } catch (error) {
      // A failed attempt must not burn the key — the guest has to be able to
      // press the button again.
      await this.repo.releaseIdempotencyKey({ key: input.idempotencyKey, userId: input.user.id })
      throw error
    }
  }

  private async createFromQuote(input: {
    quote: QuotePayload
    idempotencyKey: string
    guest: { firstName: string; lastName: string; email: string; phone: string; country: string }
    arrivalTime: string
    specialRequests: string
    user: AuthenticatedUser
    now: Date
  }) {
    const { quote } = input

    const context = await this.support.loadBookingContext({
      propertyId: quote.propertyId,
      roomId: quote.roomId,
      ratePlanId: quote.ratePlanId,
    })
    if (!context) throw new NotFoundException("That room or rate is no longer offered")

    const { property, room, ratePlan, org } = context
    const dates = datesOf(quote.checkIn, nightsBetween(quote.checkIn, quote.checkOut))

    const commissionRateBps = org?.commissionRateBps ?? 1500
    const total = quote.pricing.total

    const row: CreateBookingRow = {
      ref: makeBookingRef(),
      customerId: input.user.id,
      propertyId: property.id,
      roomId: room.id,
      ratePlanId: ratePlan.id,
      propertyName: property.name,
      roomName: room.name,
      ratePlanName: ratePlan.name,
      city: property.city,
      seed: property.seed,
      // Frozen terms — a policy tightened tomorrow must not shrink this refund.
      cancelFreeUntil: ratePlan.cancelFreeUntil,
      cancelCharge: ratePlan.cancelCharge,
      cancelChargeValue: ratePlan.cancelChargeValue,
      // Frozen the same way (rule #47): a property that turns "no-show" strict
      // next month must not reach back into a stay nobody agreed to it for.
      noShowCharge: ratePlan.noShowCharge,
      noShowChargeValue: ratePlan.noShowChargeValue,
      guestFirstName: input.guest.firstName,
      guestLastName: input.guest.lastName,
      guestEmail: input.guest.email,
      guestPhone: input.guest.phone,
      guestCountry: input.guest.country,
      checkIn: quote.checkIn as ISODate,
      checkOut: quote.checkOut as ISODate,
      adults: quote.occupancy.adults,
      children: quote.occupancy.children,
      arrivalTime: input.arrivalTime,
      specialRequests: input.specialRequests,
      pricing: quote.pricing,
      total,
      promotionId: quote.promotionId,
      // From the rate plan, never the request (rule #42). A client that could
      // name this could turn a prepay rate into one it never has to pay.
      paymentMode: ratePlan.paymentMode,
      /*
       * A booking starts UNPAID and holding inventory (rule #44).
       *
       * It was created `confirmed` before payments existed, which meant the
       * room came off sale for a guest who had not paid and might never. Now
       * the hold is explicit and it expires: `confirmed` is what a settled
       * payment does to it, and nothing else.
       */
      status: "pending",
      holdExpiresAt: new Date(input.now.getTime() + HOLD_MINUTES * 60_000).toISOString(),
      commissionRateBps,
      commissionAmount: commissionFor(total, commissionRateBps),
      source: "direct",
    }

    try {
      const created = await this.repo.createWithInventory({
        row,
        addOns: quote.pricing.addOnsTotal > 0 ? await this.support.addOnsFromQuote(quote) : [],
        actorId: input.user.id,
        actor: "guest",
        // Runs INSIDE the transaction, against the LOCKED rows.
        verify: (locked) => {
          if (locked.length !== dates.length) {
            throw new ConflictException("Those dates are no longer available")
          }
          if (locked.some((n) => n.isClosed === true)) {
            throw new ConflictException("Those dates were just closed by the property")
          }
          if (unitsLeft(locked.map(toResolved)) <= 0) throw new SoldOutError()
        },
      })

      await this.repo.attachBookingToKey({
        key: input.idempotencyKey,
        userId: input.user.id,
        bookingId: created.id,
      })

      return this.detail(created.id, input.user)
    } catch (error) {
      if (error instanceof SoldOutError) {
        // Rule #24: the guest kept their side of it and lost the room in the
        // last second. Hand them the alternatives rather than a dead end.
        const alternatives = await this.support.alternativeRooms({
          propertyId: quote.propertyId,
          excludeRoomId: quote.roomId,
          checkIn: quote.checkIn as ISODate,
          checkOut: quote.checkOut as ISODate,
          occupancy: quote.occupancy,
        })
        throw new ConflictException({
          message: "That room was just taken. These are still available for your dates.",
          code: "just_sold_out",
          alternatives,
        })
      }
      throw error
    }
  }

  /* ----------------------------------------------------------------- reads */

  /**
   * One booking, if the caller is allowed to see it.
   *
   * Ownership is checked here and the failure is a 404, not a 403 — a 403 would
   * confirm the reference is real, and references get shared in screenshots
   * and forwarded emails (API1).
   */
  async detail(bookingId: string, user: AuthenticatedUser) {
    const booking = await this.repo.findById(bookingId)
    if (!booking) throw new NotFoundException("Booking not found")

    await this.assertCanSee(booking, user)

    const [addOns, events, property] = await Promise.all([
      this.repo.addOnsFor(booking.id),
      this.repo.eventsFor(booking.id),
      this.support.propertyOf(booking.propertyId),
    ])

    /*
     * The property, alongside the booking's own snapshot of it.
     *
     * `propertyName` and `city` on the booking are frozen at the time of
     * booking, deliberately — a reservation should show what was reserved even
     * if the hotel is renamed. But a guest also needs to GET there: the
     * address, when they can check in, and a link that goes to the hotel as it
     * is now. Those are live, and they are not the same question.
     */
    /*
     * What cancelling RIGHT NOW would refund, computed by the server.
     *
     * The same `refundFor` the cancellation itself runs, with the same policy,
     * the same timezone and the same check-in time — so the number a guest is
     * shown on the confirmation screen is the number they get.
     *
     * The dashboard used to work this out in the browser from a function that
     * only looked at days-to-arrival: two days out meant "full refund" even on
     * a non-refundable rate. It told people they would be paid back and they
     * would not have been.
     *
     * `null` once the booking can no longer be cancelled — there is no
     * hypothetical refund on a stay that already happened.
     */
    const cancellable = canTransition(
      booking.status as BookingStatus,
      "cancelled",
      actorOf(user, "customer")
    ).ok

    const refundPreview = property && cancellable
      ? refundFor({
          policy: storedCancellationPolicySchema.parse(policyFromColumns(booking)),
          pricing: bookingPricingSchema.parse(booking.pricing),
          checkIn: booking.checkIn as ISODate,
          checkInTime: property.checkInTime,
          timezone: property.timezone,
          cancelledAt: new Date(),
          by: "guest",
        })
      : null

    return {
      booking: toDto(booking),
      property: property
        ? {
            slug: property.slug,
            name: property.name,
            address: property.address,
            city: property.city,
            country: property.country,
            checkInTime: property.checkInTime,
            checkOutTime: property.checkOutTime,
            seed: property.seed,
          }
        : null,
      /** The policy in words, generated from the columns (rule #1). */
      cancellation: {
        policy: policyFromColumns(booking),
        text: policyText(policyFromColumns(booking)),
        preview: refundPreview,
      },
      addOns,
      events,
    }
  }

  /**
   * One page of a guest's own bookings.
   *
   * This used to hand back a bare array capped at 100 with no cursor — so a
   * guest with 101 bookings saw 100 and nothing said otherwise. A cap without
   * a cursor is not a limit, it is a wrong answer that looks like a right one.
   */
  async listMine(user: AuthenticatedUser, query: BookingListQuery) {
    const page = await this.repo.listForCustomer({
      customerId: user.id,
      limit: query.limit,
      cursor: query.cursor,
    })
    return { items: page.items.map(toDto), nextCursor: page.nextCursor }
  }

  /** One page of the partner's arrivals, with the filters the screens need. */
  async listForPartner(user: AuthenticatedUser, query: PartnerBookingListQuery) {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    const propertyIds = await this.support.propertyIdsForOrg(
      user.partner.orgId,
      user.partner.propertyIds
    )
    const page = await this.repo.listForProperties({
      propertyIds,
      limit: query.limit,
      cursor: query.cursor,
      status: query.status,
      from: query.from,
      to: query.to,
    })
    return { items: page.items.map(toDto), nextCursor: page.nextCursor }
  }

  /* ---------------------------------------------------------------- modify */

  /**
   * Moves a booking to new dates or a new party size (rule #38).
   *
   * The guest fetches a FRESH quote first, exactly as they did to book — same
   * validation, same signed price, same availability gate. That is why there is
   * no separate repricing path here: doing it inline would be a second
   * implementation of what the quote endpoint already does correctly.
   *
   * The new price is at CURRENT rates (rule #17), so shifting into a peak week
   * costs what that week costs.
   */
  async modify(input: {
    bookingId: string
    quoteToken: string
    user: AuthenticatedUser
    now?: Date
  }) {
    const now = input.now ?? new Date()
    const booking = await this.repo.findById(input.bookingId)
    if (!booking) throw new NotFoundException("Booking not found")

    const role = await this.assertCanSee(booking, input.user)
    const actor = actorOf(input.user, role)

    if (role === "partner" && input.user.partner!.role === "staff") {
      throw new ForbiddenException("Your role cannot change a reservation's dates")
    }

    // Only a stay that has not started. Once the guest is in the building the
    // dates are a fact, not a plan.
    if (booking.status !== "confirmed" && booking.status !== "pending") {
      throw new BadRequestException({
        message: `A ${booking.status.replace(/_/g, " ")} booking cannot be changed.`,
        code: "not_modifiable",
      })
    }

    const quote = this.tokens.verify(input.quoteToken, now)

    if (quote.userId !== null && quote.userId !== input.user.id) {
      throw new ForbiddenException("That quote belongs to a different account")
    }

    // The quote has to be for THIS booking's room and rate. Changing room is a
    // different product at a different price — that is a cancel and rebook.
    if (quote.roomId !== booking.roomId || quote.ratePlanId !== booking.ratePlanId) {
      throw new BadRequestException({
        message: "A change must keep the same room and rate. Cancel and rebook to switch rooms.",
        code: "room_change_not_supported",
      })
    }

    const oldTotal = booking.total
    const newTotal = quote.pricing.total
    const delta = newTotal - oldTotal
    const newDates = datesOf(quote.checkIn, nightsBetween(quote.checkIn, quote.checkOut))

    try {
      const updated = await this.repo.modifyWithInventorySwap({
        bookingId: booking.id,
        fromStatus: booking.status,
        roomId: booking.roomId,
        oldCheckIn: booking.checkIn as ISODate,
        oldCheckOut: booking.checkOut as ISODate,
        newCheckIn: quote.checkIn as ISODate,
        newCheckOut: quote.checkOut as ISODate,
        actorId: input.user.id,
        actor,
        reason: `Changed to ${quote.checkIn} – ${quote.checkOut}`,
        patch: {
          checkIn: quote.checkIn,
          checkOut: quote.checkOut,
          adults: quote.occupancy.adults,
          children: quote.occupancy.children,
          pricing: quote.pricing,
          total: newTotal,
          promotionId: quote.promotionId,
          // Commission follows the new total, at the rate already snapshotted.
          commissionAmount: commissionFor(newTotal, booking.commissionRateBps),
        },
        verify: (locked) => {
          if (locked.length !== newDates.length) {
            throw new ConflictException("Those dates are no longer available")
          }
          if (locked.some((n) => n.isClosed === true)) {
            throw new ConflictException("Those dates were just closed by the property")
          }
          if (unitsLeft(locked.map(toResolved)) <= 0) throw new SoldOutError()
        },
      })

      if (!updated) throw new ConflictException("That booking was just changed by someone else")

      await this.repo.replaceAddOns(
        booking.id,
        quote.pricing.addOnsTotal > 0 ? await this.support.addOnsFromQuote(quote) : []
      )

      /*
       * The dates on a confirmed booking just changed under the guest.
       *
       * Keyed on the new dates rather than the booking id, so a second change
       * is a second message — otherwise the dedupe key would silence every
       * change after the first.
       */
      await this.notifications.notify({
        template: "booking_modified",
        subjectId: `${booking.id}:${quote.checkIn}:${quote.checkOut}`,
        userId: booking.customerId,
        toEmail: booking.guestEmail,
        payload: {
          ref: booking.ref,
          propertyName: booking.propertyName,
          checkIn: quote.checkIn,
          checkOut: quote.checkOut,
          total: newTotal,
        },
        inApp: {
          title: `Booking ${booking.ref} updated`,
          message: `${quote.checkIn} to ${quote.checkOut}`,
          href: `/dashboard/bookings/${booking.ref}`,
        },
      })

      return {
        booking: toDto(updated),
        /**
         * What the change costs or returns (rule #17).
         *
         * REPORTED, not moved: taking the money needs a payment provider, which
         * arrives in Module 7. Recording a settled balance before then would be
         * a lie in the ledger.
         */
        priceChange: {
          previousTotal: oldTotal,
          newTotal,
          delta,
          settlement: delta > 0 ? ("due" as const) : delta < 0 ? ("refund" as const) : ("none" as const),
          settled: false,
        },
      }
    } catch (error) {
      if (error instanceof SoldOutError) {
        throw new ConflictException({
          message: "Those dates were just taken. Your original booking is unchanged.",
          code: "just_sold_out",
        })
      }
      throw error
    }
  }

  /* ---------------------------------------------------------------- cancel */

  async cancel(input: {
    bookingId: string
    reason: string
    user: AuthenticatedUser
    now?: Date
  }) {
    const now = input.now ?? new Date()
    const booking = await this.repo.findById(input.bookingId)
    if (!booking) throw new NotFoundException("Booking not found")

    const role = await this.assertCanSee(booking, input.user)
    const actor = actorOf(input.user, role)

    const guard = canTransition(booking.status as BookingStatus, "cancelled", actor)
    if (!guard.ok) {
      throw new BadRequestException({ message: guard.message, code: guard.reason })
    }

    const property = await this.support.propertyOf(booking.propertyId)
    if (!property) throw new NotFoundException("Property not found")

    const by: CancelledBy = role === "customer" ? "guest" : role === "admin" ? "admin" : "property"

    const refund = refundFor({
      // Parsed, not asserted. Both of these come out of the database as loose
      // values — JSONB and plain varchars — and an unrecognised `charge` would
      // fall through `refundFor`'s switch and quietly refund the whole stay.
      policy: storedCancellationPolicySchema.parse(policyFromColumns(booking)),
      pricing: bookingPricingSchema.parse(booking.pricing),
      checkIn: booking.checkIn as ISODate,
      checkInTime: property.checkInTime,
      timezone: property.timezone,
      cancelledAt: now,
      // Rule #37 — a cancellation the guest did not cause carries no penalty.
      by,
    })

    // Looked up before the transaction opens — see `reconcileBooking`.
    const partner = await this.notifications.recipientForProperty(booking.propertyId)
    const settlement = settlementFor({
      mode: booking.paymentMode as PaymentMode,
      refund: refund.refund,
      charged: refund.charged,
    })

    const updated = await this.repo.cancelWithRelease({
      bookingId: booking.id,
      fromStatus: booking.status,
      cancelledBy: by,
      reason: input.reason,
      refundAmount: refund.refund,
      refundStatus: refund.refundStatus,
      actorId: input.user.id,
      actor,
      roomId: booking.roomId,
      checkIn: booking.checkIn as ISODate,
      checkOut: booking.checkOut as ISODate,

      /*
       * Queued INSIDE the cancellation (rule #57).
       *
       * `settlementFor` is computed above rather than read from the money
       * move below, because the message has to be queued in the same
       * transaction as the cancellation — and the money deliberately moves
       * after it commits. Both read the same `refundFor` figures, so they
       * cannot disagree.
       */
      within: async (tx) => {
        await this.notifications.notify(
          {
            template: "booking_cancelled",
            subjectId: booking.id,
            userId: booking.customerId,
            toEmail: booking.guestEmail,
            payload: {
              ref: booking.ref,
              propertyName: booking.propertyName,
              action: settlement.action,
              amount: settlement.amount,
            },
            inApp: {
              title: `Booking ${booking.ref} cancelled`,
              message: `Your stay at ${booking.propertyName} has been cancelled.`,
              href: `/dashboard/bookings/${booking.ref}`,
            },
          },
          tx
        )

        if (partner) {
          await this.notifications.notify(
            {
              template: "partner_booking_cancelled",
              subjectId: booking.id,
              userId: partner.userId,
              toEmail: partner.email,
              payload: {
                ref: booking.ref,
                guestName: `${booking.guestFirstName} ${booking.guestLastName}`.trim(),
                // What the property KEEPS, which is the figure they care about.
                charged: refund.charged,
              },
              inApp: {
                title: `Cancellation ${booking.ref}`,
                message: `${booking.roomName} · ${booking.checkIn} to ${booking.checkOut}`,
                href: "/extranet/reservations",
              },
            },
            tx
          )
        }
      },
    })

    if (!updated) {
      throw new ConflictException("That booking was just changed by someone else")
    }

    /*
     * The money moves AFTER the booking row is committed (rules #45, #46).
     *
     * Not inside the transaction: a provider call there would hold the
     * inventory rows locked across a network round trip, and a rollback cannot
     * un-send a refund that already left.
     *
     * Which direction it moves was decided above by `settlementFor`, from the
     * same figures rule #1 produced — a prepaid booking sends money back, a
     * guaranteed one charges the card it saved.
     */
    await this.settlement.settleCancellation({
      bookingId: booking.id,
      mode: booking.paymentMode as PaymentMode,
      refund: refund.refund,
      charged: refund.charged,
    })

    return { booking: toDto(updated), refund, settlement }
  }

  /* ------------------------------------------------------------ transition */

  async setStatus(input: {
    bookingId: string
    to: BookingStatus
    user: AuthenticatedUser
    roomNo?: string
  }) {
    const booking = await this.repo.findById(input.bookingId)
    if (!booking) throw new NotFoundException("Booking not found")

    const role = await this.assertCanSee(booking, input.user)
    const actor = actorOf(input.user, role)

    const guard = canTransition(booking.status as BookingStatus, input.to, actor)
    if (!guard.ok) {
      throw new BadRequestException({ message: guard.message, code: guard.reason })
    }

    const updated = await this.repo.transition({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: input.to,
      actorId: input.user.id,
      actor,
      ...(input.roomNo ? { patch: { roomNo: input.roomNo } } : {}),
      ...(input.to === "completed" ? { patch: { commissionStatus: "earned" } } : {}),
      ...(input.to === "no_show" ? { patch: { commissionStatus: "void" } } : {}),
    })

    if (!updated) throw new ConflictException("That booking was just changed by someone else")

    /*
     * A no-show costs the guest what the policy says (rules #9, #42).
     *
     * Rule #9 already voids the commission — the platform earns nothing on a
     * stay that did not happen. But the PROPERTY held a room all night, and on
     * a guarantee rate nobody has paid a cent. Charging the card the guest
     * saved is the entire reason that card was collected; without this step
     * "pay at the property" is a free reservation with extra steps.
     *
     * The no-show fee is the same figure a cancellation at arrival would
     * produce, so it comes from the same rule rather than a second one.
     */
    const settlement = input.to === "no_show" ? await this.noShowSettlement(booking) : null

    /*
     * A completed stay may have earned the guest a tier (rules #3, #53).
     *
     * Counted here rather than tracked as a running total on the account: a
     * counter can drift, and the stays are already in the table. Auth owns
     * `users`, so it makes the decision — bookings only says how many.
     *
     * Awaited but never allowed to fail the transition: the stay happened
     * either way, and the next completed booking re-derives the same answer.
     */
    if (input.to === "completed" && booking.customerId) {
      const completedStays = await this.repo.countCompletedFor(booking.customerId)
      await this.auth
        .applyEarnedTier({ userId: booking.customerId, completedStays })
        .catch(() => null)
    }

    return { ...toDto(updated), settlement }
  }

  /**
   * What a no-show costs, and taking it.
   *
   * `refundFor` is asked with the cancellation happening at arrival, which is
   * how a no-show IS a cancellation as far as rule #1 is concerned — the guest
   * simply never said so. Reusing it means the two can never disagree about
   * what the same policy is worth.
   */
  private async noShowSettlement(booking: {
    id: string
    checkIn: string
    propertyId: string
    paymentMode: string
    pricing: unknown
    cancelFreeUntil: string
    cancelCharge: string
    cancelChargeValue: number | null
    noShowCharge: string | null
    noShowChargeValue: number | null
  }) {
    const property = await this.support.propertyOf(booking.propertyId)
    if (!property) return { action: "none" as const, amount: 0 }

    const refund = refundFor({
      policy: storedCancellationPolicySchema.parse(policyFromColumns(booking)),
      pricing: bookingPricingSchema.parse(booking.pricing),
      checkIn: booking.checkIn as ISODate,
      checkInTime: property.checkInTime,
      timezone: property.timezone,
      cancelledAt: new Date(),
      /*
       * The flag, not a faked timestamp.
       *
       * This used to pass `checkIn` at 23:59 to make the deadline look passed,
       * which worked but said the wrong thing: the guest did not cancel at the
       * last second, they never cancelled. Saying so lets the rate plan's own
       * no-show terms apply — and lets rule #37 still excuse a property-caused
       * one.
       */
      noShow: true,
      by: "guest",
    })

    return this.settlement.settleCancellation({
      bookingId: booking.id,
      mode: booking.paymentMode as PaymentMode,
      refund: refund.refund,
      charged: refund.charged,
    })
  }

  /* ----------------------------------------------------------------- authz */

  /**
   * Who the caller is RELATIVE to this booking.
   *
   * Not "are they logged in" — that is the guard's job. This asks whether this
   * particular booking is any of their business.
   */
  private async assertCanSee(
    booking: { customerId: string | null; propertyId: string },
    user: AuthenticatedUser
  ): Promise<"customer" | "partner" | "admin"> {
    if (user.role === "admin") return "admin"

    if (booking.customerId !== null && booking.customerId === user.id) return "customer"

    if (user.partner) {
      const allowed = await this.support.propertyIdsForOrg(
        user.partner.orgId,
        user.partner.propertyIds
      )
      if (allowed.includes(booking.propertyId)) return "partner"
    }

    // Not theirs — and it does not exist as far as they are concerned.
    throw new NotFoundException("Booking not found")
  }
}

function actorOf(user: AuthenticatedUser, role: "customer" | "partner" | "admin"): BookingActor {
  if (role === "admin") return "platform_admin"
  if (role === "customer") return "guest"
  return `partner_${user.partner!.role}` as BookingActor
}

/**
 * A locked inventory row, in the shape `unitsLeft` reads.
 *
 * Only the stock fields carry meaning here — the calendar restrictions were
 * already checked when the quote was issued, and re-deriving them from a row
 * that does not hold them would invent answers. This exists so `unitsLeft`
 * stays the single implementation of "how many are left", rather than being
 * open-coded once per call site.
 */
function toResolved(row: {
  date: string
  sellableUnits: number
  bookedUnits: number
  isClosed: boolean | null
}) {
  return {
    date: row.date as ISODate,
    rate: 0,
    minStay: 1,
    minStayThrough: null,
    maxStay: null,
    closedToArrival: false,
    closedToDeparture: false,
    minAdvanceHours: null,
    isClosed: row.isClosed ?? false,
    totalUnits: row.sellableUnits,
    sellableUnits: row.sellableUnits,
    bookedUnits: row.bookedUnits,
  }
}

function datesOf(checkIn: string, nights: number): ISODate[] {
  return Array.from({ length: nights }, (_, i) => addDays(checkIn as ISODate, i))
}

/** Stable hash of what the request asked for, so a reused key is detectable. */
function hashRequest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

/** Explicit fields — a column added later cannot leak into a response. */
function toDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    ref: row.ref,
    status: row.status,
    propertyId: row.propertyId,
    /*
     * The room and the rate plan a modification has to re-quote against.
     *
     * The DTO carried only the NAMES, which are snapshots frozen at booking
     * time — right for showing what was reserved, useless for asking the
     * server to price the same room on different dates. Without these the
     * modify screen had to guess, and it guessed by pricing in the browser.
     */
    roomId: row.roomId,
    ratePlanId: row.ratePlanId,
    propertyName: row.propertyName,
    roomName: row.roomName,
    ratePlanName: row.ratePlanName,
    city: row.city,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    adults: row.adults,
    children: row.children,
    /*
     * Who the stay is FOR.
     *
     * Missing until the confirmation screen went looking for it — the page
     * wanted to say "Thank you, Amelia" and "sent to amelia@…" and had
     * neither. It matters more than it looks: a guest can book for somebody
     * else (the booking belongs to whoever is signed in, the guest details are
     * whoever is staying), so these are not derivable from the session.
     *
     * Only ever returned to the booking's owner or its property — the routes
     * that reach `toDto` are all scoped first.
     */
    guest: {
      firstName: row.guestFirstName,
      lastName: row.guestLastName,
      email: row.guestEmail,
      phone: row.guestPhone,
      country: row.guestCountry,
    },
    arrivalTime: row.arrivalTime,
    specialRequests: row.specialRequests,
    pricing: row.pricing,
    total: row.total,
    /*
     * The MODE only. Whether it was paid lives in the `payments` table, and
     * the booking detail carries that ledger — a `status` copied here would be
     * a second answer to the same question, free to disagree with the money.
     */
    payment: { mode: row.paymentMode },
    /*
     * When the hold lapses (rule #44).
     *
     * Non-null only while the booking is `pending`. Missing until the checkout
     * screen went looking for it — and without it a guest sits on a payment
     * form with no idea they have fifteen minutes, then watches the booking
     * vanish with no warning it was ever counting down.
     */
    holdExpiresAt: row.holdExpiresAt,
    source: row.source,
    roomNo: row.roomNo,
    cancelledAt: row.cancelledAt,
    cancelledBy: row.cancelledBy,
    /*
     * Why it was cancelled, in the words whoever cancelled it typed.
     *
     * The column has always been written — the partner's cancel dialog demands
     * a reason — and never read back. The cancellations screen shows a Reason
     * column, so without this it had a column and no data to put in it.
     */
    cancellationReason: row.cancellationReason,
    refundAmount: row.refundAmount,
    refundStatus: row.refundStatus,
    createdAt: row.createdAt,
  }
}
