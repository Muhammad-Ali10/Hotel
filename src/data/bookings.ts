import type { Booking, BookingSource, BookingStatus } from "@/types"
import { addDays, priceBooking } from "@/lib/domain"
import { randomInt } from "@/lib/random"
import { PARTNER_ORG, TODAY } from "./config"
import { hotels, getHotel } from "./hotels"
import { userProfile } from "./profile"

/**
 * ONE booking list for the whole product.
 *
 * The dashboard shows the rows belonging to the signed-in customer; the
 * extranet shows the rows for hotels the partner manages; the cancellations
 * screen shows the rows whose status is `cancelled`. Previously these were
 * three unrelated arrays with different guests, hotels and id schemes, so a
 * booking could never appear on more than one surface.
 */

type Seed = {
  id: string
  hotelId: string
  roomId: string
  guest: { firstName: string; lastName: string; email: string; phone: string; country: string }
  /** day offsets from TODAY — negative is in the past */
  checkInOffset: number
  nights: number
  guests: number
  status: BookingStatus
  source?: BookingSource
  arrivalTime?: string
  specialRequests?: string
  addOnIds?: string[]
  roomNo?: string
  notes?: string
  payment?: { method: "card" | "property"; status: "paid" | "pending" }
  cancellation?: {
    dayOffset: number
    reason: string
    by: "guest" | "hotel"
    refundStatus: "full" | "partial" | "none" | "processed"
  }
}

const customer = {
  firstName: userProfile.firstName,
  lastName: userProfile.lastName,
  email: userProfile.email,
  phone: userProfile.phone,
  country: userProfile.country,
}

/** Guests are drawn from the same name pool as the reviews and the inbox. */
const guests = {
  emma: { firstName: "Emma", lastName: "Richardson", email: "emma.richardson@example.com", phone: "+44 20 7946 0812", country: "United Kingdom" },
  james: { firstName: "James", lastName: "Chen", email: "james.chen@example.com", phone: "+61 2 8123 4567", country: "Australia" },
  sofia: { firstName: "Sofia", lastName: "Martinez", email: "sofia.martinez@example.com", phone: "+34 91 123 4567", country: "Spain" },
  daniel: { firstName: "Daniel", lastName: "Kim", email: "daniel.kim@example.com", phone: "+82 2 3456 7890", country: "South Korea" },
  grace: { firstName: "Grace", lastName: "Lee", email: "grace.lee@example.com", phone: "+82 2 9876 5432", country: "South Korea" },
  olivia: { firstName: "Olivia", lastName: "Bennett", email: "olivia.bennett@example.com", phone: "+1 (416) 555-0198", country: "Canada" },
  marco: { firstName: "Marco", lastName: "Rossi", email: "marco.rossi@example.com", phone: "+39 06 1234 5678", country: "Italy" },
  yuki: { firstName: "Yuki", lastName: "Tanaka", email: "yuki.tanaka@example.com", phone: "+81 3 1234 5678", country: "Japan" },
  nadia: { firstName: "Nadia", lastName: "Hassan", email: "nadia.hassan@example.com", phone: "+971 4 123 4567", country: "UAE" },
  lars: { firstName: "Lars", lastName: "Andersen", email: "lars.andersen@example.com", phone: "+45 32 12 34 56", country: "Denmark" },
  priya: { firstName: "Priya", lastName: "Nair", email: "priya.nair@example.com", phone: "+91 22 2345 6789", country: "India" },
  claire: { firstName: "Claire", lastName: "Dubois", email: "claire.dubois@example.com", phone: "+33 1 42 68 53 00", country: "France" },
}

