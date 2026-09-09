import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import {
  nextStatusFor,
  toISODate,
  type ISODate,
  type PromotionCreateInput,
  type PromotionUpdateInput,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { PromotionsRepository, type PromotionRow } from "./promotions.repository"

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name)

  constructor(private readonly repo: PromotionsRepository) {}

  /* -------------------------------------------------------------- partner */

  async listForPartner(user: AuthenticatedUser, query: { status?: string; limit: number }) {
    const rows = await this.repo.listForOrg({ orgId: this.orgOf(user), ...query })
    return Promise.all(rows.map((row) => this.withScope(row)))
  }

  async detailForPartner(promotionId: string, user: AuthenticatedUser) {
    const row = await this.ownedPromotion(promotionId, user)
    return this.withScope(row)
  }

  async createForPartner(input: { body: PromotionCreateInput; user: AuthenticatedUser }) {
    const orgId = this.orgOf(input.user)
    this.assertRole(input.user, ["admin", "manager"])

    const scope = await this.resolveScope(input.body.propertyIds, input.body.roomIds, input.user)

    const created = await this.repo.create({
      row: {
        partnerOrgId: orgId,
        name: input.body.name,
        kind: input.body.kind,
        discountType: input.body.discountType,
        discountValue: input.body.discountValue,
        startDate: input.body.startDate,
        endDate: input.body.endDate,
        minStay: input.body.minStay,
        channel: input.body.channel,
        status: input.body.status,
      },
      ...scope,
    })

    return this.withScope(created)
  }

  async updateForPartner(input: {
    promotionId: string
    body: PromotionUpdateInput
    user: AuthenticatedUser
  }) {
    this.assertRole(input.user, ["admin", "manager"])
    const existing = await this.ownedPromotion(input.promotionId, input.user)

    const { propertyIds, roomIds, ...patch } = input.body

    /*
     * Re-checked on every scope change, not just on create.
     *
     * A promotion created against one's own hotels and then edited to name a
     * competitor's would otherwise walk straight through — the ownership check
     * has to sit on the write, not on the first write.
     */
    const scope =
      propertyIds !== undefined || roomIds !== undefined
        ? await this.resolveScope(
            propertyIds ?? (await this.repo.scopeOf(existing.id)).propertyIds,
            roomIds ?? [],
            input.user
          )
        : null

    const updated = await this.repo.update({
      promotionId: input.promotionId,
      patch,
      ...(propertyIds !== undefined ? { propertyIds: scope!.propertyIds } : {}),
      ...(roomIds !== undefined ? { roomIds: scope!.roomIds } : {}),
    })
    if (!updated) throw new NotFoundException("Promotion not found")

    return this.withScope(updated)
  }

  /* ---------------------------------------------------------------- admin */

  async listAll(query: { status?: string; limit: number }) {
    const rows = await this.repo.listAll(query)
    return Promise.all(rows.map((row) => this.withScope(row)))
  }

  async detailForAdmin(promotionId: string) {
    const row = await this.repo.findById(promotionId)
    if (!row) throw new NotFoundException("Promotion not found")
    return this.withScope(row)
  }

  /* ------------------------------------------------------------ lifecycle */

  /**
   * Moves promotions through their states (rule #3's precondition).
   *
   * `isApplicable` insists on exactly `active` and refuses to infer it from
   * the window — so a `scheduled` promotion whose window opened this morning
   * is offered to nobody until something moves it. Nothing did.
   */
  async sweepStatuses(today: ISODate = toISODate(new Date())) {
    const due = await this.repo.dueForStatusChange(today, 500)

    let activated = 0
    let ended = 0

    for (const promotion of due) {
      const next = nextStatusFor(promotion as never, today)
      if (!next) continue

      const moved = await this.repo.advanceStatus({
        promotionId: promotion.id,
        fromStatus: promotion.status,
        toStatus: next,
      })
      if (!moved) continue

      if (next === "active") activated++
      if (next === "ended") ended++
    }

    if (activated > 0 || ended > 0) {
      this.logger.log(`Promotions swept: ${activated} activated, ${ended} ended`)
    }
    return { activated, ended, examined: due.length }
  }

  /* ----------------------------------------------------------------- authz */

  /**
   * Turns the ids a caller sent into the ones they may actually use.
   *
   * Refuses the whole request on any difference rather than quietly dropping
   * what is not theirs: a partner who names five hotels and gets a promotion
   * on three has been told something false about what they published.
   *
   * The message names no id, so a probe learns nothing about which existed.
   */
  private async resolveScope(
    propertyIds: string[],
    roomIds: string[],
    user: AuthenticatedUser
  ): Promise<{ propertyIds: string[]; roomIds: string[] }> {
    if (propertyIds.length === 0) {
      throw new BadRequestException("A promotion has to cover at least one property")
    }

    const owned = await this.repo.ownedPropertyIds({
      propertyIds,
      orgId: this.orgOf(user),
      scoped: user.partner!.propertyIds,
    })
    if (owned.length !== new Set(propertyIds).size) {
      throw new NotFoundException("One of those properties was not found")
    }

    if (roomIds.length === 0) return { propertyIds: owned, roomIds: [] }

    // A room outside the listed properties would target a discount at a hotel
    // the promotion does not even cover.
    const within = await this.repo.roomIdsWithin(roomIds, owned)
    if (within.length !== new Set(roomIds).size) {
      throw new NotFoundException("One of those rooms was not found")
    }

    return { propertyIds: owned, roomIds: within }
  }

  private orgOf(user: AuthenticatedUser): string {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    return user.partner.orgId
  }

  private assertRole(user: AuthenticatedUser, allowed: ("admin" | "manager" | "staff")[]) {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    if (!allowed.includes(user.partner.role)) {
      throw new ForbiddenException("Your role cannot manage promotions")
    }
  }

  /** 404, never 403 — a 403 would confirm the promotion id is real (API1). */
  private async ownedPromotion(promotionId: string, user: AuthenticatedUser) {
    const row = await this.repo.findForOrg(promotionId, this.orgOf(user))
    if (!row) throw new NotFoundException("Promotion not found")
    return row
  }

  private async withScope(row: PromotionRow) {
    const scope = await this.repo.scopeOf(row.id)
    return { ...toDto(row), ...scope }
  }
}

/** Explicit fields — a column added later cannot leak into a response (API3). */
function toDto(row: PromotionRow) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    discountType: row.discountType,
    discountValue: row.discountValue,
    startDate: row.startDate,
    endDate: row.endDate,
    minStay: row.minStay,
    channel: row.channel,
    status: row.status,
    createdAt: row.createdAt,
  }
}
