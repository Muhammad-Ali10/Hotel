import type { Property } from "@/lib/extranet/types"

/**
 * The partner's portfolio — "Aurora Hospitality", 5 properties.
 * Room counts sum to 604; today's revenue sums to $21,872 (matches the
 * Properties + Dashboard KPI tiles).
 */
export const properties: Property[] = [
  {
    id: "grand-horizon",
    name: "Grand Horizon",
    city: "Malibu, CA",
    country: "United States",
    rooms: 142,
    occupancy: 78,
    adr: 298,
    revenueToday: 4862,
    rating: 5,
    status: "Active",
    seed: "grand-horizon",
  },
  {
    id: "the-metropolitan",
    name: "The Metropolitan",
    city: "Chicago, IL",
    country: "United States",
    rooms: 215,
    occupancy: 85,
    adr: 541,
    revenueToday: 3850,
    rating: 5,
    status: "Active",
    seed: "the-metropolitan",
  },
  {
    id: "alpine-lodge",
    name: "Alpine Lodge Zermatt",
    city: "Zermatt",
    country: "Switzerland",
    rooms: 89,
    occupancy: 62,
    adr: 541,
    revenueToday: 6720,
    rating: 5,
    status: "Active",
    seed: "alpine-lodge-zermatt",
  },
  {
    id: "casa-del-mar",
    name: "Casa del Mar",
    city: "Tulum",
    country: "Mexico",
    rooms: 64,
    occupancy: 58,
    adr: 189.5,
    revenueToday: 1690,
    rating: 5,
    status: "Active",
    seed: "casa-del-mar",
  },
  {
    id: "sakura-ryokan",
    name: "Sakura Ryokan",
    city: "Kyoto",
    country: "Japan",
    rooms: 94,
    occupancy: 71,
    adr: 354,
    revenueToday: 4750,
    rating: 5,
    status: "Active",
    seed: "sakura-ryokan",
  },
]

/** The property currently in focus in the top-bar switcher. */
export const activeProperty = properties[0]

export const portfolioStats = {
  totalProperties: properties.length,
  totalRooms: properties.reduce((sum, p) => sum + p.rooms, 0),
  todaysBookings: 52,
  todaysRevenue: properties.reduce((sum, p) => sum + p.revenueToday, 0),
  occupancy: 78,
  adr: 412.5,
}
