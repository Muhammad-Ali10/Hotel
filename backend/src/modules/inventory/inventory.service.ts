import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import {
  BOOKING_HORIZON_MONTHS,
  COPY_RATES_MAX_DAYS,
  addDays,
  checkAvailability,
  checkInInstant,
  daysBetween,
  nightsBetween,
  resolveNight,
  toISODate,
  unitsLeft,
  withinBookingHorizon,
  type Cents,
  type CopyRatesInput,
  type ISODate,
  type Occupancy,
  type RatePlanRate,
  type CalendarView,
  type ResolvedNight,
  type RoomInventoryEntry,
  type StayCheck,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { InventoryRepository } from "./inventory.repository"

/**
 * How many nights one request may ask about at once.
 *
 * A guest never searches a year-long stay, but an unbounded range lets a caller
 * make the database sweep the whole calendar for free (API4).
 */
const MAX_STAY_NIGHTS = 90

export type RatePlanAvailability = {
  ratePlanId: string
  ratePlanName: string
  isDefault: boolean
  /** Sum of the nightly rates for the whole stay, in cents. */
  totalRate: Cents
  nightlyRates: Cents[]
  available: boolean
  reason?: string
  message?: string
}

export type RoomAvailability = {
  roomId: string
  roomName: string
  maxAdults: number
  maxChildren: number
  maxOccupancy: number
  unitsLeft: number
  ratePlans: RatePlanAvailability[]
}

@Injectable()
export class InventoryService {
  constructor(private readonly repo: InventoryRepository) {}

  /**
   * What can actually be booked for these dates.
   *
   * ⚠️ ADVISORY. Every answer here is a snapshot that is already stale by the
   * time it reaches the caller — two guests can both be told "1 room left" and
   * both be right. The binding check is the booking transaction's row lock plus
   * `CHECK (booked_units <= sellable_units)`.
   */
  async availability(input: {
    slug: string
    checkIn: ISODate
    checkOut: ISODate
    occupancy: Occupancy
    /** Passed in, never read from a clock inside the domain. */
    now?: Date
  }) {
    const now = input.now ?? new Date()
    const today = toISODate(now)

    const nights = nightsBetween(input.checkIn, input.checkOut)
    if (nights <= 0) {
      throw new BadRequestException("Check-out must be after check-in")
    }
    if (nights > MAX_STAY_NIGHTS) {
      throw new BadRequestException(`Stays longer than ${MAX_STAY_NIGHTS} nights are not bookable online`)
    }
    if (daysBetween(today, input.checkIn) < 0) {
      throw new BadRequestException("Check-in cannot be in the past")
    }
    // Bounds the query as well as the answer (rule #34).
    if (!withinBookingHorizon(input.checkOut, today)) {
      throw new BadRequestException(
        `Bookings open ${BOOKING_HORIZON_MONTHS} months ahead. Choose earlier dates.`
      )
    }

    const property = await this.repo.findPropertyBySlug(input.slug)
    if (!property) throw new NotFoundException("Property not found")

    // The calendar is loaded one night PAST checkout, because closed-to-
    // departure applies to the checkout date — which is not a night the guest
    // occupies, so a range stopping at the last night would never see it.
    const context = await this.repo.loadStayContext({
      propertyId: property.id,
      from: input.checkIn,
      to: input.checkOut,
    })

    const inventoryByRoom = index(context.inventory, (r) => `${r.roomId}|${r.date}`)
    const ratesByPlan = index(context.rates, (r) => `${r.ratePlanId}|${r.date}`)

    const stayDates = datesOf(input.checkIn, nights)
    const arrivalInstant = checkInInstant({
      checkIn: input.checkIn,
      checkInTime: property.checkInTime,
      timezone: property.timezone,
    })

    const rooms: RoomAvailability[] = context.rooms.map((room) => {
      const plans = context.ratePlans.filter((p) => p.roomId === room.id)

      const ratePlans: RatePlanAvailability[] = plans.map((plan) => {
        const resolved: ResolvedNight[] = stayDates.map((date) =>
          resolveNight(date, {
            room,
            ratePlan: plan,
            ...pick(inventoryByRoom.get(`${room.id}|${date}`)),
            ...pickRate(ratesByPlan.get(`${plan.id}|${date}`)),
          })
        )

        // The checkout date's own row, for the closed-to-departure rule.
        const departure = resolveNight(input.checkOut, {
          room,
          ratePlan: plan,
          ...pick(inventoryByRoom.get(`${room.id}|${input.checkOut}`)),
          ...pickRate(ratesByPlan.get(`${plan.id}|${input.checkOut}`)),
        })

        const check: StayCheck = checkAvailability({
          nights: resolved,
          occupancy: input.occupancy,
          room,
          departureNight: departure,
          now,
          checkInInstant: arrivalInstant,
        })

        return {
          ratePlanId: plan.id,
          ratePlanName: plan.name,
          isDefault: plan.isDefault,
          totalRate: resolved.reduce((sum, n) => sum + n.rate, 0),
          nightlyRates: resolved.map((n) => n.rate),
          available: check.ok,
          ...(check.ok ? {} : { reason: check.reason, message: check.message }),
        }
      })

      // Inventory is the ROOM's, shared by every plan on it — so it is computed
      // once from any plan's resolution rather than per plan.
      const anyResolved = stayDates.map((date) =>
        resolveNight(date, {
          room,
          ratePlan: { basePrice: 0, defaultMinStay: 1, defaultMaxStay: null },
          ...pick(inventoryByRoom.get(`${room.id}|${date}`)),
        })
      )

      return {
        roomId: room.id,
        roomName: room.name,
        maxAdults: room.maxAdults,
        maxChildren: room.maxChildren,
        maxOccupancy: room.maxOccupancy,
        unitsLeft: unitsLeft(anyResolved),
        ratePlans,
      }
    })

    return {
      propertyId: property.id,
      slug: property.slug,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights,
      rooms,
      /** True when at least one room and plan can actually be booked. */
      available: rooms.some((r) => r.ratePlans.some((p) => p.available)),
    }
  }

  /**
   * The partner's own calendar (Module 3, the read side).
   *
   * Every night is resolved through the SAME `resolveNight` the quote engine
   * uses. Reading the sparse rows straight out of the table would show a
   * partner blanks wherever the defaults apply — and worse, would let this
   * screen and the guest's price drift apart the first time a fallback moved.
   */
  async calendar(input: {
    propertyId: string
    from: ISODate
    to: ISODate
    roomId?: string
    ratePlanId?: string
    user: AuthenticatedUser
  }): Promise<CalendarView> {
    /*
     * Reading is open to every partner role, front-desk staff included.
     *
     * Changing a rate is a commercial act; looking at tonight's stock is the
     * job. Locking the calendar away from the desk only pushes them to ring
     * somebody at 2am for a number that is on a screen.
     */
    const owned = await this.repo.roomsForPartner({
      propertyId: input.propertyId,
      ...partnerScope(input.user),
    })
    // 404, never 403 — a 403 would confirm the property id is real (API1).
    if (owned.length === 0) throw new NotFoundException("Property not found")

    const context = await this.repo.loadCalendarContext(input)
    const dates = datesOf(input.from, daysBetween(input.from, input.to) + 1)

    const inventoryByRoom = keyByDate(context.inventory, (row) => row.roomId)
    const ratesByPlan = keyByDate(context.rates, (row) => row.ratePlanId)

    const rooms = context.rooms.map((room) => {
      const stockRows = inventoryByRoom.get(room.id) ?? new Map()

      return {
        id: room.id,
        name: room.name,
        units: room.units,
        status: room.status,
        stock: dates.map((date) => {
          const row = stockRows.get(date)
          return {
            date,
            // The room's own count stands in where no row exists — exactly what
            // the booking transaction materialises on the first sale.
            totalUnits: row?.totalUnits ?? room.units,
            sellableUnits: row?.sellableUnits ?? room.units,
            bookedUnits: row?.bookedUnits ?? 0,
            isClosed: row?.isClosed ?? false,
            isMaterialised: row !== undefined,
          }
        }),
        ratePlans: context.ratePlans
          .filter((plan) => plan.roomId === room.id)
          .map((plan) => {
            const rateRows = ratesByPlan.get(plan.id) ?? new Map()
            return {
              id: plan.id,
              name: plan.name,
              basePrice: plan.basePrice,
              status: plan.status,
              /*
               * What the plan itself says, beside what each night resolved to.
               *
               * Every night below is already resolved against these, so the
               * numbers alone cannot answer "did somebody set this". A screen
               * listing the nights that carry a restriction needs the default
               * to compare against — without it, a plan whose own minimum is
               * two nights reads as though every night in the year had been
               * restricted by hand.
               */
              defaultMinStay: plan.defaultMinStay,
              defaultMaxStay: plan.defaultMaxStay,
              nights: dates.map((date) => {
                const rate = rateRows.get(date)
                const stock = stockRows.get(date)
                const resolved = resolveNight(date, {
                  room,
                  ratePlan: plan,
                  ...(stock ? { inventory: stock } : {}),
                  ...(rate ? { rate } : {}),
                })
                return {
                  date,
                  rate: resolved.rate,
                  minStay: resolved.minStay,
                  minStayThrough: resolved.minStayThrough,
                  maxStay: resolved.maxStay,
                  closedToArrival: resolved.closedToArrival,
                  closedToDeparture: resolved.closedToDeparture,
                  minAdvanceHours: resolved.minAdvanceHours,
                  /*
                   * "I set THIS PRICE", not "a row exists".
                   *
                   * Without this a partner cannot tell their own price from
                   * the plan's, and every screen showing an override badge
                   * needs precisely that difference.
                   *
                   * The test is the column, not the row. Clearing a rate
                   * leaves the row behind — it still carries this night's
                   * restrictions — and a row-level test would keep claiming an
                   * override after the price had gone back to the plan's.
                   */
                  isOverridden: rate?.rate != null,
                }
              }),
            }
          }),
      }
    })

    return { from: input.from, to: input.to, rooms }
  }

  /* --------------------------------------------------------------- partner */

  /**
   * Opens or closes a date range (rule #32).
   *
   * With no `roomIds`, this closes EVERY room of the property — the bulk action
   * a partner needs for a renovation. There is no separate property-level
   * closure table: one source of truth means the availability query never has
   * to ask two places whether a date is open.
   */
  async setClosed(
    input: { propertyId: string; roomIds?: string[]; from: ISODate; to: ISODate; isClosed: boolean },
    user: AuthenticatedUser
  ) {
    const scope = partnerScope(user)
    if (user.partner!.role === "staff") {
      throw new ForbiddenException("Your role cannot change availability")
    }
    if (daysBetween(input.from, input.to) < 0) {
      throw new BadRequestException("The range ends before it starts")
    }
    if (daysBetween(input.from, input.to) > 366) {
      throw new BadRequestException("Close at most one year at a time")
    }

    const owned = await this.repo.roomsForPartner({ propertyId: input.propertyId, ...scope })
    if (owned.length === 0) throw new NotFoundException("Property not found")

    const targetIds = input.roomIds?.length
      ? owned.filter((r) => input.roomIds!.includes(r.room.id)).map((r) => r.room.id)
      : owned.map((r) => r.room.id)

    if (targetIds.length === 0) throw new NotFoundException("No matching rooms")

    const rows = await this.repo.setClosed({
      roomIds: targetIds,
      from: input.from,
      to: input.to,
      isClosed: input.isClosed,
    })

    return { rooms: targetIds.length, datesAffected: rows }
  }

  async setRates(
    input: {
      ratePlanId: string
      from: ISODate
      to: ISODate
      patch: Parameters<InventoryRepository["setRates"]>[0]["patch"]
    },
    user: AuthenticatedUser
  ) {
    const scope = partnerScope(user)
    if (user.partner!.role === "staff") {
      throw new ForbiddenException("Your role cannot change rates")
    }

    const found = await this.repo.findRatePlanForPartner({ ratePlanId: input.ratePlanId, ...scope })
    if (!found) throw new NotFoundException("Rate plan not found")

    if (daysBetween(input.from, input.to) < 0) {
      throw new BadRequestException("The range ends before it starts")
    }
    if (daysBetween(input.from, input.to) > 366) {
      throw new BadRequestException("Set at most one year at a time")
    }

    const rows = await this.repo.setRates(input)
    return { datesAffected: rows }
  }

  /**
   * Copying one stretch of calendar onto another (rule #100).
   *
   * Both rate plans are resolved through the caller's own portfolio, and
   * separately — the source and the target can legitimately be different
   * plans, and checking only one of them would let a partner read a rate plan
   * they do not own by copying from it.
   */
  async copyRates(input: CopyRatesInput, user: AuthenticatedUser) {
    const scope = partnerScope(user)
    if (user.partner!.role === "staff") {
      throw new ForbiddenException("Your role cannot change rates")
    }

    const targetRatePlanId = input.targetRatePlanId ?? input.sourceRatePlanId

    const [source, target] = await Promise.all([
      this.repo.findRatePlanForPartner({ ratePlanId: input.sourceRatePlanId, ...scope }),
      this.repo.findRatePlanForPartner({ ratePlanId: targetRatePlanId, ...scope }),
    ])
    if (!source) throw new NotFoundException("Rate plan not found")
    if (!target) throw new NotFoundException("Rate plan not found")

    if (daysBetween(input.targetFrom, input.targetTo) > COPY_RATES_MAX_DAYS) {
      throw new BadRequestException("Copy at most one year at a time")
    }
    if (daysBetween(input.sourceFrom, input.sourceTo) > COPY_RATES_MAX_DAYS) {
      throw new BadRequestException("Copy at most one year at a time")
    }

    /*
     * Copying a range onto itself, on the same plan, would read each row and
     * write it back over itself — harmless but pointless, and it reports a
     * number of "changed" days that changed nothing.
     */
    if (
      targetRatePlanId === input.sourceRatePlanId &&
      input.sourceFrom === input.targetFrom &&
      input.sourceTo === input.targetTo
    ) {
      throw new BadRequestException("The source and target ranges are the same")
    }

    const rows = await this.repo.copyRates({ ...input, targetRatePlanId })
    return { datesAffected: rows, targetRatePlanId }
  }
}

function partnerScope(user: AuthenticatedUser): { orgId: string; propertyIds: string[] } {
  if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
  return { orgId: user.partner.orgId, propertyIds: user.partner.propertyIds }
}

function datesOf(checkIn: ISODate, nights: number): ISODate[] {
  return Array.from({ length: nights }, (_, i) => addDays(checkIn, i))
}

function index<T>(rows: T[], key: (row: T) => string): Map<string, T> {
  const map = new Map<string, T>()
  for (const row of rows) map.set(key(row), row)
  return map
}

/** Drizzle returns `date` as a string; the domain's shapes expect exactly that. */
function pick(row: RoomInventoryEntry | undefined) {
  return row ? { inventory: row } : {}
}

function pickRate(row: RatePlanRate | undefined) {
  return row ? { rate: row } : {}
}

/**
 * Groups sparse calendar rows by owner, then by date.
 *
 * Two levels because the lookup is always "this room, this night" and doing it
 * with a linear scan per night turns a year's calendar into rooms × plans ×
 * days × rows of work.
 */
function keyByDate<T extends { date: string }>(
  rows: readonly T[],
  ownerOf: (row: T) => string
): Map<string, Map<string, T>> {
  const out = new Map<string, Map<string, T>>()
  for (const row of rows) {
    const owner = ownerOf(row)
    let byDate = out.get(owner)
    if (!byDate) {
      byDate = new Map<string, T>()
      out.set(owner, byDate)
    }
    byDate.set(row.date, row)
  }
  return out
}
