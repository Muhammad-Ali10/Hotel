"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import type {
  AppNotification,
  Booking,
  BookingAddOn,
  BookingSource,
  BookingStatus,
  Discount,
  Hotel,
  HotelPolicies,
  NotificationAudience,
  Photo,
  Promotion,
  PromotionStatus,
  Review,
  ReviewCategories,
  ReviewStatus,
  SupportTicket,
  TaxLine,
  TicketPriority,
  TicketStatus,
  UserProfile,
  UserSettings,
  ValueAdd,
} from "@/types"
import {
  checkAvailability,
  makeBookingRef,
  makeTicketRef,
  nightsBetween,
  priceBooking,
  refundFor,
  toISODate,
  valueAddPrice,
} from "@/lib/domain"
import { applyPromotions, buildSeed, type AppState, type PartnerProfile } from "./seed"
import type { TeamUser } from "@/lib/extranet/types"

/** Runtime "now" — actions use the real clock; only the seed is date-pinned. */
const now = () => new Date()
const today = () => toISODate(now())
const stamp = () => now().toISOString()

type CreateBookingInput = {
  hotelId: string
  roomId: string
  guest: Booking["guest"]
  checkIn: string
  checkOut: string
  guests: number
  arrivalTime: string
  specialRequests: string
  addOns: BookingAddOn[]
  payment: Booking["payment"]
  /**
   * The account the booking belongs to. Stated by the caller, never inferred:
   * the public checkout passes the signed-in customer, while a walk-in the
   * property enters itself has a guest but no platform account — defaulting it
   * would drop a stranger's reservation into the customer's dashboard.
   */
  customerId?: string
  /** Defaults to Direct — the public site and the property's own desk. */
  source?: BookingSource
}

type NewReviewInput = {
  hotelId: string
  bookingId?: string
  rating: number
  categories: ReviewCategories
  title: string
  body: string
  roomName: string
}

type NewTicketInput = {
  subject: string
  category: string
  priority: TicketPriority
  message: string
  author: string
  email: string
  createdBy: NotificationAudience
  hotelId?: string
  bookingId?: string
}

/**
 * Every write that can be rejected returns this instead of throwing. The store
 * is where the API will eventually sit, so the callers already handle a refusal
 * — the UI's own validation is a courtesy, not the gate.
 */
export type WriteResult<T> = { ok: true; data: T } | { ok: false; message: string }

type Actions = {
  /* bookings */
  createBooking: (input: CreateBookingInput) => WriteResult<Booking>
  cancelBooking: (id: string, reason: string, by?: "guest" | "hotel") => void
  modifyBooking: (
    id: string,
    changes: { checkIn: string; checkOut: string; guests: number; specialRequests?: string }
  ) => WriteResult<Booking>
  setBookingStatus: (id: string, status: BookingStatus) => void
  assignRoomNo: (id: string, roomNo: string) => void

  /* reviews */
  addReview: (input: NewReviewInput) => void
  replyToReview: (id: string, text: string) => void
  setReviewStatus: (id: string, status: ReviewStatus) => void
  deleteReview: (id: string) => void

  /* favorites */
  toggleFavorite: (hotelId: string) => void

  /* notifications */
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: (audience: NotificationAudience) => void

  /* tickets */
  createTicket: (input: NewTicketInput) => SupportTicket
  replyToTicket: (id: string, text: string, author: string) => void
  setTicketStatus: (id: string, status: TicketStatus) => void

  /* profile */
  updateProfile: (changes: Partial<UserProfile>) => void
  updateSettings: (changes: Partial<UserSettings>) => void

  /* partner account */
  updatePartner: (changes: Partial<PartnerProfile>) => void
  setPartnerSetting: (id: string, enabled: boolean) => void
  addTeamUser: (user: TeamUser) => void
  removeTeamUser: (id: string) => void

  /* hotel content — partner edits that surface publicly */
  updateHotel: (
    id: string,
    changes: Partial<Pick<Hotel, "name" | "description" | "address" | "amenities">>
  ) => void
  updatePolicies: (id: string, changes: Partial<HotelPolicies>) => void
  updateRoom: (
    hotelId: string,
    roomId: string,
    changes: Partial<{ pricePerNight: number; units: number; name: string; description: string }>
  ) => void
  setRateOverride: (hotelId: string, date: string, rate: number | null) => void
  setDatesClosed: (hotelId: string, dates: string[], closed: boolean) => void
  setMinStay: (hotelId: string, minStay: number) => void
  updateTaxLine: (hotelId: string, taxId: string, changes: Partial<TaxLine>) => void
  addTaxLine: (hotelId: string, line: TaxLine) => void
  updateValueAdd: (hotelId: string, valueAddId: string, changes: Partial<ValueAdd>) => void
  addValueAdd: (hotelId: string, valueAdd: ValueAdd) => void
  updatePhotos: (hotelId: string, photos: Photo[]) => void

  /* promotions */
  setPromotionStatus: (id: string, status: PromotionStatus) => void
  createPromotion: (promotion: Promotion) => void

  /* demo */
  resetDemo: () => void
}

