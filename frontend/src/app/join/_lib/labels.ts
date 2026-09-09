import type { PropertyType } from "@stayora/shared"

import { formatCurrency } from "@/lib/format"

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
 * Money in the registration flow. Takes CENTS.
 *
 * This flow used to price in rupees while the catalogue, checkout, extranet and
 * admin panel all priced in USD — a partner set a rate here and saw a different
 * currency the moment they reached the extranet. It now goes through the same
 * platform formatter as every other surface.
 *
 * And it takes cents, like every other price in the system. It used to take
 * whole units and the draft stores cents, so a rate saved as `550` was read
 * back as $5.50 — a hundredfold error sitting between two screens of the same
 * form.
 */
export function money(cents: number) {
  return formatCurrency(cents)
}
