import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { emptyRating, FAVORITES_LIMIT, type FavoriteItem } from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { ReviewsService } from "../reviews/reviews.service"
import { CatalogRepository } from "./catalog.repository"
import { FavoritesRepository } from "./favorites.repository"

/**
 * The saved list (Module 14).
 *
 * Small on purpose. The only two decisions in it are which properties may be
 * saved, and what happens to a save when the property stops being bookable.
 */
@Injectable()
export class FavoritesService {
  constructor(
    private readonly repo: FavoritesRepository,
    private readonly catalog: CatalogRepository,
    private readonly reviews: ReviewsService
  ) {}

  async list(user: AuthenticatedUser, query: { limit: number; before?: string }) {
    const { rows, nextCursor } = await this.repo.list({ userId: user.id, ...query })
    const ids = rows.map((r) => r.property.id)

    // Two queries for the page, not two per card — same shape the search uses.
    const [amenityMap, ratings] = await Promise.all([
      this.catalog.amenitySlugsFor(ids),
      this.reviews.ratingsFor(ids),
    ])

    const items: FavoriteItem[] = rows.map(({ savedAt, property }) => ({
      id: property.id,
      slug: property.slug,
      name: property.name,
      city: property.city,
      country: property.country,
      type: property.type as FavoriteItem["type"],
      stars: property.stars,
      fromPrice: property.basePrice,
      amenities: amenityMap.get(property.id) ?? [],
      rating: ratings.get(property.id) ?? emptyRating(),
      seed: property.seed,
      savedAt,
      /*
       * A property suspended after it was saved stays in the list and says so.
       *
       * Dropping it makes the list shrink with no explanation; leaving it
       * looking bookable sends the guest to a page that will not sell them
       * anything. Neither is a kindness.
       */
      available: property.status === "active",
    }))

    return { items, nextCursor }
  }

  /**
   * Saving one.
   *
   * Only an `active` property can be saved, and a draft or suspended one is a
   * 404 rather than a 403 (API1): a partner's unpublished listing should not
   * be confirmable by anybody who can guess its id.
   */
  async save(user: AuthenticatedUser, propertyId: string) {
    const property = await this.catalog.findPublicById(propertyId)
    if (!property) throw new NotFoundException("Property not found")

    /*
     * The count is checked BEFORE the insert and only charged when the insert
     * actually created a row. Re-saving something already on the list must not
     * fail at the limit — the list is not growing.
     */
    const current = await this.repo.count(user.id)
    if (current >= FAVORITES_LIMIT) {
      const already = await this.repo.savedAmong({ userId: user.id, propertyIds: [propertyId] })
      if (!already.has(propertyId)) {
        throw new BadRequestException(
          `You can save up to ${FAVORITES_LIMIT} properties. Remove one to save another.`
        )
      }
    }

    const added = await this.repo.add({ userId: user.id, propertyId })
    return { saved: true, added }
  }

  /**
   * Removing one.
   *
   * Returns `saved: false` either way. "Remove what is not there" is the state
   * the caller asked for, and an error would make the heart on a stale page
   * fail for somebody who is already looking at the right answer.
   */
  async remove(user: AuthenticatedUser, propertyId: string) {
    const removed = await this.repo.remove({ userId: user.id, propertyId })
    return { saved: false, removed }
  }

  /** Which of a set are saved — for drawing hearts on a search page. */
  async savedAmong(user: AuthenticatedUser, propertyIds: string[]) {
    const set = await this.repo.savedAmong({ userId: user.id, propertyIds })
    return { saved: [...set] }
  }
}
