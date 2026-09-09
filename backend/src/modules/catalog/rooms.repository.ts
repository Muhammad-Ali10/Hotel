import { Inject, Injectable } from "@nestjs/common"
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  properties,
  ratePlanOccupancyPrices,
  ratePlans,
  roomInventory,
  rooms,
  valueAdds,
} from "../../db/schema"

export type RoomRow = typeof rooms.$inferSelect
export type RatePlanRow = typeof ratePlans.$inferSelect

@Injectable()
export class RoomsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* ------------------------------------------------------------ ownership */

  /**
   * A room, but only if the caller's org owns the property it sits in.
   *
   * The ownership join is in the QUERY (API1). Fetching the room and then
   * checking its property is the same thing written in a way that a later
   * caller can forget to do.
   */
  async findRoomForOrg(input: { roomId: string; orgId: string; propertyIds: string[] }) {
    const scope = [eq(rooms.id, input.roomId), eq(properties.partnerOrgId, input.orgId)]
    // Empty = every property the org owns.
    if (input.propertyIds.length > 0) scope.push(inArray(properties.id, input.propertyIds))

    const [row] = await this.db
      .select({ room: rooms, propertyId: properties.id })
      .from(rooms)
      .innerJoin(properties, eq(properties.id, rooms.propertyId))
      .where(and(...scope))
      .limit(1)
    return row ?? null
  }

  /** A rate plan, scoped the same way — through its room, to its property. */
  async findRatePlanForOrg(input: { ratePlanId: string; orgId: string; propertyIds: string[] }) {
    const scope = [eq(ratePlans.id, input.ratePlanId), eq(properties.partnerOrgId, input.orgId)]
    if (input.propertyIds.length > 0) scope.push(inArray(properties.id, input.propertyIds))

    const [row] = await this.db
      .select({ ratePlan: ratePlans, roomId: rooms.id, propertyId: properties.id })
      .from(ratePlans)
      .innerJoin(rooms, eq(rooms.id, ratePlans.roomId))
      .innerJoin(properties, eq(properties.id, rooms.propertyId))
      .where(and(...scope))
      .limit(1)
    return row ?? null
  }

  /* ----------------------------------------------------------------- read */

  /** Every room of a property, archived ones included — this is the owner's view. */
  async listRooms(propertyId: string) {
    return this.db
      .select({
        room: rooms,
        /*
         * The default rate plan's price, so a room list can show one.
         *
         * A room has no price of its own — a rate plan does (rule #27), and a
         * room can have several. The DEFAULT one is what "from" means, and a
         * subquery here is one round trip rather than one per room.
         *
         * `rate_plans.room_id = rooms.id` is written out: drizzle renders a
         * column reference inside a raw template without its table qualifier,
         * which would bind `id` to the subquery's own scope.
         */
        basePrice: sql<number | null>`(
          SELECT rp.base_price FROM rate_plans rp
          WHERE rp.room_id = rooms.id AND rp.status = 'active'
          ORDER BY rp.is_default DESC, rp.base_price ASC
          LIMIT 1
        )`,
        /*
         * WHICH plan that price belongs to.
         *
         * A room has no price of its own, so "edit the rate" has to write to a
         * rate plan — without this id the extranet had a price field with
         * nowhere to send it.
         */
        defaultRatePlanId: sql<string | null>`(
          SELECT rp.id FROM rate_plans rp
          WHERE rp.room_id = rooms.id AND rp.status = 'active'
          ORDER BY rp.is_default DESC, rp.base_price ASC
          LIMIT 1
        )`,
        ratePlans: sql<number>`(
          SELECT COUNT(*)::int FROM rate_plans rp
          WHERE rp.room_id = rooms.id AND rp.status = 'active'
        )`,
      })
      .from(rooms)
      .where(eq(rooms.propertyId, propertyId))
      .orderBy(asc(rooms.name))
  }

  async listRatePlans(roomId: string) {
    return this.db
      .select()
      .from(ratePlans)
      .where(eq(ratePlans.roomId, roomId))
      .orderBy(asc(ratePlans.name))
  }

  /**
   * Every plan in a property, in one query.
   *
   * Fetching them room by room is N round trips for a screen that always wants
   * the whole set — and the room's name has to come back with the plan, or the
   * caller cannot tell "Flexible" on a suite from "Flexible" on a double.
   */
  async listRatePlansForProperty(propertyId: string) {
    return this.db
      .select({
        plan: ratePlans,
        roomName: rooms.name,
        roomUnits: rooms.units,
        roomStatus: rooms.status,
      })
      .from(ratePlans)
      .innerJoin(rooms, eq(rooms.id, ratePlans.roomId))
      .where(eq(rooms.propertyId, propertyId))
      .orderBy(asc(rooms.name), asc(ratePlans.name))
  }

  /* ---------------------------------------------------------------- write */

  async createRoom(row: typeof rooms.$inferInsert) {
    const [created] = await this.db.insert(rooms).values(row).returning()
    return created!
  }

  async updateRoom(roomId: string, patch: Partial<typeof rooms.$inferInsert>) {
    const [row] = await this.db
      .update(rooms)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(rooms.id, roomId))
      .returning()
    return row ?? null
  }

  /**
   * Moves a room's unit count into the calendar (rule #25).
   *
   * Three things make this more than an UPDATE:
   *
   *  - FUTURE dates only. Yesterday's inventory is a record of what was sold,
   *    not a setting.
   *  - A date that already holds more bookings than the new count is left
   *    alone. `room_inventory_no_overbooking` would refuse it anyway, and
   *    rightly — a room that is booked cannot be un-sold.
   *  - Failing the WHOLE change because one date is full would leave a
   *    property unable to reduce its stock for a year over a single sold-out
   *    night. So it applies what it can and names what it could not.
   */
  async applyUnitsToCalendar(input: { roomId: string; units: number; today: string }) {
    const updated = await this.db.execute<{ date: string }>(sql`
      UPDATE ${roomInventory}
      SET total_units = ${input.units},
          sellable_units = ${input.units},
          updated_at = now()
      WHERE room_id = ${input.roomId}
        AND date >= ${input.today}::date
        AND booked_units <= ${input.units}
        AND sellable_units <> ${input.units}
      RETURNING date
    `)

    const blocked = await this.db.execute<{ date: string }>(sql`
      SELECT date FROM ${roomInventory}
      WHERE room_id = ${input.roomId}
        AND date >= ${input.today}::date
        AND booked_units > ${input.units}
      ORDER BY date ASC
      LIMIT 100
    `)

    return {
      applied: updated.rows.length,
      blocked: blocked.rows.map((r) => String(r.date).slice(0, 10)),
    }
  }

  async createRatePlan(row: typeof ratePlans.$inferInsert) {
    const [created] = await this.db.insert(ratePlans).values(row).returning()
    return created!
  }

  async updateRatePlan(ratePlanId: string, patch: Partial<typeof ratePlans.$inferInsert>) {
    const [row] = await this.db
      .update(ratePlans)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(ratePlans.id, ratePlanId))
      .returning()
    return row ?? null
  }

  /* ------------------------------------------------ per-guest pricing -- */

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
   * Replaces the whole matrix in one transaction.
   *
   * Delete-then-insert rather than a per-row upsert, because the request is a
   * PUT of the complete grid: a level the partner removed has to disappear,
   * and an upsert leaves it behind. Inside a transaction so the plan is never
   * momentarily priced by half a matrix.
   */
  async replaceOccupancyPrices(input: {
    ratePlanId: string
    prices: readonly { guests: number; price: number }[]
  }) {
    return this.db.transaction(async (tx) => {
      await tx
        .delete(ratePlanOccupancyPrices)
        .where(eq(ratePlanOccupancyPrices.ratePlanId, input.ratePlanId))

      if (input.prices.length === 0) return []

      return tx
        .insert(ratePlanOccupancyPrices)
        .values(
          input.prices.map((row) => ({
            ratePlanId: input.ratePlanId,
            guests: row.guests,
            price: row.price,
          }))
        )
        .returning({
          guests: ratePlanOccupancyPrices.guests,
          price: ratePlanOccupancyPrices.price,
        })
    })
  }

  /**
   * Clears the room's current default before a new one takes the slot.
   *
   * `rate_plans_one_default` allows exactly one, so without this the second
   * plan's insert simply fails and the partner is shown a constraint name.
   * Setting a default is a two-step operation and belongs in one transaction.
   */
  async clearDefault(roomId: string, exceptId?: string) {
    const where = [eq(ratePlans.roomId, roomId), eq(ratePlans.isDefault, true)]
    if (exceptId) where.push(ne(ratePlans.id, exceptId))

    await this.db
      .update(ratePlans)
      .set({ isDefault: false, updatedAt: new Date().toISOString() })
      .where(and(...where))
  }

  /* ------------------------------------------------------------ value-adds */

  /** Every extra a property offers, retired ones included — the owner's view. */
  async listValueAdds(propertyId: string) {
    return this.db
      .select()
      .from(valueAdds)
      .where(eq(valueAdds.propertyId, propertyId))
      .orderBy(asc(valueAdds.name))
  }

  /** An extra, scoped through its property to the org that owns it (API1). */
  async findValueAddForOrg(input: { valueAddId: string; orgId: string; propertyIds: string[] }) {
    const scope = [eq(valueAdds.id, input.valueAddId), eq(properties.partnerOrgId, input.orgId)]
    if (input.propertyIds.length > 0) scope.push(inArray(properties.id, input.propertyIds))

    const [row] = await this.db
      .select({ valueAdd: valueAdds, propertyId: properties.id })
      .from(valueAdds)
      .innerJoin(properties, eq(properties.id, valueAdds.propertyId))
      .where(and(...scope))
      .limit(1)
    return row ?? null
  }

  async createValueAdd(row: typeof valueAdds.$inferInsert) {
    const [created] = await this.db.insert(valueAdds).values(row).returning()
    return created!
  }

  async updateValueAdd(valueAddId: string, patch: Partial<typeof valueAdds.$inferInsert>) {
    const [row] = await this.db
      .update(valueAdds)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(valueAdds.id, valueAddId))
      .returning()
    return row ?? null
  }

  /**
   * Archiving a room retires its rate plans with it.
   *
   * A live rate plan on a room nobody can book is a price the search still
   * reads and the quote engine still honours.
   */
  async archiveRatePlansOf(roomId: string) {
    await this.db
      .update(ratePlans)
      .set({ status: "archived", isDefault: false, updatedAt: new Date().toISOString() })
      .where(and(eq(ratePlans.roomId, roomId), ne(ratePlans.status, "archived")))
  }
}
