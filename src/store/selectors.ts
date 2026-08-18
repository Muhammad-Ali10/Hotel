"use client"

import { useMemo } from "react"

import type { Booking, NotificationAudience, Review } from "@/types"
import { datesInRange, deriveRating, isUpcoming, toISODate } from "@/lib/domain"
import { PARTNER_ORG } from "@/data/config"
import { useStore } from "./index"

/**
 * Read helpers. Each one selects a raw array (a stable reference) and derives
 * with `useMemo` — selecting a freshly-built array straight out of zustand v5
 * would return a new reference on every render and loop forever.
 */

const partnerHotelIds = PARTNER_ORG.hotelIds as readonly string[]

/* ---------------------------------------------------------------- hotels -- */

export function useHotels() {
  return useStore((s) => s.hotels)
}

export function useHotel(id: string) {
  const hotels = useHotels()
  return useMemo(() => hotels.find((h) => h.id === id), [hotels, id])
}

/** Hotels the signed-in partner manages. */
export function usePartnerHotels() {
  const hotels = useHotels()
  return useMemo(() => hotels.filter((h) => h.managedBy === PARTNER_ORG.id), [hotels])
}

export function useActiveHotel() {
  return useHotel(PARTNER_ORG.activeHotelId)
}

/* --------------------------------------------------------------- reviews -- */

/** Published reviews only — what the public site is allowed to show. */
export function useHotelReviews(hotelId: string) {
  const reviews = useStore((s) => s.reviews)
  return useMemo(
    () => reviews.filter((r) => r.hotelId === hotelId && r.status === "published"),
    [reviews, hotelId]
  )
}

/** Every review for a hotel regardless of status — the partner's moderation view. */
export function useAllHotelReviews(hotelId: string) {
  const reviews = useStore((s) => s.reviews)
  return useMemo(() => reviews.filter((r) => r.hotelId === hotelId), [reviews, hotelId])
}

export function usePartnerReviews() {
  const reviews = useStore((s) => s.reviews)
  return useMemo(
    () => reviews.filter((r) => partnerHotelIds.includes(r.hotelId)),
    [reviews]
  )
}

/** Reviews written by the signed-in customer. */
export function useMyReviews() {
  const reviews = useStore((s) => s.reviews)
  const userId = useStore((s) => s.profile.id)
  return useMemo(() => reviews.filter((r) => r.authorId === userId), [reviews, userId])
}

/** Headline rating + review count + category averages, always derived. */
export function useHotelRating(hotelId: string) {
  const reviews = useHotelReviews(hotelId)
  return useMemo(() => deriveRating(reviews), [reviews])
}

/** Ratings for many hotels at once — for cards and listings. */
export function useRatings() {
  const reviews = useStore((s) => s.reviews)
  return useMemo(() => {
    const byHotel = new Map<string, Review[]>()
    for (const r of reviews) {
      if (r.status !== "published") continue
      const list = byHotel.get(r.hotelId)
      if (list) list.push(r)
      else byHotel.set(r.hotelId, [r])
    }
    const out: Record<string, ReturnType<typeof deriveRating>> = {}
    for (const [hotelId, list] of byHotel) out[hotelId] = deriveRating(list)
    return out
  }, [reviews])
}

/* -------------------------------------------------------------- bookings -- */

export function useBooking(id: string) {
  const bookings = useStore((s) => s.bookings)
  return useMemo(() => bookings.find((b) => b.id === id), [bookings, id])
}

/**
 * The signed-in customer's bookings, newest stay first.
 *
 * Keyed on `customerId`, not on the guest email. Checkout lets the guest edit
 * the contact email — booking for a colleague, correcting a typo — and matching
 * on it dropped the booking out of their own dashboard the moment they did.
 */
export function useMyBookings() {
  const bookings = useStore((s) => s.bookings)
  const userId = useStore((s) => s.profile.id)
  return useMemo(
    () =>
      bookings
        .filter((b) => b.customerId === userId)
        .sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1)),
    [bookings, userId]
  )
}

export function useMyUpcomingBookings() {
  const bookings = useMyBookings()
  return useMemo(() => {
    const t = toISODate(new Date())
    return bookings.filter((b) => isUpcoming(b, t)).sort((a, b) => (a.checkIn > b.checkIn ? 1 : -1))
  }, [bookings])
}

/** Reservations at the partner's hotels — excludes cancellations. */
export function usePartnerReservations() {
  const bookings = useStore((s) => s.bookings)
  return useMemo(
    () =>
      bookings
        .filter((b) => partnerHotelIds.includes(b.hotelId) && b.status !== "cancelled")
        .sort((a, b) => (a.checkIn > b.checkIn ? 1 : -1)),
    [bookings]
  )
}

/** The cancellations screen — the same list, filtered by status. */
export function usePartnerCancellations() {
  const bookings = useStore((s) => s.bookings)
  return useMemo(
    () =>
      bookings
        .filter((b) => partnerHotelIds.includes(b.hotelId) && b.status === "cancelled")
        .sort((a, b) => ((a.cancellation?.date ?? "") < (b.cancellation?.date ?? "") ? 1 : -1)),
    [bookings]
  )
}

/** Bookings the customer has completed but not yet reviewed. */
export function useReviewableBookings() {
  const bookings = useMyBookings()
  const reviews = useStore((s) => s.reviews)
  return useMemo(() => {
    const reviewed = new Set(reviews.map((r) => r.bookingId).filter(Boolean))
    return bookings.filter(
      (b) => (b.status === "completed" || b.status === "checked_out") && !reviewed.has(b.id)
    )
  }, [bookings, reviews])
}

