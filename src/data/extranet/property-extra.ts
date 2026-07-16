import type { AmenityGroup } from "@/lib/extranet/types"

export const facilityGroups: AmenityGroup[] = [
  {
    category: "General",
    icon: "BadgeCheck",
    items: [
      { name: "Free WiFi", enabled: true },
      { name: "Air conditioning", enabled: true },
      { name: "Elevator", enabled: true },
      { name: "24h reception", enabled: true },
      { name: "Non-smoking rooms", enabled: true },
      { name: "Family rooms", enabled: false },
      { name: "Express check-in", enabled: true },
      { name: "Soundproof rooms", enabled: false },
    ],
  },
  {
    category: "Pool & Wellness",
    icon: "Activity",
    items: [
      { name: "Outdoor pool", enabled: true },
      { name: "Indoor pool", enabled: false },
      { name: "Spa", enabled: true },
      { name: "Sauna", enabled: true },
      { name: "Hot tub", enabled: true },
      { name: "Massage", enabled: true },
      { name: "Fitness center", enabled: true },
      { name: "Steam room", enabled: false },
    ],
  },
  {
    category: "Food & Drink",
    icon: "Sparkles",
    items: [
      { name: "Restaurant", enabled: true },
      { name: "Bar", enabled: true },
      { name: "Room service", enabled: true },
      { name: "Breakfast", enabled: true },
      { name: "Minibar", enabled: true },
      { name: "Coffee shop", enabled: false },
      { name: "Wine bar", enabled: false },
      { name: "Poolside snacks", enabled: false },
    ],
  },
  {
    category: "Internet",
    icon: "Wifi",
    items: [
      { name: "Free WiFi in rooms", enabled: true },
      { name: "Free WiFi in public areas", enabled: true },
      { name: "Wired internet", enabled: false },
      { name: "High-speed business line", enabled: false },
      { name: "In-room ethernet", enabled: false },
    ],
  },
  {
    category: "Parking & Transport",
    icon: "Building2",
    items: [
      { name: "Valet parking", enabled: true },
      { name: "Self parking", enabled: true },
      { name: "Airport shuttle", enabled: true },
      { name: "EV charging", enabled: false },
      { name: "Car rental", enabled: false },
      { name: "Bicycle rental", enabled: false },
    ],
  },
  {
    category: "Entertainment",
    icon: "Star",
    items: [
      { name: "Flat-screen TV", enabled: true },
      { name: "Streaming services", enabled: true },
      { name: "Live music", enabled: false },
      { name: "Game room", enabled: false },
      { name: "Library", enabled: true },
      { name: "Nightclub", enabled: false },
    ],
  },
]

/* --------------------------- Reservation Policies ---------------------- */