export type Store = AppState & Actions

/** Recomputes every hotel's public discount after a promotion changes. */
function withPromotions(state: AppState): Pick<AppState, "hotels"> {
  return { hotels: applyPromotions(state.hotels, state.promotions, today()) }
}

/**
 * Re-resolves stored add-ons against a stay. `valueAddPrice` folds the unit
 * ("per person", "per night") into the amount, so the stored price is only
 * correct for the stay it was quoted against — a modified booking has to ask
 * the catalogue again. Add-ons the property has since removed are dropped.
 */
function repriceAddOns(
  addOns: BookingAddOn[],
  hotel: Hotel,
  stay: { nights: number; guests: number }
): BookingAddOn[] {
  return addOns
    .map((a) => {
      const valueAdd = hotel.valueAdds.find((v) => v.id === a.id)
      if (!valueAdd) return null
      return { id: a.id, name: valueAdd.name, price: valueAddPrice(valueAdd, stay), qty: 1 }
    })
    .filter((a) => a !== null)
}

/**
 * A booking reference that isn't already taken. STY-XXXXXX has ~1.07bn
 * combinations, so a clash is rare — but "rare" is not "never", and the
 * reference is the primary key every surface looks a booking up by.
 */
function uniqueBookingRef(existing: Booking[]): string {
  const taken = new Set(existing.map((b) => b.id))
  for (let attempt = 0; attempt < 20; attempt++) {
    const ref = makeBookingRef()
    if (!taken.has(ref)) return ref
  }
  // Astronomically unlikely; a suffix is still better than a duplicate key.
  return `${makeBookingRef()}${taken.size}`
}

