import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import {
  emptyRating,
  policyFromColumns,
  policyText,
  type PropertyDetail,
  type PropertyListItem,
  type PropertySearchInput,
  type PropertyUpdateInput,
  type RatePlanSummary,
  type RoomDetail,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { AnalyticsEventsService } from "../analytics/analytics-events.service"
import { ReviewsService } from "../reviews/reviews.service"
import { CatalogRepository, type PropertyRow } from "./catalog.repository"

/**
 * Who was searching, taken from the request.
 *
 * Deliberately thin (rule #68): an opaque session id the client generates and
 * rotates, the surface it came from, and a user id only when they happened to
 * be signed in. No IP address and no user agent — "how much demand is there
 * for this city" is answerable without identifying anybody, and a column that
 * does not exist cannot leak.
 */
export type SearchContext = {
  sessionId?: string | null
  surface?: string | null
  userId?: string | null
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly reviews: ReviewsService,
    private readonly events: AnalyticsEventsService
  ) {}

  /* ---------------------------------------------------------------- public */

  /**
   * The public search.
   *
   * `context` carries who was looking, from the request — never from the query
   * string. It is optional so every existing caller keeps working and a search
   * without it simply goes unrecorded rather than failing.
   */
  /** Where the marketplace has supply, with real counts. */
  /** What the public pages may state as fact (rule #113). */
  platformStats() {
    return this.repo.platformStats()
  }

  destinations(limit: number) {
    return this.repo.destinations(limit)
  }

  async search(input: PropertySearchInput, context?: SearchContext) {
    const { rows, nextCursor } = await this.repo.search(input)
    const ids = rows.map((r) => r.id)
    // Two extra queries for the whole page, not two per card.
    const [amenityMap, ratings] = await Promise.all([
      this.repo.amenitySlugsFor(ids),
      this.reviews.ratingsFor(ids),
    ])

    const items: PropertyListItem[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      city: row.city,
      country: row.country,
      type: row.type as PropertyListItem["type"],
      stars: row.stars,
      fromPrice: row.basePrice,
      amenities: amenityMap.get(row.id) ?? [],
      rating: ratings.get(row.id) ?? emptyRating(),
      seed: row.seed,
    }))

    /*
     * Recorded for the Demand and Ranking screens (rule #67), which do not
     * exist yet — and that is exactly why this is here now. Analytics never
     * backfills: a table filled from the day its screen ships has nothing to
     * say about last season, which is the first thing a partner asks.
     *
     * `recordSearch` swallows its own failures and returns `null`, so nothing
     * below can stop a guest from seeing hotels.
     */
    const searchId = await this.events.recordSearch({
      destination: input.city ?? input.country ?? "",
      /*
       * No dates and no party size: the public search does not take them yet.
       * The columns are nullable and waiting — "demand for Lahore in December"
       * needs the dates, and the day the search filter gains them the events
       * start carrying them with no migration.
       */
      resultCount: items.length,
      surface: context?.surface ?? null,
      sessionId: context?.sessionId ?? null,
      userId: context?.userId ?? null,
      propertyIds: ids,
    })

    return { items, nextCursor, searchId }
  }

  async detailBySlug(slug: string): Promise<PropertyDetail> {
    const property = await this.repo.findPublicBySlug(slug)
    if (!property) throw new NotFoundException("Property not found")

    const [amenityRows, roomRows, photoRows, valueAddRows, rating] = await Promise.all([
      this.repo.amenitiesFor(property.id),
      this.repo.roomsWithRatePlans(property.id),
      this.repo.photosFor(property.id),
      this.repo.valueAddsFor(property.id),
      this.reviews.ratingFor(property.id),
    ])

    // The join returns one row per room × rate plan; fold it back into rooms.
    const roomsById = new Map<string, RoomDetail>()
    for (const { room, ratePlan } of roomRows) {
      let entry = roomsById.get(room.id)
      if (!entry) {
        entry = {
          id: room.id,
          name: room.name,
          description: room.description,
          maxAdults: room.maxAdults,
          maxChildren: room.maxChildren,
          maxOccupancy: room.maxOccupancy,
          bed: room.bed,
          size: room.size,
          features: room.features,
          units: room.units,
          seed: room.seed,
          ratePlans: [],
        }
        roomsById.set(room.id, entry)
      }
      if (ratePlan) entry.ratePlans.push(toRatePlanSummary(ratePlan))
    }

    return {
      id: property.id,
      slug: property.slug,
      name: property.name,
      city: property.city,
      country: property.country,
      address: property.address,
      timezone: property.timezone,
      type: property.type as PropertyDetail["type"],
      stars: property.stars,
      description: property.description,
      fromPrice: property.basePrice,
      amenities: amenityRows,
      policies: {
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
        payment: property.policyPayment,
        pets: property.policyPets,
        smoking: property.policySmoking,
        children: property.policyChildren,
      },
      rooms: [...roomsById.values()],
      photos: photoRows.map((p) => ({
        id: p.id,
        category: p.category,
        caption: p.caption,
        seed: p.seed,
      })),
      rating,
      valueAdds: valueAddRows.map((v) => ({
        id: v.id,
        name: v.name,
        category: v.category,
        description: v.description,
        price: v.price,
        unit: v.unit as PropertyDetail["valueAdds"][number]["unit"],
      })),
      seed: property.seed,
    }
  }

  /* --------------------------------------------------------------- partner */

  async listForPartner(user: AuthenticatedUser) {
    const scope = partnerScope(user)
    const rows = await this.repo.listForPartner(scope)
    return rows.map((row) => ({
      ...toPartnerSummary(row.property),
      rooms: row.rooms,
      roomTypes: row.roomTypes,
    }))
  }

  async updateForPartner(propertyId: string, patch: PropertyUpdateInput, user: AuthenticatedUser) {
    const scope = partnerScope(user)

    // Scoped lookup: another org's property is NOT FOUND, never forbidden —
    // a 403 would confirm the id exists (API1).
    const existing = await this.repo.findForPartner({ propertyId, ...scope })
    if (!existing) throw new NotFoundException("Property not found")

    // `staff` may work the front desk, not rewrite the listing (rule #14).
    if (user.partner!.role === "staff") {
      throw new ForbiddenException("Your role cannot change property details")
    }

    const { amenities: amenitySlugs, ...columns } = patch

    if (amenitySlugs) {
      const found = await this.repo.findAmenityIdsBySlug(amenitySlugs)
      const missing = amenitySlugs.filter((slug) => !found.some((a) => a.slug === slug))
      if (missing.length > 0) {
        // The vocabulary is platform-managed (rule #31): a partner cannot
        // invent an amenity by naming one, because an unknown slug would then
        // be a filter nothing can ever match.
        throw new BadRequestException(`Unknown amenities: ${missing.join(", ")}`)
      }
      await this.repo.replaceAmenities(propertyId, found.map((a) => a.id))
    }

    const updated =
      Object.keys(columns).length > 0
        ? await this.repo.updateProperty(propertyId, columns)
        : existing

    return toPartnerSummary(updated ?? existing)
  }
}

