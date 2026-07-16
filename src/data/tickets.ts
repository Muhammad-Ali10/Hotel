import type { SupportTicket } from "@/types"
import { addDays } from "@/lib/domain"
import { TODAY } from "./config"
import { userProfile } from "./profile"
import { partnerProfile } from "./profile"

/**
 * Support tickets. Every support form in the product (public, dashboard, and
 * the extranet's Generate Ticket dialog) appends to this list, and every ticket
 * list reads it — previously the forms submitted into nothing and the extranet
 * showed a fixed list that never grew.
 */
export const tickets: SupportTicket[] = [
  {
    id: "TKT-1042",
    subject: "Invoice for my Aman Tokyo stay",
    category: "Billing",
    priority: "medium",
    status: "resolved",
    createdBy: "customer",
    author: `${userProfile.firstName} ${userProfile.lastName}`,
    email: userProfile.email,
    hotelId: "aman-tokyo",
    bookingId: "STY-2HD8VN",
    createdAt: `${addDays(TODAY, -34)}T11:20:00`,
    updatedAt: `${addDays(TODAY, -33)}T09:05:00`,
    seed: "tkt-1042",
    messages: [
      {
        id: "m1",
        from: "user",
        author: userProfile.firstName,
        text: "Could you send a VAT invoice for reference STY-2HD8VN? I need it for an expense claim.",
        date: `${addDays(TODAY, -34)}T11:20:00`,
      },
      {
        id: "m2",
        from: "support",
        author: "Stayora Support",
        text: "Of course — the invoice is attached and also available under Bookings → Invoice. Anything else we can help with?",
        date: `${addDays(TODAY, -33)}T09:05:00`,
      },
    ],
  },
  {
    id: "TKT-1088",
    subject: "Anniversary request for my upcoming stay",
    category: "Booking",
    priority: "low",
    status: "in_progress",
    createdBy: "customer",
    author: `${userProfile.firstName} ${userProfile.lastName}`,
    email: userProfile.email,
    hotelId: "the-ritz-carlton",
    bookingId: "STY-4K7QM2",
    createdAt: `${addDays(TODAY, -2)}T15:40:00`,
    updatedAt: `${addDays(TODAY, -1)}T10:12:00`,
    seed: "tkt-1088",
    messages: [
      {
        id: "m1",
        from: "user",
        author: userProfile.firstName,
        text: "We are celebrating our anniversary — is a park-view room possible for STY-4K7QM2?",
        date: `${addDays(TODAY, -2)}T15:40:00`,
      },
      {
        id: "m2",
        from: "support",
        author: "Stayora Support",
        text: "We have passed this to the property and flagged it on your reservation. They will confirm the room type closer to arrival.",
        date: `${addDays(TODAY, -1)}T10:12:00`,
      },
    ],
  },
  {
    id: "TKT-2015",
    subject: "Rate parity mismatch on Expedia",
    category: "Connectivity",
    priority: "high",
    status: "open",
    createdBy: "partner",
    author: partnerProfile.name,
    email: partnerProfile.email,
    hotelId: "the-ritz-carlton",
    createdAt: `${addDays(TODAY, -1)}T08:30:00`,
    updatedAt: `${addDays(TODAY, -1)}T08:30:00`,
    seed: "tkt-2015",
    messages: [
      {
        id: "m1",
        from: "user",
        author: partnerProfile.name,
        text: "Our Deluxe King rate is showing lower on Expedia than the rate we pushed. Can someone check the channel mapping?",
        date: `${addDays(TODAY, -1)}T08:30:00`,
      },
    ],
  },
  {
    id: "TKT-2021",
    subject: "Adding a second payout account",
    category: "Finance",
    priority: "medium",
    status: "in_progress",
    createdBy: "partner",
    author: partnerProfile.name,
    email: partnerProfile.email,
    createdAt: `${addDays(TODAY, -5)}T13:15:00`,
    updatedAt: `${addDays(TODAY, -4)}T16:40:00`,
    seed: "tkt-2021",
    messages: [
      {
        id: "m1",
        from: "user",
        author: partnerProfile.name,
        text: "We would like payouts for Four Seasons Paris to go to a separate EUR account. What do you need from us?",
        date: `${addDays(TODAY, -5)}T13:15:00`,
      },
      {
        id: "m2",
        from: "support",
        author: "Stayora Partner Support",
        text: "We can do that. Please upload a bank confirmation letter for the new account under Account → Compliance and we will verify within two working days.",
        date: `${addDays(TODAY, -4)}T16:40:00`,
      },
    ],
  },
]