const seeds: Seed[] = [
  /* ---- the signed-in customer's own trips (dashboard) ------------------- */
  {
    id: "STY-4K7QM2",
    hotelId: "the-ritz-carlton",
    roomId: "premium-king",
    guest: customer,
    checkInOffset: 12,
    nights: 3,
    guests: 2,
    status: "confirmed",
    arrivalTime: "16:00 – 17:00",
    specialRequests: "High floor with a park view if one is free, please. Celebrating an anniversary.",
    addOnIds: ["breakfast", "champagne"],
    payment: { method: "card", status: "paid" },
  },
  {
    id: "STY-9XB3RT",
    hotelId: "four-seasons",
    roomId: "deluxe-king",
    guest: customer,
    checkInOffset: 46,
    nights: 4,
    guests: 2,
    status: "pending",
    arrivalTime: "20:00 – 22:00",
    specialRequests: "Late arrival — our flight lands at 19:40.",
    payment: { method: "property", status: "pending" },
  },
  {
    id: "STY-2HD8VN",
    hotelId: "aman-tokyo",
    roomId: "deluxe-king",
    guest: customer,
    checkInOffset: -38,
    nights: 5,
    guests: 2,
    status: "completed",
    arrivalTime: "15:00 – 16:00",
    addOnIds: ["airport-transfer", "spa-package"],
    roomNo: "3402",
    payment: { method: "card", status: "paid" },
  },
  {
    id: "STY-6PL1WC",
    hotelId: "one-and-only",
    roomId: "beach-villa",
    guest: customer,
    checkInOffset: -90,
    nights: 5,
    guests: 2,
    status: "cancelled",
    payment: { method: "card", status: "paid" },
    cancellation: {
      dayOffset: -104,
      reason: "Change of travel plans",
      by: "guest",
      refundStatus: "full",
    },
  },

  /* ---- other guests at the partner's hotels (extranet reservations) ----- */
  {
    id: "STY-8842QA",
    hotelId: "the-ritz-carlton",
    roomId: "executive-suite",
    guest: guests.emma,
    checkInOffset: 1,
    nights: 2,
    guests: 2,
    status: "confirmed",
    source: "Booking.com",
    arrivalTime: "15:00 – 16:00",
    roomNo: "1204",
    notes: "Repeat guest — prefers a quiet floor away from the lifts.",
    payment: { method: "card", status: "paid" },
  },
  {
    id: "STY-8841RB",
    hotelId: "the-ritz-carlton",
    roomId: "deluxe-king",
    guest: guests.james,
    checkInOffset: -1,
    nights: 4,
    guests: 1,
    status: "checked_in",
    source: "Direct",
    arrivalTime: "17:00 – 18:00",
    specialRequests: "Early check-in if possible — arriving off a red-eye.",
    addOnIds: ["early-check-in"],
    roomNo: "0908",
    payment: { method: "card", status: "paid" },
  },
  {
    id: "STY-8839TC",
    hotelId: "the-ritz-carlton",
    roomId: "standard",
    guest: guests.marco,
    checkInOffset: 5,
    nights: 2,
    guests: 2,
    status: "confirmed",
    source: "Expedia",
    payment: { method: "property", status: "pending" },
  },
  {
    id: "STY-8838UD",
    hotelId: "the-ritz-carlton",
    roomId: "penthouse-suite",
    guest: guests.nadia,
    checkInOffset: 20,
    nights: 3,
    guests: 4,
    status: "confirmed",
    source: "Travel Agency",
    specialRequests: "Two extra pillows per bed and a fruit platter on arrival.",
    addOnIds: ["airport-transfer", "champagne"],
    payment: { method: "card", status: "paid" },
  },
  {
    id: "STY-8836VE",
    hotelId: "the-ritz-carlton",
    roomId: "deluxe-king",
    guest: guests.olivia,
    checkInOffset: -6,
    nights: 3,
    guests: 2,
    status: "checked_out",
    source: "Direct",
    roomNo: "1105",
    payment: { method: "card", status: "paid" },
  },
  {
    id: "STY-8835WF",
    hotelId: "four-seasons",
    roomId: "premium-king",
    guest: guests.claire,
    checkInOffset: 3,
    nights: 2,
    guests: 2,
    status: "confirmed",
    source: "Direct",
    addOnIds: ["breakfast"],
    payment: { method: "card", status: "paid" },
  },
  {
    id: "STY-8834XG",
    hotelId: "four-seasons",
    roomId: "executive-suite",
    guest: guests.lars,
    checkInOffset: -2,
    nights: 5,
    guests: 3,
    status: "checked_in",
    source: "Booking.com",
    roomNo: "0412",
    notes: "Requested a cot — delivered on arrival.",
    payment: { method: "card", status: "paid" },
  },
  {
    id: "STY-8833YH",
    hotelId: "aman-tokyo",
    roomId: "premium-king",
    guest: guests.yuki,
    checkInOffset: 8,
    nights: 3,
    guests: 2,
    status: "confirmed",
    source: "Direct",
    arrivalTime: "18:00 – 20:00",
    payment: { method: "card", status: "paid" },
  },
  {
    id: "STY-8832ZJ",
    hotelId: "aman-tokyo",
    roomId: "standard",
    guest: guests.priya,
    checkInOffset: 15,
    nights: 2,
    guests: 1,
    status: "pending",
    source: "Expedia",
    payment: { method: "property", status: "pending" },
  },
  {
    id: "STY-8831AK",
    hotelId: "one-and-only",
    roomId: "deluxe-ocean",
    guest: guests.sofia,
    checkInOffset: 25,
    nights: 6,
    guests: 2,
    status: "confirmed",
    source: "Travel Agency",
    addOnIds: ["spa-package", "airport-transfer"],
    payment: { method: "card", status: "paid" },
  },
  {
    id: "STY-8830BL",
    hotelId: "one-and-only",
    roomId: "family-suite",
    guest: guests.grace,
    checkInOffset: -12,
    nights: 7,
    guests: 4,
    status: "checked_out",
    source: "Direct",
    roomNo: "V-08",
    payment: { method: "card", status: "paid" },
  },
  {
    id: "STY-8829CM",
    hotelId: "the-peninsula",
    roomId: "deluxe-king",
    guest: guests.daniel,
    checkInOffset: 6,
    nights: 2,
    guests: 2,
    status: "confirmed",
    source: "Booking.com",
    payment: { method: "card", status: "paid" },
  },
  {
    id: "STY-8828DN",
    hotelId: "the-peninsula",
    roomId: "executive-suite",
    guest: guests.emma,
    checkInOffset: 30,
    nights: 3,
    guests: 2,
    status: "confirmed",
    source: "Direct",
    addOnIds: ["late-checkout"],
    payment: { method: "card", status: "paid" },
  },

  /* ---- cancellations (same list — the extranet screen derives from it) -- */
  {
    id: "STY-8827EP",
    hotelId: "the-ritz-carlton",
    roomId: "deluxe-king",
    guest: guests.daniel,
    checkInOffset: 9,
    nights: 2,
    guests: 2,
    status: "cancelled",
    source: "Booking.com",
    payment: { method: "card", status: "paid" },
    cancellation: { dayOffset: -3, reason: "Found a better rate elsewhere", by: "guest", refundStatus: "full" },
  },
  {
    id: "STY-8826FQ",
    hotelId: "four-seasons",
    roomId: "standard",
    guest: guests.grace,
    checkInOffset: -4,
    nights: 3,
    guests: 1,
    status: "cancelled",
    source: "Expedia",
    payment: { method: "card", status: "paid" },
    cancellation: { dayOffset: -5, reason: "Flight cancelled", by: "guest", refundStatus: "partial" },
  },
  {
    id: "STY-8825GR",
    hotelId: "aman-tokyo",
    roomId: "executive-suite",
    guest: guests.marco,
    checkInOffset: -20,
    nights: 4,
    guests: 2,
    status: "cancelled",
    source: "Direct",
    payment: { method: "card", status: "paid" },
    cancellation: { dayOffset: -22, reason: "Overbooking — property initiated", by: "hotel", refundStatus: "processed" },
  },
  {
    id: "STY-8824HS",
    hotelId: "one-and-only",
    roomId: "beach-villa",
    guest: guests.lars,
    checkInOffset: -30,
    nights: 5,
    guests: 2,
    status: "cancelled",
    source: "Travel Agency",
    payment: { method: "card", status: "paid" },
    cancellation: { dayOffset: -31, reason: "Cancelled within 48 hours of arrival", by: "guest", refundStatus: "none" },
  },
  {
    id: "STY-8823JT",
    hotelId: "the-peninsula",
    roomId: "premium-king",
    guest: guests.priya,
    checkInOffset: -15,
    nights: 2,
    guests: 2,
    status: "cancelled",
    source: "Booking.com",
    payment: { method: "card", status: "paid" },
    cancellation: { dayOffset: -18, reason: "Change of travel plans", by: "guest", refundStatus: "full" },
  },
]

