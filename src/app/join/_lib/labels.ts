import { formatCurrency } from "@/lib/format"

import type { PropertyType } from "./types"

export const propertyTypeLabels: Record<PropertyType, string> = {
  hotel: "Hotel",
  resort: "Resort",
  guesthouse: "Guesthouse",
  hostel: "Hostel",
  apartment: "Apartment",
  villa: "Villa",
  bnb: "Bed & Breakfast",
  motel: "Motel",
}

/**
 * Money in the registration flow.
 *
 * This flow used to price in rupees while the catalogue, checkout, extranet and
 * admin panel all priced in USD — a partner set a rate here and saw a different
 * currency the moment they reached the extranet. It now goes through the same
 * platform formatter as every other surface.
 */
export function money(amount: number) {
  return formatCurrency(Math.round(amount))
}