function pushNotification(
  state: AppState,
  n: Omit<AppNotification, "id" | "createdAt" | "read">
): AppNotification[] {
  return [
    { ...n, id: `ntf-${Math.random().toString(36).slice(2, 9)}`, createdAt: stamp(), read: false },
    ...state.notifications,
  ]
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...buildSeed(),

      /* ------------------------------------------------------- bookings -- */

      createBooking: (input) => {
        const state = get()
        const hotel = state.hotels.find((h) => h.id === input.hotelId)
        const room = hotel?.rooms.find((r) => r.id === input.roomId)
        if (!hotel || !room) {
          return { ok: false, message: "That room is no longer offered by the property." }
        }

        // Re-validated here, not just in the form. The checkout screen is one
        // caller among several and its query string is user-editable — the
        // rules have to hold at the write, which is where the API will enforce
        // them too.
        const available = checkAvailability({
          hotel,
          room,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guests: input.guests,
          bookings: state.bookings,
        })
        if (!available.ok) return { ok: false, message: available.message }

        const pricing = priceBooking({
          hotel,
          room,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guests: input.guests,
          addOns: input.addOns,
        })

        const booking: Booking = {
          id: uniqueBookingRef(state.bookings),
          // Never derived from the email the guest typed — they can change that
          // field at checkout, and the booking used to disappear from their own
          // dashboard when they did.
          customerId: input.customerId,
          hotelId: hotel.id,
          roomId: room.id,
          hotelName: hotel.name,
          roomName: room.name,
          city: hotel.city,
          seed: hotel.seed,
          guest: input.guest,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guests: input.guests,
          arrivalTime: input.arrivalTime,
          specialRequests: input.specialRequests,
          addOns: input.addOns,
          pricing,
          payment: input.payment,
          status: "confirmed",
          source: input.source ?? "Direct",
          createdAt: stamp(),
        }

        set((state) => ({
          bookings: [booking, ...state.bookings],
          notifications: [
            {
              id: `ntf-${booking.id}-c`,
              audience: "customer",
              type: "booking",
              title: "Your stay is confirmed",
              message: `${booking.hotelName} · ${booking.roomName} · ${booking.checkIn}. Reference ${booking.id}.`,
              createdAt: stamp(),
              read: false,
              href: "/dashboard/bookings",
            },
            // the partner only hears about it if they manage the property
            ...(hotel.managedBy
              ? [
                  {
                    id: `ntf-${booking.id}-p`,
                    audience: "partner" as const,
                    type: "booking" as const,
                    title: "New reservation",
                    message: `${booking.guest.firstName} ${booking.guest.lastName} booked the ${booking.roomName} at ${booking.hotelName}.`,
                    createdAt: stamp(),
                    read: false,
                    href: "/extranet/reservations",
                  },
                ]
              : []),
            ...state.notifications,
          ],
        }))

        return { ok: true, data: booking }
      },

      cancelBooking: (id, reason, by = "guest") => {
        const booking = get().bookings.find((b) => b.id === id)
        if (!booking) return
        const { refund, refundStatus } = refundFor(booking, today())

        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: "cancelled" as const,
                  cancellation: { date: today(), reason, by, refund, refundStatus },
                }
              : b
          ),
          notifications: pushNotification(state, {
            audience: by === "guest" ? "partner" : "customer",
            type: "booking",
            title: "Reservation cancelled",
            message:
              by === "guest"
                ? `${booking.guest.firstName} ${booking.guest.lastName} cancelled ${booking.id} — ${booking.hotelName}.`
                : `${booking.hotelName} cancelled your reservation ${booking.id}. ${refundStatus === "full" ? "A full refund is on its way." : ""}`,
            href:
              by === "guest"
                ? "/extranet/reservations/cancellations"
                : "/dashboard/bookings",
          }),
        }))
      },

      modifyBooking: (id, changes) => {
        const state = get()
        const current = state.bookings.find((b) => b.id === id)
        if (!current) return { ok: false, message: "That reservation no longer exists." }
        if (current.status === "cancelled") {
          return { ok: false, message: "A cancelled reservation can't be changed." }
        }

        const hotel = state.hotels.find((h) => h.id === current.hotelId)
        const room = hotel?.rooms.find((r) => r.id === current.roomId)
        if (!hotel || !room) {
          return { ok: false, message: "That room is no longer offered by the property." }
        }

        // The same gate `createBooking` uses. Moving a stay is a new claim on
        // inventory and this path had no validation at all — a guest could
        // shift their booking onto sold-out nights or grow the party past what
        // the room sleeps. The reservation's own units are excluded so it
        // doesn't block itself.
        const available = checkAvailability({
          hotel,
          room,
          checkIn: changes.checkIn,
          checkOut: changes.checkOut,
          guests: changes.guests,
          bookings: state.bookings,
          ignoreBookingId: id,
        })
        if (!available.ok) return { ok: false, message: available.message }

        const nights = nightsBetween(changes.checkIn, changes.checkOut)
        // Add-ons are re-resolved against the NEW nights and party size.
        // Carrying the stored prices through left a per-person breakfast at
        // its two-guest price after the booking grew to four.
        const addOns = repriceAddOns(current.addOns, hotel, {
          nights,
          guests: changes.guests,
        })

        const updated: Booking = {
          ...current,
          checkIn: changes.checkIn,
          checkOut: changes.checkOut,
          guests: changes.guests,
          specialRequests: changes.specialRequests ?? current.specialRequests,
          addOns,
          // re-priced against the same rules the guest booked under
          pricing: priceBooking({
            hotel,
            room,
            checkIn: changes.checkIn,
            checkOut: changes.checkOut,
            guests: changes.guests,
            addOns,
          }),
        }

        set((s) => ({
          bookings: s.bookings.map((b) => (b.id === id ? updated : b)),
          notifications: pushNotification(s, {
            audience: "partner",
            type: "booking",
            title: "Reservation modified",
            message: `${updated.guest.firstName} ${updated.guest.lastName} changed ${updated.id} to ${updated.checkIn} → ${updated.checkOut}.`,
            href: "/extranet/reservations",
          }),
        }))

        return { ok: true, data: updated }
      },

      setBookingStatus: (id, status) =>
        set((state) => ({
          bookings: state.bookings.map((b) => (b.id === id ? { ...b, status } : b)),
        })),

      assignRoomNo: (id, roomNo) =>
        set((state) => ({
          bookings: state.bookings.map((b) => (b.id === id ? { ...b, roomNo } : b)),
        })),

      /* -------------------------------------------------------- reviews -- */

      addReview: (input) => {
        const profile = get().profile
        const review: Review = {
          id: `rev-${Math.random().toString(36).slice(2, 9)}`,
          hotelId: input.hotelId,
          bookingId: input.bookingId,
          authorId: profile.id,
          author: `${profile.firstName} ${profile.lastName}`,
          authorSeed: profile.avatarSeed,
          country: profile.country,
          roomName: input.roomName,
          rating: input.rating,
          categories: input.categories,
          title: input.title,
          body: input.body,
          date: today(),
          // a guest review goes live immediately; the partner can flag it later
          status: "published",
        }

        set((state) => ({
          reviews: [review, ...state.reviews],
          notifications: state.hotels.find((h) => h.id === input.hotelId)?.managedBy
            ? pushNotification(state, {
                audience: "partner",
                type: "review",
                title: "New review",
                message: `${review.author} rated ${state.hotels.find((h) => h.id === input.hotelId)?.name} ${review.rating}/5.`,
                href: "/extranet/reviews",
              })
            : state.notifications,
        }))
      },

      replyToReview: (id, text) => {
        set((state) => ({
          reviews: state.reviews.map((r) =>
            r.id === id ? { ...r, response: { text, date: today() } } : r
          ),
        }))
        const review = get().reviews.find((r) => r.id === id)
        if (!review) return
        // Only the review's own author hears about the reply. Notifying
        // unconditionally told the signed-in customer that a hotel had answered
        // a review written by somebody else.
        if (review.authorId !== get().profile.id) return
        set((state) => ({
          notifications: pushNotification(state, {
            audience: "customer",
            type: "review",
            title: "The hotel replied to your review",
            message: `${state.hotels.find((h) => h.id === review.hotelId)?.name} responded to your review.`,
            href: "/dashboard/reviews",
          }),
        }))
      },

      setReviewStatus: (id, status) =>
        set((state) => ({
          reviews: state.reviews.map((r) => (r.id === id ? { ...r, status } : r)),
        })),

      deleteReview: (id) =>
        set((state) => ({ reviews: state.reviews.filter((r) => r.id !== id) })),

      /* ------------------------------------------------------ favorites -- */

      toggleFavorite: (hotelId) =>
        set((state) => ({
          favorites: state.favorites.includes(hotelId)
            ? state.favorites.filter((id) => id !== hotelId)
            : [hotelId, ...state.favorites],
        })),

      /* -------------------------------------------------- notifications -- */

      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAllNotificationsRead: (audience) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.audience === audience ? { ...n, read: true } : n
          ),
        })),

      /* -------------------------------------------------------- tickets -- */

      createTicket: (input) => {
        const ticket: SupportTicket = {
          id: makeTicketRef(),
          subject: input.subject,
          category: input.category,
          priority: input.priority,
          status: "open",
          createdBy: input.createdBy,
          author: input.author,
          email: input.email,
          hotelId: input.hotelId,
          bookingId: input.bookingId,
          createdAt: stamp(),
          updatedAt: stamp(),
          seed: `tkt-${Math.random().toString(36).slice(2, 8)}`,
          messages: [
            {
              id: "m1",
              from: "user",
              author: input.author,
              text: input.message,
              date: stamp(),
            },
          ],
        }
        set((state) => ({ tickets: [ticket, ...state.tickets] }))
        return ticket
      },

      replyToTicket: (id, text, author) =>
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.id === id
              ? {
                  ...t,
                  updatedAt: stamp(),
                  status: t.status === "resolved" ? "open" : t.status,
                  messages: [
                    ...t.messages,
                    {
                      id: `m${t.messages.length + 1}`,
                      from: "user" as const,
                      author,
                      text,
                      date: stamp(),
                    },
                  ],
                }
              : t
          ),
        })),

      setTicketStatus: (id, status) =>
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.id === id ? { ...t, status, updatedAt: stamp() } : t
          ),
        })),

      /* -------------------------------------------------------- profile -- */

      updateProfile: (changes) =>
        set((state) => ({ profile: { ...state.profile, ...changes } })),

      updateSettings: (changes) =>
        set((state) => ({ settings: { ...state.settings, ...changes } })),

      /* ------------------------------------------------- partner account -- */

      updatePartner: (changes) =>
        set((state) => ({ partner: { ...state.partner, ...changes } })),

      setPartnerSetting: (id, enabled) =>
        set((state) => ({
          partnerSettings: state.partnerSettings.map((s) =>
            s.id === id ? { ...s, enabled } : s
          ),
        })),

      addTeamUser: (user) => set((state) => ({ team: [...state.team, user] })),

      removeTeamUser: (id) =>
        set((state) => ({ team: state.team.filter((u) => u.id !== id) })),

      /* --------------------------------------------------------- hotels -- */

      updateHotel: (id, changes) =>
        set((state) => ({
          hotels: state.hotels.map((h) => (h.id === id ? { ...h, ...changes } : h)),
        })),

      updatePolicies: (id, changes) =>
        set((state) => ({
          hotels: state.hotels.map((h) =>
            h.id === id ? { ...h, policies: { ...h.policies, ...changes } } : h
          ),
        })),

      updateRoom: (hotelId, roomId, changes) =>
        set((state) => ({
          hotels: state.hotels.map((h) => {
            if (h.id !== hotelId) return h
            const rooms = h.rooms.map((r) => (r.id === roomId ? { ...r, ...changes } : r))
            return {
              ...h,
              rooms,
              // the headline price follows the cheapest room, always
              pricePerNight: Math.min(...rooms.map((r) => r.pricePerNight)),
            }
          }),
        })),

      setRateOverride: (hotelId, date, rate) =>
        set((state) => ({
          hotels: state.hotels.map((h) => {
            if (h.id !== hotelId) return h
            const rateOverrides = { ...h.availability.rateOverrides }
            if (rate === null) delete rateOverrides[date]
            else rateOverrides[date] = rate
            return { ...h, availability: { ...h.availability, rateOverrides } }
          }),
        })),

      setDatesClosed: (hotelId, dates, closed) =>
        set((state) => ({
          hotels: state.hotels.map((h) => {
            if (h.id !== hotelId) return h
            const next = new Set(h.availability.closedDates)
            for (const d of dates) {
              if (closed) next.add(d)
              else next.delete(d)
            }
            return {
              ...h,
              availability: { ...h.availability, closedDates: [...next].sort() },
            }
          }),
        })),

      setMinStay: (hotelId, minStay) =>
        set((state) => ({
          hotels: state.hotels.map((h) =>
            h.id === hotelId ? { ...h, availability: { ...h.availability, minStay } } : h
          ),
        })),

      updateTaxLine: (hotelId, taxId, changes) =>
        set((state) => ({
          hotels: state.hotels.map((h) =>
            h.id === hotelId
              ? {
                  ...h,
                  taxLines: h.taxLines.map((t) => (t.id === taxId ? { ...t, ...changes } : t)),
                }
              : h
          ),
        })),

      addTaxLine: (hotelId, line) =>
        set((state) => ({
          hotels: state.hotels.map((h) =>
            h.id === hotelId ? { ...h, taxLines: [...h.taxLines, line] } : h
          ),
        })),

      updateValueAdd: (hotelId, valueAddId, changes) =>
        set((state) => ({
          hotels: state.hotels.map((h) =>
            h.id === hotelId
              ? {
                  ...h,
                  valueAdds: h.valueAdds.map((v) =>
                    v.id === valueAddId ? { ...v, ...changes } : v
                  ),
                }
              : h
          ),
        })),

      addValueAdd: (hotelId, valueAdd) =>
        set((state) => ({
          hotels: state.hotels.map((h) =>
            h.id === hotelId ? { ...h, valueAdds: [...h.valueAdds, valueAdd] } : h
          ),
        })),

      updatePhotos: (hotelId, photos) =>
        set((state) => ({
          hotels: state.hotels.map((h) => (h.id === hotelId ? { ...h, photos } : h)),
        })),

      /* ----------------------------------------------------- promotions -- */

      setPromotionStatus: (id, status) =>
        set((state) => {
          const promotions = state.promotions.map((p) =>
            p.id === id ? { ...p, status } : p
          )
          // switching a promotion on or off re-derives every public badge
          return { promotions, ...withPromotions({ ...state, promotions }) }
        }),

      createPromotion: (promotion) =>
        set((state) => {
          const promotions = [promotion, ...state.promotions]
          return { promotions, ...withPromotions({ ...state, promotions }) }
        }),

      /* ----------------------------------------------------------- demo -- */

      resetDemo: () => set({ ...buildSeed() }),
    }),
    {
      name: "stayora-store-v1",
      version: 1,
      // The store is rehydrated from localStorage inside a client effect
      // (see StoreHydration) so the server-rendered markup and the first client
      // render both come from the deterministic seed.
      skipHydration: true,
      partialize: (state) => ({
        hotels: state.hotels,
        reviews: state.reviews,
        bookings: state.bookings,
        promotions: state.promotions,
        notifications: state.notifications,
        tickets: state.tickets,
        favorites: state.favorites,
        profile: state.profile,
        settings: state.settings,
        partner: state.partner,
        team: state.team,
        partnerSettings: state.partnerSettings,
      }),
    }
  )
)

export type { Discount, Hotel, Booking, Review }
