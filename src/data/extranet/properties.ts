import type { Property } from "@/lib/extranet/types"
import { PARTNER_ORG } from "@/data/config"
import { partnerHotels } from "@/data/hotels"
import { partnerBookings } from "@/data/bookings"
import { reviews as allReviews } from "@/data/reviews"
import { datesInRange, deriveRating } from "@/lib/domain"
import { TODAY } from "@/data/config"

/**
 * The partner's portfolio — derived from the real catalogue.
 *
 * Aurora used to manage five properties that existed nowhere on the public
 * site, so nothing a partner did could reach a guest. They now manage five of
 * the ten listed hotels, and the figures below are counted from the same
 * bookings and reviews every other surface reads.
 */
export const properties: Property[] = partnerHotels.map((hotel) => {
  const bookings = partnerBookings.filter(
    (b) => b.hotelId === hotel.id && b.status !== "cancelled"
  )
  const staying = bookings.filter((b) => datesInRange(b.checkIn, b.checkOut).includes(TODAY))
  const rooms = hotel.rooms.reduce((sum, r) => sum + r.units, 0)
  const revenueToday = staying.reduce(
    (sum, b) => sum + Math.round(b.pricing.total / Math.max(b.pricing.nights, 1)),
    0
  )
  const adr = staying.length ? Math.round(revenueToday / staying.length) : hotel.pricePerNight

  return {
    id: hotel.id,
    name: hotel.name,
    city: hotel.city,
    country: hotel.country,
    rooms,
    occupancy: Math.round((staying.length / Math.max(rooms, 1)) * 100),
    adr,
    revenueToday,
    rating: deriveRating(allReviews.filter((r) => r.hotelId === hotel.id && r.status === "published"))
      .rating,
    status: "Active",
    seed: hotel.seed,
  }
})

/** The property currently in focus in the top-bar switcher. */
export const activeProperty =
  properties.find((p) => p.id === PARTNER_ORG.activeHotelId) ?? properties[0]

export const portfolioStats = {
  totalProperties: properties.length,
  totalRooms: properties.reduce((sum, p) => sum + p.rooms, 0),
  todaysBookings: partnerBookings.filter((b) =>
    datesInRange(b.checkIn, b.checkOut).includes(TODAY)
  ).length,
  todaysRevenue: properties.reduce((sum, p) => sum + p.revenueToday, 0),
  occupancy: Math.round(
    properties.reduce((sum, p) => sum + p.occupancy, 0) / Math.max(properties.length, 1)
  ),
  adr: Math.round(
    properties.reduce((sum, p) => sum + p.adr, 0) / Math.max(properties.length, 1)
  ),
}
