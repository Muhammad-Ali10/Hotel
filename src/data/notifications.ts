import type { AppNotification } from "@/types"
import { addDays } from "@/lib/domain"
import { TODAY } from "./config"
import { bookings } from "./bookings"

/**
 * Notification seed. Every item points at an entity that actually exists — the
 * feeds used to reference hotels that were not in the catalogue and guests who
 * appeared nowhere else. New notifications are appended by store actions
 * (booking created, cancelled, review replied), so the bell count is live.
 */

const ritzBooking = bookings.find((b) => b.id === "STY-4K7QM2")!
const parisBooking = bookings.find((b) => b.id === "STY-9XB3RT")!
const tokyoBooking = bookings.find((b) => b.id === "STY-2HD8VN")!
const emmaBooking = bookings.find((b) => b.id === "STY-8842QA")!
const jamesBooking = bookings.find((b) => b.id === "STY-8841RB")!
const cancelledBooking = bookings.find((b) => b.id === "STY-8827EP")!

export const notifications: AppNotification[] = [
  /* ---- customer ------------------------------------------------------- */
  {
    id: "ntf-c1",
    audience: "customer",
    type: "booking",
    title: "Your stay is confirmed",
    message: `${ritzBooking.hotelName} · ${ritzBooking.roomName} · ${ritzBooking.checkIn}. Reference ${ritzBooking.id}.`,
    createdAt: `${addDays(TODAY, -2)}T10:24:00`,
    read: false,
    href: `/dashboard/bookings`,
  },
  {
    id: "ntf-c2",
    audience: "customer",
    type: "booking",
    title: "Awaiting confirmation",
    message: `${parisBooking.hotelName} still needs to confirm your ${parisBooking.checkIn} arrival. We will email you as soon as they do.`,
    createdAt: `${addDays(TODAY, -3)}T16:02:00`,
    read: false,
    href: `/dashboard/bookings`,
  },
  {
    id: "ntf-c3",
    audience: "customer",
    type: "review",
    title: "How was Aman Tokyo?",
    message: `You stayed in the ${tokyoBooking.roomName} in ${tokyoBooking.city}. Share a review to help other travellers.`,
    createdAt: `${addDays(TODAY, -30)}T09:00:00`,
    read: true,
    href: "/dashboard/reviews",
  },
  {
    id: "ntf-c4",
    audience: "customer",
    type: "offer",
    title: "20% off at St. Regis Rome",
    message: "The Early Bird promotion is live on your saved property until next month.",
    createdAt: `${addDays(TODAY, -6)}T12:30:00`,
    read: true,
    href: "/hotels/st-regis",
  },

  /* ---- partner -------------------------------------------------------- */
  {
    id: "ntf-p1",
    audience: "partner",
    type: "booking",
    title: "New reservation",
    message: `${emmaBooking.guest.firstName} ${emmaBooking.guest.lastName} booked the ${emmaBooking.roomName} at ${emmaBooking.hotelName} for ${emmaBooking.pricing.nights} nights.`,
    createdAt: `${addDays(TODAY, -1)}T08:12:00`,
    read: false,
    href: "/extranet/reservations",
  },
  {
    id: "ntf-p2",
    audience: "partner",
    type: "message",
    title: "Guest message",
    message: `${jamesBooking.guest.firstName} ${jamesBooking.guest.lastName} asked about early check-in for ${jamesBooking.id}.`,
    createdAt: `${addDays(TODAY, -1)}T14:45:00`,
    read: false,
    href: "/extranet/inbox",
  },
  {
    id: "ntf-p3",
    audience: "partner",
    type: "review",
    title: "New review awaiting reply",
    message: "A guest left a review on The Ritz-Carlton that has not been responded to yet.",
    createdAt: `${addDays(TODAY, -2)}T19:20:00`,
    read: false,
    href: "/extranet/reviews",
  },
  {
    id: "ntf-p4",
    audience: "partner",
    type: "booking",
    title: "Reservation cancelled",
    message: `${cancelledBooking.guest.firstName} ${cancelledBooking.guest.lastName} cancelled ${cancelledBooking.id} — ${cancelledBooking.hotelName}.`,
    createdAt: `${addDays(TODAY, -3)}T11:05:00`,
    read: true,
    href: "/extranet/reservations/cancellations",
  },
  {
    id: "ntf-p5",
    audience: "partner",
    type: "system",
    title: "Payout processed",
    message: "June commission statement has been settled to your registered account.",
    createdAt: `${addDays(TODAY, -8)}T07:00:00`,
    read: true,
    href: "/extranet/finance/payouts",
  },
]
