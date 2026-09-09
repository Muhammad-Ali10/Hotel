import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import {
  RATE_PLAN_TERMS_FIELDS,
  occupancyGrid,
  policyFromColumns,
  policyText,
  toISODate,
  type OccupancyPricesInput,
  type RatePlanCreateInput,
  type RatePlanUpdateInput,
  type RoomCreateInput,
  type RoomUpdateInput,
  type ValueAddCreateInput,
  type ValueAddUpdateInput,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { CatalogRepository } from "./catalog.repository"
import { RatePlanRow, RoomRow, RoomsRepository } from "./rooms.repository"
import type { valueAdds } from "../../db/schema"

/**
 * Rooms and rate plans — the write side of Module 2.
 *
 * Two levels of authority, and the split is not arbitrary:
 *
 *  - a MANAGER runs the rooms and the prices. Revenue management is a daily
 *    job and making it need the org's owner would stop it happening.
 *  - only an ORG ADMIN changes the cancellation terms, the no-show terms or
 *    the payment mode. Those are not prices, they are promises — rules #1, #42
 *    and #47 — and every one of them is enforceable against a guest's card.
 */
@Injectable()
export class RoomsService {
  constructor(
    private readonly repo: RoomsRepository,
    private readonly catalog: CatalogRepository
  ) {}

  /* ----------------------------------------------------------------- rooms */

  async listRooms(propertyId: string, user: AuthenticatedUser) {
    await this.assertOwnsProperty(propertyId, user)
    const rows = await this.repo.listRooms(propertyId)
    return rows.map((row) => ({
      ...toRoomDto(row.room),
      /** The default rate plan's nightly price — a room has none of its own. */
      basePrice: row.basePrice,
      defaultRatePlanId: row.defaultRatePlanId,
      ratePlans: row.ratePlans,
    }))
  }

  async createRoom(input: { propertyId: string; body: RoomCreateInput; user: AuthenticatedUser }) {
    this.assertRole(input.user, ["admin", "manager"])
    await this.assertOwnsProperty(input.propertyId, input.user)

    const room = await this.repo.createRoom({ ...input.body, propertyId: input.propertyId })
    return toRoomDto(room)
  }

  async updateRoom(input: { roomId: string; body: RoomUpdateInput; user: AuthenticatedUser }) {
    this.assertRole(input.user, ["admin", "manager"])
    const found = await this.ownedRoom(input.roomId, input.user)

    const updated = await this.repo.updateRoom(input.roomId, input.body)
    if (!updated) throw new NotFoundException("Room not found")

    /*
     * The calendar follows the room, and the property's headline price
     * follows both.
     *
     * Neither is optional bookkeeping: an unchanged calendar keeps selling the
     * old number of rooms, and a stale `basePrice` puts a hotel in a search
     * band it can no longer honour.
     */
    const units =
      input.body.units !== undefined && input.body.units !== found.room.units
        ? await this.repo.applyUnitsToCalendar({
            roomId: input.roomId,
            units: input.body.units,
            today: toISODate(new Date()),
          })
        : null

    if (input.body.status === "archived") {
      // A live rate plan on a room nobody can book is a price the search still
      // reads and the quote engine still honours.
      await this.repo.archiveRatePlansOf(input.roomId)
    }

    if (input.body.units !== undefined || input.body.status !== undefined) {
      await this.catalog.recomputeBasePrice(found.propertyId)
    }

    return { room: toRoomDto(updated), units }
  }

  /* ------------------------------------------------------------ rate plans */

  async listRatePlans(roomId: string, user: AuthenticatedUser) {
    await this.ownedRoom(roomId, user)
    const rows = await this.repo.listRatePlans(roomId)
    return rows.map(toRatePlanDto)
  }

  /** Every plan across the property's rooms, each carrying its room. */
  async listRatePlansForProperty(propertyId: string, user: AuthenticatedUser) {
    await this.assertOwnsProperty(propertyId, user)
    const rows = await this.repo.listRatePlansForProperty(propertyId)
    return rows.map((row) => ({
      ...toRatePlanDto(row.plan),
      roomName: row.roomName,
      roomUnits: row.roomUnits,
      roomStatus: row.roomStatus,
    }))
  }

  async createRatePlan(input: {
    roomId: string
    body: RatePlanCreateInput
    user: AuthenticatedUser
  }) {
    // Creating a plan MEANS setting its terms, so it needs the higher bar
    // whatever the values happen to be.
    this.assertRole(input.user, ["admin"])
    const found = await this.ownedRoom(input.roomId, input.user)

    if (input.body.isDefault) await this.repo.clearDefault(input.roomId)

    const created = await this.repo.createRatePlan({ ...input.body, roomId: input.roomId })
    await this.catalog.recomputeBasePrice(found.propertyId)
    return toRatePlanDto(created)
  }

  /* --------------------------------------------- per-guest pricing (#101) */

  /**
   * What this plan charges at each party size.
   *
   * Every level up to the room's capacity, not only the ones the partner set —
   * a grid that starts empty gives nothing to edit, and `isSet` says which
   * numbers are theirs and which are following the base rate.
   */
  async occupancyPrices(ratePlanId: string, user: AuthenticatedUser) {
    const found = await this.findOwnedRatePlan(ratePlanId, user)
    const [matrix, room] = await Promise.all([
      this.repo.occupancyPrices(ratePlanId),
      this.repo.findRoomForOrg({
        roomId: found.roomId,
        orgId: user.partner!.orgId,
        propertyIds: user.partner!.propertyIds,
      }),
    ])

    return {
      ratePlanId,
      ratePlanName: found.ratePlan.name,
      basePrice: found.ratePlan.basePrice,
      baseOccupancy: found.ratePlan.baseOccupancy,
      maxAdults: room?.room.maxAdults ?? found.ratePlan.baseOccupancy,
      rows: occupancyGrid({
        basePrice: found.ratePlan.basePrice,
        baseOccupancy: found.ratePlan.baseOccupancy,
        maxAdults: room?.room.maxAdults ?? found.ratePlan.baseOccupancy,
        matrix,
      }),
    }
  }

  /**
   * Replacing the matrix.
   *
   * Repricing, so `manager` is enough — the same bar as changing a rate,
   * which is what this is. Changing the cancellation terms is the higher bar,
   * and nothing here touches those.
   */
  async setOccupancyPrices(input: {
    ratePlanId: string
    body: OccupancyPricesInput
    user: AuthenticatedUser
  }) {
    this.assertRole(input.user, ["admin", "manager"])
    const found = await this.findOwnedRatePlan(input.ratePlanId, input.user)

    if (input.body.baseOccupancy !== undefined) {
      await this.repo.updateRatePlan(input.ratePlanId, {
        baseOccupancy: input.body.baseOccupancy,
      })
    }
    const baseOccupancy = input.body.baseOccupancy ?? found.ratePlan.baseOccupancy

    /*
     * A matrix that prices SOMETHING but not the base occupancy is inert: a
     * difference needs two numbers, so every level would resolve to no
     * adjustment and the partner would think they had set prices that were
     * silently doing nothing.
     */
    if (
      input.body.prices.length > 0 &&
      !input.body.prices.some((row) => row.guests === baseOccupancy)
    ) {
      throw new BadRequestException(
        `Set a price for ${baseOccupancy} guests — every other level is priced relative to it`
      )
    }

    await this.repo.replaceOccupancyPrices({
      ratePlanId: input.ratePlanId,
      prices: input.body.prices,
    })

    return this.occupancyPrices(input.ratePlanId, input.user)
  }

  async updateRatePlan(input: {
    ratePlanId: string
    body: RatePlanUpdateInput
    user: AuthenticatedUser
  }) {
    this.assertRole(input.user, ["admin", "manager"])
    const found = await this.findOwnedRatePlan(input.ratePlanId, input.user)

    /*
     * A manager may reprice; only an admin may change what was promised.
     *
     * Checked against the fields actually SENT, not against what they resolve
     * to — "set `cancelCharge` to the value it already has" is still an
     * attempt to write a term, and treating it as a no-op would make the rule
     * depend on the current row rather than on who is asking.
     */
    const touchesTerms = RATE_PLAN_TERMS_FIELDS.some((field) => field in input.body)
    if (touchesTerms && input.user.partner!.role !== "admin") {
      throw new ForbiddenException(
        "Only an organisation admin can change cancellation, no-show or payment terms"
      )
    }

    if (input.body.isDefault === true) {
      await this.repo.clearDefault(found.roomId, input.ratePlanId)
    }

    const updated = await this.repo.updateRatePlan(input.ratePlanId, input.body)
    if (!updated) throw new NotFoundException("Rate plan not found")

    await this.catalog.recomputeBasePrice(found.propertyId)
    return toRatePlanDto(updated)
  }

  /* ------------------------------------------------------------ value-adds */

  async listValueAdds(propertyId: string, user: AuthenticatedUser) {
    await this.assertOwnsProperty(propertyId, user)
    const rows = await this.repo.listValueAdds(propertyId)
    return rows.map(toValueAddDto)
  }

  async createValueAdd(input: {
    propertyId: string
    body: ValueAddCreateInput
    user: AuthenticatedUser
  }) {
    // An extra is a price, not a promise — the same bar as a rate.
    this.assertRole(input.user, ["admin", "manager"])
    await this.assertOwnsProperty(input.propertyId, input.user)

    const created = await this.repo.createValueAdd({ ...input.body, propertyId: input.propertyId })
    return toValueAddDto(created)
  }

  async updateValueAdd(input: {
    valueAddId: string
    body: ValueAddUpdateInput
    user: AuthenticatedUser
  }) {
    this.assertRole(input.user, ["admin", "manager"])
    if (!input.user.partner) throw new ForbiddenException("This account is not linked to a property")

    const found = await this.repo.findValueAddForOrg({
      valueAddId: input.valueAddId,
      orgId: input.user.partner.orgId,
      propertyIds: input.user.partner.propertyIds,
    })
    if (!found) throw new NotFoundException("Extra not found")

    const updated = await this.repo.updateValueAdd(input.valueAddId, input.body)
    if (!updated) throw new NotFoundException("Extra not found")
    return toValueAddDto(updated)
  }

  /* ----------------------------------------------------------------- authz */

  private assertRole(user: AuthenticatedUser, allowed: ("admin" | "manager" | "staff")[]) {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    if (!allowed.includes(user.partner.role)) {
      throw new ForbiddenException("Your role cannot make that change")
    }
  }

  /** 404, never 403 — a 403 would confirm the id is real (API1). */
  private async assertOwnsProperty(propertyId: string, user: AuthenticatedUser) {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")

    const property = await this.catalog.findForPartner({
      propertyId,
      orgId: user.partner.orgId,
      propertyIds: user.partner.propertyIds,
    })
    if (!property) throw new NotFoundException("Property not found")
    return property
  }

  private async ownedRoom(roomId: string, user: AuthenticatedUser) {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")

    const found = await this.repo.findRoomForOrg({
      roomId,
      orgId: user.partner.orgId,
      propertyIds: user.partner.propertyIds,
    })
    if (!found) throw new NotFoundException("Room not found")
    return found
  }

  private async findOwnedRatePlan(ratePlanId: string, user: AuthenticatedUser) {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")

    const found = await this.repo.findRatePlanForOrg({
      ratePlanId,
      orgId: user.partner.orgId,
      propertyIds: user.partner.propertyIds,
    })
    if (!found) throw new NotFoundException("Rate plan not found")
    return found
  }
}

/** Explicit fields — a column added later cannot leak into a response (API3). */
function toRoomDto(row: RoomRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    maxAdults: row.maxAdults,
    maxChildren: row.maxChildren,
    maxOccupancy: row.maxOccupancy,
    bed: row.bed,
    size: row.size,
    features: row.features,
    units: row.units,
    status: row.status,
    seed: row.seed,
  }
}

function toRatePlanDto(row: RatePlanRow) {
  const cancellation = policyFromColumns(row)
  return {
    id: row.id,
    roomId: row.roomId,
    name: row.name,
    basePrice: row.basePrice,
    cancellation,
    /** Generated from the same fields the refund is computed from (rule #1). */
    cancellationText: policyText(cancellation),
    paymentMode: row.paymentMode,
    inclusions: row.inclusions,
    defaultMinStay: row.defaultMinStay,
    defaultMaxStay: row.defaultMaxStay,
    status: row.status,
    isDefault: row.isDefault,
  }
}

/** Explicit fields — a column added later cannot leak into a response (API3). */
function toValueAddDto(row: typeof valueAdds.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: row.price,
    unit: row.unit,
    active: row.active,
  }
}
