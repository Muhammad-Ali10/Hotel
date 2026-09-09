import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import {
  addDays,
  bestPromotion,
  checkAvailability,
  checkInInstant,
  nightlyRateFor,
  nightsBetween,
  priceBooking,
  resolveNight,
  toISODate,
  valueAddPrice,
  type BookingAddOn,
  type GuestContext,
  type ISODate,
  type Occupancy,
  type ResolvedNight,
  type ScopedPromotion,
} from "@stayora/shared"

import { InventoryRepository } from "../inventory/inventory.repository"
import { PricingRepository } from "./pricing.repository"
import { QuoteTokenService, type QuotePayload } from "./quote-token.service"

/** Statuses whose units are actually claimed on the calendar. */
const HOLDS_INVENTORY = new Set(["pending", "confirmed", "checked_in", "no_show"])

export type QuoteRequest = {
  slug: string
  roomId: string
  ratePlanId: string
  checkIn: ISODate
  checkOut: ISODate
  occupancy: Occupancy
  addOns: { valueAddId: string; qty: number }[]
  /** Resolved SERVER-side, never taken from the body. */
  guest: GuestContext
  userId: string | null
  /**
   * Set when re-quoting an EXISTING booking that is being moved.
   *
   * Its own held units are excluded, so a stay shifting by one night is not
   * blocked by itself. Ownership is verified before anything is excluded —
   * otherwise passing a stranger's booking id would hand the caller a free
   * unit of somebody else's inventory.
   */
  modifyBookingId?: string
  now?: Date
}

@Injectable()
export class PricingService {
  constructor(
    private readonly repo: PricingRepository,
    private readonly inventory: InventoryRepository,
    private readonly tokens: QuoteTokenService
  ) {}

  /**
   * The authoritative price for a stay.
   *
   * The client sends `roomId + ratePlanId + dates + occupancy + addOns` and
   * NEVER a total. Everything below is computed here and signed, so the figure
   * that comes back at booking time is one this server produced.
   */
  async quote(input: QuoteRequest) {
    const now = input.now ?? new Date()
    const today = toISODate(now)

    const nights = nightsBetween(input.checkIn, input.checkOut)
    if (nights <= 0) throw new BadRequestException("Check-out must be after check-in")

    const property = await this.inventory.findPropertyBySlug(input.slug)
    if (!property) throw new NotFoundException("Property not found")

    const target = await this.repo.findRoomAndPlan({
      propertyId: property.id,
      roomId: input.roomId,
      ratePlanId: input.ratePlanId,
    })
    if (!target) throw new NotFoundException("That room or rate is no longer offered")

    /* ------------------------------------------------------------- nights */

    const context = await this.inventory.loadStayContext({
      propertyId: property.id,
      from: input.checkIn,
      to: input.checkOut,
    })

    const inventoryByDate = new Map(
      context.inventory.filter((r) => r.roomId === input.roomId).map((r) => [r.date, r])
    )
    const ratesByDate = new Map(
      context.rates.filter((r) => r.ratePlanId === input.ratePlanId).map((r) => [r.date, r])
    )

    /**
     * Nights this quote should pretend are one unit freer.
     *
     * A booking being moved already holds its current nights. Counting them
     * against itself would make a one-night shift impossible on any room with
     * a single unit — the guest would be competing with their own reservation.
     */
    const ownHeld = await this.ownHeldDates({
      modifyBookingId: input.modifyBookingId,
      userId: input.userId,
      roomId: input.roomId,
    })

    const resolve = (date: ISODate): ResolvedNight => {
      const night = resolveNight(date, {
        room: target.room,
        ratePlan: target.ratePlan,
        ...(inventoryByDate.get(date) ? { inventory: inventoryByDate.get(date)! } : {}),
        ...(ratesByDate.get(date) ? { rate: ratesByDate.get(date)! } : {}),
      })
      return ownHeld.has(date)
        ? { ...night, bookedUnits: Math.max(0, night.bookedUnits - 1) }
        : night
    }

    /*
     * Per-guest pricing (rule #101).
     *
     * Applied to the RESOLVED night, so a calendar override for a busy week
     * lifts every party size with it. Loaded once for the stay, not per night:
     * the matrix belongs to the rate plan, not to a date.
     */
    const occupancyMatrix = await this.repo.occupancyPrices(input.ratePlanId)
    const forParty = (night: ResolvedNight): ResolvedNight => ({
      ...night,
      rate: nightlyRateFor({
        nightlyRate: night.rate,
        // Adults. Children have their own allowance on the room and are not
        // priced per head.
        guests: input.occupancy.adults,
        baseOccupancy: target.ratePlan.baseOccupancy,
        matrix: occupancyMatrix,
      }),
    })

    const stayNights = Array.from({ length: nights }, (_, i) =>
      forParty(resolve(addDays(input.checkIn, i)))
    )

    // Availability is checked here too — quoting a price for a stay that
    // cannot be booked wastes the guest's time at the worst moment.
    const availability = checkAvailability({
      nights: stayNights,
      occupancy: input.occupancy,
      room: target.room,
      departureNight: resolve(input.checkOut),
      now,
      checkInInstant: checkInInstant({
        checkIn: input.checkIn,
        checkInTime: property.checkInTime,
        timezone: property.timezone,
      }),
    })

    if (!availability.ok) {
      throw new BadRequestException({
        message: availability.message,
        code: availability.reason,
      })
    }

    /* ------------------------------------------------------------ add-ons */

    const addOns = await this.resolveAddOns({
      propertyId: property.id,
      requested: input.addOns,
      stay: { nights, guests: input.occupancy.adults + input.occupancy.children },
    })

    /* --------------------------------------------------------- promotion */

    const roomSubtotal = stayNights.reduce((sum, n) => sum + n.rate, 0)
    const promotions = await this.repo.applicablePromotions({
      propertyId: property.id,
      today,
    })

    const offer = bestPromotion(
      promotions,
      {
        propertyId: property.id,
        roomId: input.roomId,
        nights,
        today,
        guest: input.guest,
      },
      { roomSubtotal, nights: stayNights }
    )

    /* ------------------------------------------------------------- price */

    const pricing = priceBooking({
      nights: stayNights,
      guests: input.occupancy.adults + input.occupancy.children,
      addOns,
      ...(offer ? { discount: offer.discount } : {}),
    })

    const payload: Omit<QuotePayload, "iat" | "exp"> = {
      propertyId: property.id,
      roomId: input.roomId,
      ratePlanId: input.ratePlanId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      occupancy: input.occupancy,
      addOns: input.addOns,
      pricing,
      promotionId: offer?.promotion.id ?? null,
      userId: input.userId,
    }

    const { token, expiresAt } = this.tokens.issue(payload, now)

    return {
      property: { id: property.id, slug: property.slug, name: property.name },
      room: { id: target.room.id, name: target.room.name },
      ratePlan: { id: target.ratePlan.id, name: target.ratePlan.name },
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      occupancy: input.occupancy,
      addOns,
      pricing,
      promotion: offer
        ? { id: offer.promotion.id, name: offer.promotion.name, saving: offer.saving }
        : null,
      quoteToken: token,
      expiresAt: expiresAt.toISOString(),
    }
  }

