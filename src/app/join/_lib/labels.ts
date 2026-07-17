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

/** Format a whole-rupee amount as "PKR 12,345" / "Rs 12,345". */
export function pkr(amount: number, symbol: "PKR" | "Rs" = "Rs") {
  return `${symbol} ${new Intl.NumberFormat("en-US").format(Math.round(amount))}`
}
