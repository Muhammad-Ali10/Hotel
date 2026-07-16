import type { Hotel, Photo, PropertyType, Room } from "@/types"
import { defaultPolicies, defaultTaxLines, PARTNER_ORG, resortTaxLines, defaultValueAdds } from "./config"
import { addDays } from "@/lib/domain"
import { TODAY } from "./config"

/* ----------------------------------------------------------------- rooms -- */

type RoomTemplate = {
  id: string
  name: string
  description: string
  guests: number
  bed: string
  size: number
  /** multiplier applied to the hotel's base rate */
  rate: number
  units: number
  features: string[]
}

const hotelRooms: RoomTemplate[] = [
  {
    id: "standard",
    name: "Standard Room",
    description: "A calm, well-proportioned room with everything you need for a short stay.",
    guests: 2,
    bed: "1 Queen Bed",
    size: 32,
    rate: 1,
    units: 40,
    features: ["City View", "Free WiFi", "Smart TV", "Work Desk"],
  },
  {
    id: "deluxe-king",
    name: "Deluxe King Room",
    description: "Extra space, a deeper soaking tub, and a seating nook by the window.",
    guests: 2,
    bed: "1 King Bed",
    size: 45,
    rate: 1.25,
    units: 28,
    features: ["City View", "Free WiFi", "Smart TV", "Nespresso Machine", "Rain Shower"],
  },
  {
    id: "premium-king",
    name: "Premium King Room",
    description: "High-floor room with panoramic glazing and lounge access included.",
    guests: 3,
    bed: "1 King Bed + Sofa",
    size: 58,
    rate: 1.5,
    units: 18,
    features: ["Skyline View", "Free WiFi", "Smart TV", "Lounge Access", "Minibar"],
  },
  {
    id: "executive-suite",
    name: "Executive Suite",
    description: "A separate living room, dining for four, and a dressing room.",
    guests: 4,
    bed: "1 King Bed + Sofa Bed",
    size: 85,
    rate: 2,
    units: 10,
    features: ["Living Room", "Free WiFi", "Smart TV", "Lounge Access", "Butler Service"],
  },
  {
    id: "penthouse-suite",
    name: "Penthouse Suite",
    description: "The top floor in its entirety — terrace, grand piano, private lift.",
    guests: 6,
    bed: "2 King Beds",
    size: 180,
    rate: 3,
    units: 2,
    features: ["Private Terrace", "Free WiFi", "Butler Service", "Private Lift", "Dining Room"],
  },
  {
    id: "accessible",
    name: "Accessible Room",
    description: "Step-free layout with a roll-in shower and lowered fittings throughout.",
    guests: 2,
    bed: "1 Queen Bed",
    size: 38,
    rate: 1,
    units: 6,
    features: ["Step-free Access", "Roll-in Shower", "Free WiFi", "Smart TV", "Grab Rails"],
  },
]

const resortRooms: RoomTemplate[] = [
  {
    id: "garden-view",
    name: "Garden View Room",
    description: "Opens onto planted gardens, moments from the main pool.",
    guests: 2,
    bed: "1 Queen Bed",
    size: 40,
    rate: 1,
    units: 30,
    features: ["Garden View", "Free WiFi", "Smart TV", "Terrace"],
  },
  {
    id: "deluxe-ocean",
    name: "Deluxe Ocean Suite",
    description: "Uninterrupted sea views from the bed, the bath, and the balcony.",
    guests: 2,
    bed: "1 King Bed",
    size: 55,
    rate: 1.3,
    units: 24,
    features: ["Ocean View", "Free WiFi", "Balcony", "Rain Shower", "Minibar"],
  },
  {
    id: "beach-villa",
    name: "Beach Villa",
    description: "Your own stretch of sand, plunge pool, and outdoor shower.",
    guests: 3,
    bed: "1 King Bed + Daybed",
    size: 95,
    rate: 1.8,
    units: 12,
    features: ["Beachfront", "Plunge Pool", "Free WiFi", "Outdoor Shower", "Butler Service"],
  },
  {
    id: "family-suite",
    name: "Family Suite",
    description: "Two bedrooms either side of a shared living space — built for four.",
    guests: 5,
    bed: "1 King Bed + 2 Twin Beds",
    size: 110,
    rate: 2.1,
    units: 8,
    features: ["Two Bedrooms", "Living Room", "Free WiFi", "Kids Amenities", "Kitchenette"],
  },
  {
    id: "presidential-villa",
    name: "Presidential Villa",
    description: "A private compound with pool, chef's kitchen, and staff quarters.",
    guests: 6,
    bed: "3 King Beds",
    size: 240,
    rate: 3.2,
    units: 2,
    features: ["Private Pool", "Chef's Kitchen", "Free WiFi", "Butler Service", "Gym"],
  },
  {
    id: "accessible",
    name: "Accessible Room",
    description: "Step-free layout with a roll-in shower and lowered fittings throughout.",
    guests: 2,
    bed: "1 Queen Bed",
    size: 42,
    rate: 1,
    units: 4,
    features: ["Step-free Access", "Roll-in Shower", "Free WiFi", "Smart TV", "Grab Rails"],
  },
]