function build(seed: Seed): Booking {
  const hotel = getHotel(seed.hotelId)
  if (!hotel) throw new Error(`Booking seed ${seed.id} references unknown hotel ${seed.hotelId}`)
  const room = hotel.rooms.find((r) => r.id === seed.roomId)
  if (!room) throw new Error(`Booking seed ${seed.id} references unknown room ${seed.roomId}`)

  const checkIn = addDays(TODAY, seed.checkInOffset)
  const checkOut = addDays(checkIn, seed.nights)
  const guestCount = seed.guests

  const addOns = (seed.addOnIds ?? []).map((id) => {
    const va = hotel.valueAdds.find((v) => v.id === id)
    if (!va) throw new Error(`Booking seed ${seed.id} references unknown add-on ${id}`)
    return {
      id: va.id,
      name: va.name,
      price: va.unit === "per person" ? va.price * guestCount : va.price,
      qty: va.unit === "per night" ? seed.nights : 1,
    }
  })

  // Priced through the same function the checkout uses, so a dashboard total
  // and an extranet invoice can never disagree with what the guest was quoted.
  const pricing = priceBooking({ hotel, room, checkIn, checkOut, guests: guestCount, addOns })

  const cancellation = seed.cancellation
    ? {
        date: addDays(TODAY, seed.cancellation.dayOffset),
        reason: seed.cancellation.reason,
        by: seed.cancellation.by,
        refund:
          seed.cancellation.refundStatus === "full" || seed.cancellation.refundStatus === "processed"
            ? pricing.total
            : seed.cancellation.refundStatus === "partial"
              ? Math.round(pricing.total * 0.5)
              : 0,
        refundStatus: seed.cancellation.refundStatus,
      }
    : undefined

  return {
    id: seed.id,
    // The seeded trips that belong to the demo account are the ones booked
    // under its email; everything else arrived through an OTA and has no
    // platform account behind it. This is the only place the email is allowed
    // to imply ownership — from here on the id is what's read.
    customerId: seed.guest.email === userProfile.email ? userProfile.id : undefined,
    hotelId: hotel.id,
    roomId: room.id,
    hotelName: hotel.name,
    roomName: room.name,
    city: hotel.city,
    seed: hotel.seed,
    guest: seed.guest,
    checkIn,
    checkOut,
    guests: guestCount,
    arrivalTime: seed.arrivalTime ?? "I'm not sure yet",
    specialRequests: seed.specialRequests ?? "",
    addOns,
    pricing,
    payment: seed.payment ?? { method: "card", status: "paid" },
    status: seed.status,
    source: seed.source ?? "Direct",
    roomNo: seed.roomNo,
    createdAt: `${addDays(checkIn, -randomInt(7, 60, seed.id))}T09:${String(randomInt(10, 59, `${seed.id}-m`)).padStart(2, "0")}:00`,
    cancellation,
    notes: seed.notes,
  }
}

export const bookings: Booking[] = seeds
  .map(build)
  .sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1))

/** Bookings belonging to the signed-in customer. */
export const customerBookings = bookings.filter((b) => b.guest.email === userProfile.email)

/** Bookings at hotels the signed-in partner manages. */
export const partnerBookings = bookings.filter((b) =>
  (PARTNER_ORG.hotelIds as readonly string[]).includes(b.hotelId)
)

/** Sanity check kept next to the data: every booking must resolve to a hotel. */
export const orphanBookings = bookings.filter((b) => !hotels.some((h) => h.id === b.hotelId))