  /**
   * The nights an existing booking already holds, if the caller owns it.
   *
   * Returns an empty set for anything else — an unowned id, a cancelled
   * booking, a different room. Silently ignoring rather than throwing keeps a
   * stale id from breaking a plain quote, while still refusing to hand out
   * inventory that is not the caller's.
   */
  private async ownHeldDates(input: {
    modifyBookingId?: string
    userId: string | null
    roomId: string
  }): Promise<Set<ISODate>> {
    if (!input.modifyBookingId || !input.userId) return new Set()

    const booking = await this.repo.findOwnedBooking({
      bookingId: input.modifyBookingId,
      userId: input.userId,
    })
    // Same room only, and only while it still holds inventory.
    if (!booking || booking.roomId !== input.roomId) return new Set()
    if (!HOLDS_INVENTORY.has(booking.status)) return new Set()

    const nights = nightsBetween(booking.checkIn, booking.checkOut)
    return new Set(
      Array.from({ length: nights }, (_, i) => addDays(booking.checkIn as ISODate, i))
    )
  }

  /**
   * Prices the requested extras.
   *
   * The client sends `valueAddId + qty` and never a price — the amount is
   * resolved here from the stored unit, the stay length and the party size
   * (rules #10, #23).
   */
  private async resolveAddOns(input: {
    propertyId: string
    requested: { valueAddId: string; qty: number }[]
    stay: { nights: number; guests: number }
  }): Promise<BookingAddOn[]> {
    if (input.requested.length === 0) return []

    const ids = input.requested.map((a) => a.valueAddId)
    const found = await this.repo.findValueAdds(input.propertyId, ids)

    const missing = ids.filter((id) => !found.some((v) => v.id === id))
    if (missing.length > 0) {
      // An extra that belongs to another property, or has been retired, must
      // fail loudly — silently dropping it would charge a total the guest
      // never agreed to.
      throw new BadRequestException("One of the extras you chose is no longer available")
    }

    return input.requested.map((request) => {
      const valueAdd = found.find((v) => v.id === request.valueAddId)!
      return {
        id: valueAdd.id,
        valueAddId: valueAdd.id,
        name: valueAdd.name,
        unit: valueAdd.unit as BookingAddOn["unit"],
        unitPrice: valueAdd.price,
        qty: request.qty,
        amount: valueAddPrice(
          { price: valueAdd.price, unit: valueAdd.unit as BookingAddOn["unit"] },
          input.stay,
          request.qty
        ),
      }
    })
  }
}

export type { ScopedPromotion }
