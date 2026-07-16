import type { GuestComm, Message, SupportTicket } from "@/lib/extranet/types"

/* ------------------------------- Support ------------------------------- */

export const supportTickets: SupportTicket[] = [
  {
    id: "SUP-002",
    subject: "AC not working in room 305",
    guest: "Ava Thompson",
    category: "Maintenance",
    priority: "High",
    status: "Open",
    updated: "4 hours ago",
    preview: "The air conditioning in room 305 isn't cooling.",
    seed: "ava-thompson",
  },
  {
    id: "SUP-001",
    subject: "Billing discrepancy on invoice",
    guest: "Olivia Williams",
    category: "Billing",
    priority: "Medium",
    status: "Resolved",
    updated: "2 days ago",
    preview: "I was charged twice for invoice STY-INV-0588.",
    seed: "olivia-williams",
  },
]

export const supportThreads: Record<string, Message[]> = {
  "SUP-002": [
    { id: "s2m1", from: "guest", text: "The air conditioning in room 305 isn't cooling.", time: "Today 8:05 AM" },
    { id: "s2m2", from: "host", text: "Sorry about that — our maintenance team is on the way and will arrive within the hour.", time: "Today 8:12 AM" },
  ],
  "SUP-001": [
    { id: "s1m1", from: "guest", text: "I was charged twice for invoice STY-INV-0588. Can you check?", time: "Mon 10:14 AM" },
    { id: "s1m2", from: "host", text: "Thanks Olivia — we've located the duplicate charge and issued a refund.", time: "Mon 11:02 AM" },
    { id: "s1m3", from: "guest", text: "Received, thank you!", time: "Mon 11:20 AM" },
  ],
}

export const supportStats = {
  total: supportTickets.length,
  open: supportTickets.filter((t) => t.status === "Open").length,
  resolved: supportTickets.filter((t) => t.status === "Resolved").length,
}

export const guestCommunications: GuestComm[] = [
  { id: "gc1", guest: "Emma Richardson", stayStatus: "In-Stay", message: "Thank you! Looking forward to our stay.", property: "The Ritz-Carlton", room: "Deluxe Ocean Suite · 301", channel: "Direct", time: "2m ago", messages: 5, seed: "emma-richardson" },
  { id: "gc2", guest: "James Chen", stayStatus: "Pre-Arrival", message: "Is early check-in possible on the 15th?", property: "Four Seasons", room: "Premium King · 205", channel: "Booking.com", time: "18m ago", messages: 3, seed: "james-chen" },
  { id: "gc3", guest: "Sofia Martinez", stayStatus: "Pre-Arrival", message: "Great, see you then. Thank you!", property: "One&Only", room: "Standard Room · 118", channel: "Expedia", time: "1h ago", messages: 4, seed: "sofia-martinez" },
  { id: "gc4", guest: "Liam O'Brien", stayStatus: "In-Stay", message: "Could we get a crib added to the room?", property: "The Ritz-Carlton", room: "Family Suite · 402", channel: "Direct", time: "3h ago", messages: 6, seed: "liam-obrien" },
  { id: "gc5", guest: "Yuki Tanaka", stayStatus: "Post-Stay", message: "The welcome amenities were lovely.", property: "Aman Tokyo", room: "Penthouse Suite · 801", channel: "Travel Agency", time: "5h ago", messages: 8, seed: "yuki-tanaka" },
  { id: "gc6", guest: "Mateo Silva", stayStatus: "In-Stay", message: "Planning to check out late, is that ok?", property: "Four Seasons", room: "Premium King · 210", channel: "Direct", time: "Yesterday", messages: 4, seed: "mateo-silva" },
  { id: "gc7", guest: "Camille Lefevre", stayStatus: "Pre-Arrival", message: "We'd love a high floor if possible.", property: "The Ritz-Carlton", room: "Family Suite · 410", channel: "Direct", time: "Yesterday", messages: 2, seed: "camille-lefevre" },
]