/* ------------------------------------------------------------- favorites -- */

export function useFavoriteHotels() {
  const hotels = useHotels()
  const favorites = useStore((s) => s.favorites)
  return useMemo(
    () => favorites.map((id) => hotels.find((h) => h.id === id)).filter((h) => h !== undefined),
    [hotels, favorites]
  )
}

export function useIsFavorite(hotelId: string) {
  return useStore((s) => s.favorites.includes(hotelId))
}

/* --------------------------------------------------------- notifications -- */

export function useNotifications(audience: NotificationAudience) {
  const notifications = useStore((s) => s.notifications)
  return useMemo(
    () =>
      notifications
        .filter((n) => n.audience === audience)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [notifications, audience]
  )
}

export function useUnreadCount(audience: NotificationAudience) {
  return useStore(
    (s) => s.notifications.filter((n) => n.audience === audience && !n.read).length
  )
}

/* ------------------------------------------------------------- tickets --- */

export function useTickets(createdBy: NotificationAudience) {
  const tickets = useStore((s) => s.tickets)
  return useMemo(
    () =>
      tickets
        .filter((t) => t.createdBy === createdBy)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [tickets, createdBy]
  )
}

export function useTicket(id: string) {
  const tickets = useStore((s) => s.tickets)
  return useMemo(() => tickets.find((t) => t.id === id), [tickets, id])
}

/* -------------------------------------------------------------- profile -- */

export function useProfile() {
  return useStore((s) => s.profile)
}

export function useSettings() {
  return useStore((s) => s.settings)
}

/* ------------------------------------------------------------ dashboard -- */

/** The dashboard's stat tiles — every number derived, none hand-written. */
export function useDashboardStats() {
  const bookings = useMyBookings()
  const favorites = useStore((s) => s.favorites)
  const myReviews = useMyReviews()
  const profile = useProfile()

  return useMemo(() => {
    const t = toISODate(new Date())
    const upcoming = bookings.filter((b) => isUpcoming(b, t)).length
    return {
      upcomingTrips: upcoming,
      savedHotels: favorites.length,
      reviewsWritten: myReviews.length,
      rewardPoints: profile.points,
    }
  }, [bookings, favorites.length, myReviews.length, profile.points])
}

/* ------------------------------------------------------------- extranet -- */

/**
 * The partner's portfolio, counted live. The Properties screen and the extranet
 * dashboard read this instead of a module-level snapshot, so a guest review, a
 * rename, or a room edit moves these numbers too.
 */
export function usePartnerPortfolio() {
  const hotels = usePartnerHotels()
  const bookings = useStore((s) => s.bookings)
  const reviews = useStore((s) => s.reviews)

  return useMemo(() => {
    const today = toISODate(new Date())

    const rows = hotels.map((hotel) => {
      const live = bookings.filter(
        (b) => b.hotelId === hotel.id && b.status !== "cancelled"
      )
      const staying = live.filter((b) => datesInRange(b.checkIn, b.checkOut).includes(today))
      const rooms = hotel.rooms.reduce((sum, r) => sum + r.units, 0)
      const revenueToday = staying.reduce(
        (sum, b) => sum + Math.round(b.pricing.total / Math.max(b.pricing.nights, 1)),
        0
      )
      const published = reviews.filter(
        (r) => r.hotelId === hotel.id && r.status === "published"
      )

      return {
        id: hotel.id,
        name: hotel.name,
        city: hotel.city,
        country: hotel.country,
        seed: hotel.seed,
        rooms,
        occupancy: Math.round((staying.length / Math.max(rooms, 1)) * 100),
        adr: staying.length ? Math.round(revenueToday / staying.length) : hotel.pricePerNight,
        revenueToday,
        rating: deriveRating(published).rating,
        reviewCount: published.length,
      }
    })

    const arrivingToday = bookings.filter(
      (b) =>
        partnerHotelIds.includes(b.hotelId) && b.status !== "cancelled" && b.checkIn === today
    ).length

    return {
      rows,
      totalProperties: rows.length,
      totalRooms: rows.reduce((sum, p) => sum + p.rooms, 0),
      todaysArrivals: arrivingToday,
      todaysRevenue: rows.reduce((sum, p) => sum + p.revenueToday, 0),
      occupancy: Math.round(
        rows.reduce((sum, p) => sum + p.occupancy, 0) / Math.max(rows.length, 1)
      ),
      adr: Math.round(rows.reduce((sum, p) => sum + p.adr, 0) / Math.max(rows.length, 1)),
    }
  }, [hotels, bookings, reviews])
}

export function usePartnerStats() {
  const reservations = usePartnerReservations()
  const cancellations = usePartnerCancellations()
  const reviews = usePartnerReviews()

  return useMemo(() => {
    const published = reviews.filter((r) => r.status === "published")
    const revenue = reservations.reduce((sum, b) => sum + b.pricing.total, 0)
    return {
      reservations: reservations.length,
      cancellations: cancellations.length,
      revenue,
      pendingReviews: reviews.filter((r) => r.status === "pending").length,
      awaitingReply: published.filter((r) => !r.response).length,
      avgRating: deriveRating(published).rating,
      reviewCount: published.length,
    }
  }, [reservations, cancellations, reviews])
}

export type { Booking }