function makeRooms(hotelSeed: string, basePrice: number, type: PropertyType): Room[] {
  const templates = type === "Resort" ? resortRooms : hotelRooms
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    guests: t.guests,
    bed: t.bed,
    size: t.size,
    features: t.features,
    pricePerNight: Math.round(basePrice * t.rate),
    units: t.units,
    seed: `${hotelSeed}-${t.id}`,
  }))
}

/* ---------------------------------------------------------------- photos -- */

const photoPlan: { category: Photo["category"]; caption: string }[] = [
  { category: "Exterior", caption: "The arrival courtyard at dusk" },
  { category: "Rooms", caption: "Deluxe King Room" },
  { category: "Interior", caption: "The lobby lounge" },
  { category: "Amenities", caption: "Indoor pool and thermal suite" },
  { category: "Dining", caption: "The signature restaurant" },
  { category: "Rooms", caption: "Suite living room" },
  { category: "Amenities", caption: "Spa treatment room" },
  { category: "Exterior", caption: "Rooftop terrace" },
]

function makePhotos(hotelSeed: string): Photo[] {
  return photoPlan.map((p, i) => ({
    id: `${hotelSeed}-photo-${i + 1}`,
    category: p.category,
    caption: p.caption,
    seed: `${hotelSeed}-${i}`,
  }))
}

/* ---------------------------------------------------------------- hotels -- */

type HotelSeed = {
  id: string
  name: string
  city: string
  country: string
  address: string
  type: PropertyType
  basePrice: number
  amenities: string[]
  description: string
  seed: string
  /** dates closed for arrival, expressed as day offsets from TODAY */
  closedOffsets?: number[]
  minStay?: number
}

