import type { GuestComm } from "@/lib/extranet/types"

/* ------------------------------- Support ------------------------------- */

export const guestCommunications: GuestComm[] = [
  { id: "gc1", guest: "Emma Richardson", stayStatus: "In-Stay", message: "Thank you! Looking forward to our stay.", property: "The Ritz-Carlton", room: "Deluxe Ocean Suite · 301", channel: "Direct", time: "2m ago", messages: 5, seed: "emma-richardson" },
  { id: "gc2", guest: "James Chen", stayStatus: "Pre-Arrival", message: "Is early check-in possible on the 15th?", property: "Four Seasons", room: "Premium King · 205", channel: "Booking.com", time: "18m ago", messages: 3, seed: "james-chen" },
  { id: "gc3", guest: "Sofia Martinez", stayStatus: "Pre-Arrival", message: "Great, see you then. Thank you!", property: "One&Only", room: "Standard Room · 118", channel: "Expedia", time: "1h ago", messages: 4, seed: "sofia-martinez" },
  { id: "gc4", guest: "Liam O'Brien", stayStatus: "In-Stay", message: "Could we get a crib added to the room?", property: "The Ritz-Carlton", room: "Family Suite · 402", channel: "Direct", time: "3h ago", messages: 6, seed: "liam-obrien" },
  { id: "gc5", guest: "Yuki Tanaka", stayStatus: "Post-Stay", message: "The welcome amenities were lovely.", property: "Aman Tokyo", room: "Penthouse Suite · 801", channel: "Travel Agency", time: "5h ago", messages: 8, seed: "yuki-tanaka" },
  { id: "gc6", guest: "Mateo Silva", stayStatus: "In-Stay", message: "Planning to check out late, is that ok?", property: "Four Seasons", room: "Premium King · 210", channel: "Direct", time: "Yesterday", messages: 4, seed: "mateo-silva" },
  { id: "gc7", guest: "Camille Lefevre", stayStatus: "Pre-Arrival", message: "We'd love a high floor if possible.", property: "The Ritz-Carlton", room: "Family Suite · 410", channel: "Direct", time: "Yesterday", messages: 2, seed: "camille-lefevre" },
]