/**
 * The caller's org and property scope.
 *
 * Throws rather than returning something permissive: a partner route reached
 * without a membership is a wiring mistake, and the safe reading of a wiring
 * mistake is "no access".
 */
function partnerScope(user: AuthenticatedUser): { orgId: string; propertyIds: string[] } {
  if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
  return { orgId: user.partner.orgId, propertyIds: user.partner.propertyIds }
}

function toRatePlanSummary(plan: {
  id: string
  name: string
  basePrice: number
  cancelFreeUntil: string
  cancelCharge: string
  cancelChargeValue: number | null
  noShowCharge: string | null
  noShowChargeValue: number | null
  inclusions: string[]
  defaultMinStay: number
  isDefault: boolean
  paymentMode: string
}): RatePlanSummary {
  const cancellation = policyFromColumns(plan)
  return {
    id: plan.id,
    name: plan.name,
    basePrice: plan.basePrice,
    cancellation,
    // Generated, never stored — so what the guest reads and what `refundFor`
    // enforces cannot drift apart (rule #1).
    cancellationText: policyText(cancellation),
    inclusions: plan.inclusions,
    minStay: plan.defaultMinStay,
    isDefault: plan.isDefault,
    /*
     * Whether the card is CHARGED today or only held (rule #42).
     *
     * Absent until the frontend asked for it, which meant a guest chose
     * between "Flexible" and "Non-refundable" with no way to tell that one of
     * them takes the money now. The rate plan decides this and the client
     * cannot override it — but the guest has every right to be told before
     * they pick.
     */
    paymentMode: plan.paymentMode as RatePlanSummary["paymentMode"],
  }
}

/** Explicit fields, so a new column cannot appear in a response by accident. */
function toPartnerSummary(row: PropertyRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    country: row.country,
    type: row.type,
    stars: row.stars,
    status: row.status,
    verification: row.verification,
    fromPrice: row.basePrice,
    timezone: row.timezone,
    // The descriptions screen lists every property side by side; without this
    // it would have to fetch each listing in turn to render one paragraph.
    description: row.description,
  }
}
