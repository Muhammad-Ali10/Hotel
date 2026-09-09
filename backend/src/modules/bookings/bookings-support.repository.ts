import { Inject, Injectable } from "@nestjs/common"
import {
  checkAvailability,
  resolveNight,
  type BookingAddOn,
  type ISODate,
  type Occupancy,
  type RatePlanRate,
  type ResolvedNight,
  type RoomInventoryEntry,
} from "@stayora/shared"
import { and, eq, gte, inArray, lt } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  partnerOrgs,
  properties,
  ratePlanRates,
  ratePlans,
  roomInventory,
  rooms,
  valueAdds,
} from "../../db/schema"
import type { QuotePayload } from "../pricing/quote-token.service"

/**
 * The reads the booking flow needs that are nobody else's business.
 *
 * Kept apart from `BookingsRepository` so that file stays about the ONE thing
 * that matters most — the transaction.
 */
@Injectable()
export class BookingsSupportRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Property, room, plan and the owning org — proven to belong together. */
  async loadBookingContext(input: { propertyId: string; roomId: string; ratePlanId: string }) {
    const [row] = await this.db
      .select({ property: properties, room: rooms, ratePlan: ratePlans, org: partnerOrgs })
      .from(ratePlans)
      .innerJoin(rooms, eq(rooms.id, ratePlans.roomId))
      .innerJoin(properties, eq(properties.id, rooms.propertyId))
      .leftJoin(partnerOrgs, eq(partnerOrgs.id, properties.partnerOrgId))
      .where(
        and(
          eq(ratePlans.id, input.ratePlanId),
          eq(rooms.id, input.roomId),
          eq(properties.id, input.propertyId),
          eq(properties.status, "active"),
          eq(ratePlans.status, "active")
        )
      )
      .limit(1)
    return row ?? null
  }

  async propertyOf(propertyId: string) {
    const [row] = await this.db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1)
    return row ?? null
  }

  /** The properties a partner may act on, resolved once per request. */
  async propertyIdsForOrg(orgId: string, scoped: string[]): Promise<string[]> {
    const rows = await this.db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.partnerOrgId, orgId))
    const owned = rows.map((r) => r.id)
    // Empty scope = every property the org owns.
    return scoped.length === 0 ? owned : owned.filter((id) => scoped.includes(id))
  }

  /**
   * Rebuilds the add-on lines from the quote.
   *
   * The amounts come from the SIGNED payload, not from a fresh calculation —
   * the guest agreed to those figures, and a price that moved between quote
   * and confirm is exactly what the token exists to prevent.
   */
  async addOnsFromQuote(quote: QuotePayload): Promise<BookingAddOn[]> {
    if (quote.addOns.length === 0) return []

    const ids = quote.addOns.map((a) => a.valueAddId)
    const found = await this.db.select().from(valueAdds).where(inArray(valueAdds.id, ids))

    return quote.addOns.map((requested) => {
      const valueAdd = found.find((v) => v.id === requested.valueAddId)
      const nights = quote.pricing.nights
      const guests = quote.occupancy.adults + quote.occupancy.children
      const unit = (valueAdd?.unit ?? "per_stay") as BookingAddOn["unit"]
      const unitPrice = valueAdd?.price ?? 0
      const resolved =
        unit === "per_stay"
          ? unitPrice
          : unit === "per_night"
            ? unitPrice * nights
            : unit === "per_person"
              ? unitPrice * guests
              : unitPrice * guests * nights

      return {
        id: requested.valueAddId,
        valueAddId: requested.valueAddId,
        name: valueAdd?.name ?? "Extra",
        unit,
        unitPrice,
        qty: requested.qty,
        amount: resolved * requested.qty,
      }
    })
  }

  /**
   * Rooms the guest can still take, for rule #24.
   *
   * Runs after the transaction rejected their first choice, so it is a fresh
   * read — and still advisory, like every availability answer.
   */
  async alternativeRooms(input: {
    propertyId: string
    excludeRoomId: string
    checkIn: ISODate
    checkOut: ISODate
    occupancy: Occupancy
  }) {
    const candidates = await this.db
      .select({ room: rooms, ratePlan: ratePlans })
      .from(rooms)
      .innerJoin(ratePlans, and(eq(ratePlans.roomId, rooms.id), eq(ratePlans.status, "active")))
      .where(eq(rooms.propertyId, input.propertyId))

    const roomIds = [...new Set(candidates.map((c) => c.room.id))]
    if (roomIds.length === 0) return []

    const inventory = await this.db
      .select()
      .from(roomInventory)
      .where(
        and(
          inArray(roomInventory.roomId, roomIds),
          gte(roomInventory.date, input.checkIn),
          lt(roomInventory.date, input.checkOut)
        )
      )

    const planIds = candidates.map((c) => c.ratePlan.id)
    const rates = await this.db
      .select()
      .from(ratePlanRates)
      .where(
        and(
          inArray(ratePlanRates.ratePlanId, planIds),
          gte(ratePlanRates.date, input.checkIn),
          lt(ratePlanRates.date, input.checkOut)
        )
      )

    const dates: ISODate[] = []
    for (let d = new Date(`${input.checkIn}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10) as ISODate
      if (iso >= input.checkOut) break
      dates.push(iso)
    }

    const offers: { roomId: string; roomName: string; ratePlanId: string; ratePlanName: string; totalRate: number }[] = []

    for (const candidate of candidates) {
      if (candidate.room.id === input.excludeRoomId) continue

      const nights: ResolvedNight[] = dates.map((date) =>
        resolveNight(date, {
          room: candidate.room,
          ratePlan: candidate.ratePlan,
          ...pickOne(inventory, (r) => r.roomId === candidate.room.id && r.date === date),
          ...pickRate(rates, (r) => r.ratePlanId === candidate.ratePlan.id && r.date === date),
        })
      )

      const check = checkAvailability({
        nights,
        occupancy: input.occupancy,
        room: candidate.room,
      })
      if (!check.ok) continue

      offers.push({
        roomId: candidate.room.id,
        roomName: candidate.room.name,
        ratePlanId: candidate.ratePlan.id,
        ratePlanName: candidate.ratePlan.name,
        totalRate: nights.reduce((sum, n) => sum + n.rate, 0),
      })
    }

    return offers.sort((a, b) => a.totalRate - b.totalRate)
  }
}

/**
 * Sparse-row lookups, typed rather than asserted.
 *
 * `resolveNight` takes optional `inventory` and `rate`, and the natural way to
 * write "include it only if present" is a spread — which needs the value to
 * carry its real type, not `as never`. A cast here would hide the day one of
 * these row shapes changes.
 */
function pickOne(
  rows: RoomInventoryEntry[],
  match: (row: RoomInventoryEntry) => boolean
): { inventory?: RoomInventoryEntry } {
  const found = rows.find(match)
  return found ? { inventory: found } : {}
}

function pickRate(
  rows: RatePlanRate[],
  match: (row: RatePlanRate) => boolean
): { rate?: RatePlanRate } {
  const found = rows.find(match)
  return found ? { rate: found } : {}
}
