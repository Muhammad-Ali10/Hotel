"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import type {
  AppNotification,
  Booking,
  BookingAddOn,
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
  makeBookingRef,
  makeTicketRef,
  priceBooking,
  refundFor,
  toISODate,
} from "@/lib/domain"
import { applyPromotions, buildSeed, type AppState } from "./seed"

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

type Actions = {
  /* bookings */
  createBooking: (input: CreateBookingInput) => Booking
  cancelBooking: (id: string, reason: string, by?: "guest" | "hotel") => void
  modifyBooking: (
    id: string,
    changes: { checkIn: string; checkOut: string; guests: number; specialRequests?: string }
  ) => void
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
        const hotel = get().hotels.find((h) => h.id === input.hotelId)!
        const room = hotel.rooms.find((r) => r.id === input.roomId)!
        const pricing = priceBooking({
          hotel,
          room,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guests: input.guests,
          addOns: input.addOns,
        })

        const booking: Booking = {
          id: makeBookingRef(),
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
          source: "Direct",
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

        return booking
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
        set((state) => ({
          bookings: state.bookings.map((b) => {
            if (b.id !== id) return b
            const hotel = state.hotels.find((h) => h.id === b.hotelId)
            const room = hotel?.rooms.find((r) => r.id === b.roomId)
            if (!hotel || !room) return b
            return {
              ...b,
              checkIn: changes.checkIn,
              checkOut: changes.checkOut,
              guests: changes.guests,
              specialRequests: changes.specialRequests ?? b.specialRequests,
              // re-priced against the same rules the guest booked under
              pricing: priceBooking({
                hotel,
                room,
                checkIn: changes.checkIn,
                checkOut: changes.checkOut,
                guests: changes.guests,
                addOns: b.addOns,
              }),
            }
          }),
        }))

        const booking = get().bookings.find((b) => b.id === id)
        if (!booking) return
        set((state) => ({
          notifications: pushNotification(state, {
            audience: "partner",
            type: "booking",
            title: "Reservation modified",
            message: `${booking.guest.firstName} ${booking.guest.lastName} changed ${booking.id} to ${booking.checkIn} → ${booking.checkOut}.`,
            href: "/extranet/reservations",
          }),
        }))
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
            const set_ = new Set(h.availability.closedDates)
            for (const d of dates) closed ? set_.add(d) : set_.delete(d)
            return {
              ...h,
              availability: { ...h.availability, closedDates: [...set_].sort() },
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
      }),
    }
  )
)

export type { Discount, Hotel, Booking, Review }