const hotelSeeds: HotelSeed[] = [
  {
    id: "the-ritz-carlton",
    name: "The Ritz-Carlton",
    city: "New York",
    country: "USA",
    address: "50 Central Park South, New York, NY 10019",
    type: "Hotel",
    basePrice: 580,
    amenities: ["WiFi", "Pool", "Spa", "Parking", "Breakfast", "Gym", "Restaurant", "Bar"],
    description:
      "Overlooking Central Park from the southern edge, this is old-world New York with the corners smoothed off. Rooms face the treeline through soundproofed glass, the club lounge pours champagne from noon, and the concierge has held the same table at Le Bernardin for thirty years.",
    seed: "ritz-carlton",
    closedOffsets: [14, 15, 16],
    minStay: 1,
  },
  {
    id: "burj-al-arab",
    name: "Burj Al Arab",
    city: "Dubai",
    country: "UAE",
    address: "Jumeirah Street, Umm Suqeim 3, Dubai",
    type: "Resort",
    basePrice: 1200,
    amenities: ["WiFi", "Pool", "Spa", "Restaurant", "Bar", "Beach"],
    description:
      "A sail on its own island, reached by a private bridge. Every stay is a duplex suite with a butler on the floor, and the restaurant sits at the top of the atrium — the tallest in the world when it was built, and still the one guests photograph first.",
    seed: "burj-al-arab",
    minStay: 2,
  },
  {
    id: "aman-tokyo",
    name: "Aman Tokyo",
    city: "Tokyo",
    country: "Japan",
    address: "1-5-6 Otemachi, Chiyoda City, Tokyo 100-0004",
    type: "Hotel",
    basePrice: 890,
    amenities: ["WiFi", "Pool", "Spa", "Restaurant", "Gym"],
    description:
      "Occupying the top six floors of the Otemachi Tower, with a lobby built around a paper-and-stone atrium thirty metres high. Rooms are washi, camphor and quiet; the bath in every one looks out over the Imperial Palace gardens or the bay.",
    seed: "aman-tokyo",
    closedOffsets: [30, 31],
  },
  {
    id: "four-seasons",
    name: "Four Seasons",
    city: "Paris",
    country: "France",
    address: "31 Avenue George V, 75008 Paris",
    type: "Hotel",
    basePrice: 750,
    amenities: ["WiFi", "Pool", "Restaurant", "Bar", "Spa"],
    description:
      "Just off the Champs-Élysées, behind a courtyard that fills with flowers every Monday morning. Three restaurants hold Michelin stars between them, the marble came from the original 1928 build, and the top-floor suites open onto terraces facing the Eiffel Tower.",
    seed: "four-seasons",
  },
  {
    id: "one-and-only",
    name: "One&Only",
    city: "Maldives",
    country: "Maldives",
    address: "Reethi Rah, North Malé Atoll, Maldives",
    type: "Resort",
    basePrice: 1500,
    amenities: ["WiFi", "Pool", "Spa", "Beach", "Restaurant"],
    description:
      "Twelve beaches on one island, so there is always one facing away from the wind. Villas sit on stilts over the lagoon or back into the palms; the reef starts four metres from the deck and the seaplane lands at your jetty.",
    seed: "one-and-only",
    minStay: 3,
  },
  {
    id: "the-peninsula",
    name: "The Peninsula",
    city: "Hong Kong",
    country: "China",
    address: "Salisbury Road, Tsim Sha Tsui, Kowloon, Hong Kong",
    type: "Hotel",
    basePrice: 620,
    amenities: ["WiFi", "Pool", "Spa", "Restaurant", "Bar", "Gym"],
    description:
      "The grande dame of Kowloon, facing the harbour across Salisbury Road since 1928. A fleet of green Rolls-Royces meets the airport train, afternoon tea in the lobby still has a string quartet, and the rooftop bar looks straight at the Island skyline.",
    seed: "the-peninsula",
  },
  {
    id: "st-regis",
    name: "St. Regis",
    city: "Rome",
    country: "Italy",
    address: "Via Vittorio Emanuele Orlando 3, 00185 Rome",
    type: "Hotel",
    basePrice: 578,
    amenities: ["WiFi", "Pool", "Spa", "Restaurant", "Bar"],
    description:
      "Built by César Ritz in 1894 and restored down to the Murano chandeliers. Frescoed ceilings, a butler on every floor, and the Baths of Diocletian a two-minute walk out of the front door.",
    seed: "st-regis",
  },
  {
    id: "mandarin-oriental",
    name: "Mandarin Oriental",
    city: "Bangkok",
    country: "Thailand",
    address: "48 Oriental Avenue, Bang Rak, Bangkok 10500",
    type: "Resort",
    basePrice: 383,
    amenities: ["WiFi", "Pool", "Spa", "Restaurant", "Beach"],
    description:
      "On the Chao Phraya since 1876, with a teak Authors' Wing where Conrad and Maugham stayed. The spa is across the river and reached by the hotel's own shuttle boat, which runs every fifteen minutes until midnight.",
    seed: "mandarin-oriental",
  },
  {
    id: "the-plaza",
    name: "The Plaza",
    city: "New York",
    country: "USA",
    address: "768 5th Avenue, New York, NY 10019",
    type: "Hotel",
    basePrice: 697,
    amenities: ["WiFi", "Pool", "Restaurant", "Bar", "Gym"],
    description:
      "The corner of Fifth and Central Park South, in a French château that has been there since 1907. The Palm Court still serves tea under the stained-glass ceiling, and the Edwardian Room looks out over the horse carriages on the park side.",
    seed: "the-plaza",
  },
  {
    id: "six-senses",
    name: "Six Senses",
    city: "Ibiza",
    country: "Spain",
    address: "Cala Xarraca, Portinatx, 07810 Ibiza",
    type: "Resort",
    basePrice: 612,
    amenities: ["WiFi", "Pool", "Spa", "Beach", "Restaurant"],
    description:
      "On the quiet northern tip of the island, in a bay the party crowd never finds. Built from reclaimed stone and sabina wood, powered largely by its own solar field, with a farm behind the kitchen and a beach club that closes when the sun goes down.",
    seed: "six-senses",
  },
]

export const hotels: Hotel[] = hotelSeeds.map((s) => {
  const rooms = makeRooms(s.seed, s.basePrice, s.type)
  return {
    id: s.id,
    name: s.name,
    city: s.city,
    country: s.country,
    address: s.address,
    type: s.type,
    // the headline price is always the cheapest room — never a separate number
    pricePerNight: Math.min(...rooms.map((r) => r.pricePerNight)),
    amenities: s.amenities,
    description: s.description,
    rooms,
    policies: { ...defaultPolicies },
    taxLines: (s.type === "Resort" ? resortTaxLines : defaultTaxLines).map((t) => ({ ...t })),
    valueAdds: defaultValueAdds.map((v) => ({ ...v })),
    photos: makePhotos(s.seed),
    availability: {
      closedDates: (s.closedOffsets ?? []).map((o) => addDays(TODAY, o)),
      minStay: s.minStay ?? 1,
      rateOverrides: {},
    },
    managedBy: (PARTNER_ORG.hotelIds as readonly string[]).includes(s.id)
      ? PARTNER_ORG.id
      : undefined,
    seed: s.seed,
  }
})

export function getHotel(id: string): Hotel | undefined {
  return hotels.find((h) => h.id === id)
}

/** The hotels the signed-in partner manages in the extranet. */
export const partnerHotels = hotels.filter((h) => h.managedBy === PARTNER_ORG.id)
