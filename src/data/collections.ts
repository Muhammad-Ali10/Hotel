import type { Hotel } from "@/types"
import { activeDiscountFor } from "@/lib/domain"
import { TODAY } from "./config"
import { hotels } from "./hotels"
import { promotions } from "./promotions"

/**
 * Home-page curation. `specialOffers` is derived from live promotions rather
 * than from a hand-written `discountLabel`, so a deal disappears from the home
 * page the moment the partner pauses it.
 */

export const topRated: Hotel[] = hotels.slice(0, 4)

export const luxuryCollection: Hotel[] = hotels.slice(6, 10)

export const specialOffers: Hotel[] = hotels
  .map((h) => {
    const discount = activeDiscountFor(h.id, promotions, TODAY)
    return discount ? { ...h, discount } : null
  })
  .filter((h) => h !== null)
