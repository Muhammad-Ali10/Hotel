import type { PropertyDetail, PropertyListItem } from "@stayora/shared"

import type { Hotel, HotelRating, Photo, PropertyType, Room } from "@/types"

/* ============================================================================
 * The seam between the API's types and the UI's.
 *
 * `AGENTS.md` names the real problem: three diverged type systems for the same
 * concepts. The backend is now the source of truth for all of them, and the
 * end state is that the UI reads `@stayora/shared` directly — but that is a
 * refactor across every screen, and doing it before a single page has ever
 * called the API would be rewriting the UI against a wire nobody has tested.
 *
 * So: ONE adapter, in one file, translating in one direction. It is a seam
 * with a purpose, not a permanent translation layer — every field mapped here
 * is a field the UI will eventually read straight from the contract, and the
 * gaps below are the list of what has to move.
 * ========================================================================== */

/**
 * `PropertyDetail` from the API, in the shape the detail screens expect.
 *
 * Money passes through untouched: both sides speak CENTS, and the only
 * formatting happens in `lib/format`. A conversion here would be the beginning
 * of two answers to what a room costs.
 */
export function toHotel(detail: PropertyDetail): Hotel {
  const rooms = detail.rooms.map(toRoom)

  return {
    // The SLUG, not the UUID — every `/hotels/[id]` link in the UI is really a
    // slug, and the API's ids are deliberately not URL material.
    id: detail.slug,
    name: detail.name,
    city: detail.city,
    country: detail.country,
    address: detail.address,
    type: detail.type as PropertyType,
    /*
     * The cheapest room, computed here rather than trusted from the API's
     * `basePrice`. That column is a denormalised cache the partner cannot
     * write; recomputing from the rooms actually on the page means the "from"
     * price and the room list can never disagree in front of a guest.
     */
    pricePerNight: rooms.length > 0 ? Math.min(...rooms.map((r) => r.pricePerNight)) : 0,
    amenities: detail.amenities.map((a) => a.label),
    description: detail.description,
    rooms,
    policies: {
      checkInTime: detail.policies.checkInTime,
      checkOutTime: detail.policies.checkOutTime,
      /*
       * Generated from the policy by the API (rule #1) and never stored, so
       * what the guest reads and what `refundFor` enforces cannot drift. Taken
       * from the default rate plan, which is the one the reserve card opens on.
       */
      cancellation: defaultCancellationText(detail),
      payment: detail.policies.payment,
      pets: detail.policies.pets,
      smoking: detail.policies.smoking,
      children: detail.policies.children,
    },
    // Tax was removed from the product entirely (rule #11). The field survives
    // in the UI type and is always empty; it goes when the types unify.
    taxLines: [],
    valueAdds: detail.valueAdds.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category,
      description: v.description,
      price: v.price,
      unit: v.unit,
      /*
       * Always true. The API only ever returns value-adds a guest can actually
       * buy — an inactive one is filtered out server-side rather than sent
       * along with a flag the UI has to remember to check.
       */
      active: true,
    })),
    photos: detail.photos.map(toPhoto),
    /*
     * Empty on purpose.
     *
     * The UI's `Availability` was a client-side stand-in: closed dates, a
     * min-stay and rate overrides, all so the dummy build could grey out a
     * calendar. Availability is now a server question — `GET
     * /properties/:slug/availability` — and answering it from a stale copy
     * baked into the page is exactly how a guest gets offered a room that was
     * taken an hour ago.
     */
    availability: { closedDates: [], minStay: 1, rateOverrides: {} },
    seed: detail.seed,
  }
}

/** A search result, for the cards on the browse page. */
export function toHotelCard(item: PropertyListItem): Pick<
  Hotel,
  "id" | "name" | "city" | "country" | "type" | "pricePerNight" | "amenities" | "seed"
> & { rating: HotelRating; stars: number | null } {
  return {
    id: item.slug,
    name: item.name,
    city: item.city,
    country: item.country,
    type: item.type as PropertyType,
    pricePerNight: item.fromPrice,
    amenities: item.amenities,
    seed: item.seed,
    rating: item.rating,
    stars: item.stars,
  }
}

/* ------------------------------------------------------------------ local */

/**
 * A room, flattened from the API's room-plus-rate-plans shape.
 *
 * The UI's `Room` has ONE price. The API has a room with several rate plans,
 * each its own price and its own cancellation terms — which is the more
 * truthful model and the one the reserve card now works from directly. The
 * cheapest plan is used here so a room card can show a "from".
 */
function toRoom(room: PropertyDetail["rooms"][number]): Room {
  const prices = room.ratePlans.map((plan) => plan.basePrice)
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    guests: room.maxOccupancy,
    bed: room.bed,
    size: room.size,
    features: room.features,
    pricePerNight: prices.length > 0 ? Math.min(...prices) : 0,
    units: room.units,
    seed: room.seed,
  }
}

function toPhoto(photo: PropertyDetail["photos"][number]): Photo {
  return {
    id: photo.id,
    category: photo.category as Photo["category"],
    caption: photo.caption,
    seed: photo.seed,
  }
}

function defaultCancellationText(detail: PropertyDetail): string {
  for (const room of detail.rooms) {
    const plan = room.ratePlans.find((p) => p.isDefault) ?? room.ratePlans[0]
    if (plan) return plan.cancellationText
  }
  return ""
}
