import { Inject, Injectable } from "@nestjs/common"
import type { ISODate, ScopedPromotion } from "@stayora/shared"
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  bookings,
  promotionProperties,
  promotionRooms,
  promotions,
  ratePlanOccupancyPrices,
  ratePlans,
  rooms,
  valueAdds,
} from "../../db/schema"

@Injectable()
export class PricingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The room and rate plan being priced, proven to belong to the property. */
  async findRoomAndPlan(input: { propertyId: string; roomId: string; ratePlanId: string }) {
    const [row] = await this.db
      .select({ room: rooms, ratePlan: ratePlans })
      .from(ratePlans)
      .innerJoin(rooms, eq(rooms.id, ratePlans.roomId))
      .where(
        and(
          eq(ratePlans.id, input.ratePlanId),
          eq(rooms.id, input.roomId),
          // Without this a caller could price room A against property B's plan.
          eq(rooms.propertyId, input.propertyId),
          eq(ratePlans.status, "active")
        )
      )
      .limit(1)
    return row ?? null
  }

  /**
   * What this rate plan charges at each party size (rule #101).
   *
   * Empty for a plan that has never been configured, which is every plan by
   * default — and an empty matrix means the price does not move with the party
   * size, exactly as it behaved before this existed.
   */
  async occupancyPrices(ratePlanId: string) {
    return this.db
      .select({
        guests: ratePlanOccupancyPrices.guests,
        price: ratePlanOccupancyPrices.price,
      })
      .from(ratePlanOccupancyPrices)
      .where(eq(ratePlanOccupancyPrices.ratePlanId, ratePlanId))
      .orderBy(asc(ratePlanOccupancyPrices.guests))
  }

  /**
   * A booking, but ONLY if it belongs to the caller.
   *
   * The ownership filter is in the query (API1): a booking that is not theirs
   * simply does not exist here, so it can never be used to excuse inventory
   * during a re-quote.
   */
  async findOwnedBooking(input: { bookingId: string; userId: string }) {
    const [row] = await this.db
      .select({
        id: bookings.id,
        roomId: bookings.roomId,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        status: bookings.status,
      })
      .from(bookings)
      .where(and(eq(bookings.id, input.bookingId), eq(bookings.customerId, input.userId)))
      .limit(1)
    return row ?? null
  }

  async findValueAdds(propertyId: string, ids: string[]) {
    if (ids.length === 0) return []
    return this.db
      .select()
      .from(valueAdds)
      .where(
        and(
          eq(valueAdds.propertyId, propertyId),
          inArray(valueAdds.id, ids),
          eq(valueAdds.active, true)
        )
      )
  }

  /**
   * Live promotions covering a property, with their room targeting attached.
   *
   * Filtered in SQL down to `active` and in-window; the finer rules — channel,
   * tier, room, minimum stay — are applied by the domain, so the frontend's
   * optimistic preview and this server agree by construction.
   */
  async applicablePromotions(input: { propertyId: string; today: ISODate }): Promise<ScopedPromotion[]> {
    const rows = await this.db
      .select({ promotion: promotions })
      .from(promotions)
      .innerJoin(promotionProperties, eq(promotionProperties.promotionId, promotions.id))
      .where(
        and(
          eq(promotionProperties.propertyId, input.propertyId),
          eq(promotions.status, "active"),
          lte(promotions.startDate, input.today),
          gte(promotions.endDate, input.today)
        )
      )

    if (rows.length === 0) return []

    const ids = rows.map((r) => r.promotion.id)
    const targeted = await this.db
      .select()
      .from(promotionRooms)
      .where(inArray(promotionRooms.promotionId, ids))

    const roomsByPromotion = new Map<string, string[]>()
    for (const row of targeted) {
      const list = roomsByPromotion.get(row.promotionId) ?? []
      list.push(row.roomId)
      roomsByPromotion.set(row.promotionId, list)
    }

    return rows.map(({ promotion }) => ({
      id: promotion.id,
      name: promotion.name,
      kind: promotion.kind as ScopedPromotion["kind"],
      discount: {
        type: promotion.discountType as ScopedPromotion["discount"]["type"],
        value: promotion.discountValue,
      },
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      // No rows = every room of every listed property (rule #21).
      roomIds: roomsByPromotion.get(promotion.id) ?? [],
      minStay: promotion.minStay,
      channel: promotion.channel as ScopedPromotion["channel"],
      status: promotion.status as ScopedPromotion["status"],
      propertyIds: [input.propertyId],
      createdAt: promotion.createdAt,
      updatedAt: promotion.updatedAt,
    }))
  }
}
