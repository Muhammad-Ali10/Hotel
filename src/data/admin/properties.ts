import type { Property, PropertyDetail, TaxRule } from "@/lib/admin/types"
import { hotelImage } from "@/lib/images"

/**
 * The master property list — 12 properties across the 6 clients. Every other
 * screen references these by `id`, so client property-counts, analytics rows
 * and finance rows all derive from this one array.
 *
 * Star ratings are real values, not the uniform ★★★★★ the Figma rendered for
 * every row regardless of the property.
 */
export const adminProperties: Property[] = [
  {
    id: "HTL-1001",
    name: "Grand Horizon",
    clientId: "CLI-001",
    city: "Malibu",
    country: "United States",
    stars: 5,
    rooms: 85,
    status: "Active",
    occupancy: 78,
    adr: 389,
    revenueToday: 4_862,
    seed: "htl1001",
  },
  {
    id: "HTL-1002",
    name: "The Metropolitan",
    clientId: "CLI-002",
    city: "Chicago",
    country: "United States",
    stars: 5,
    rooms: 120,
    status: "Active",
    occupancy: 85,
    adr: 275,
    revenueToday: 3_850,
    seed: "htl1002",
  },
  {
    id: "HTL-1003",
    name: "Alpine Lodge Zermatt",
    clientId: "CLI-003",
    city: "Zermatt",
    country: "Switzerland",
    stars: 5,
    rooms: 60,
    status: "Active",
    occupancy: 62,
    adr: 520,
    revenueToday: 6_720,
    seed: "htl1003",
  },
  {
    id: "HTL-1004",
    name: "Casa del Mar",
    clientId: "CLI-004",
    city: "Tulum",
    country: "Mexico",
    stars: 4,
    rooms: 42,
    status: "Active",
    occupancy: 58,
    adr: 210,
    revenueToday: 1_690,
    seed: "htl1004",
  },
  {
    id: "HTL-1005",
    name: "Sakura Ryokan",
    clientId: "CLI-004",
    city: "Kyoto",
    country: "Japan",
    stars: 5,
    rooms: 28,
    status: "Active",
    occupancy: 71,
    adr: 450,
    revenueToday: 4_750,
    seed: "htl1005",
  },
  {
    id: "HTL-1006",
    name: "Seaside Haven Resort",
    clientId: "CLI-002",
    city: "Brighton",
    country: "United Kingdom",
    stars: 4,
    rooms: 95,
    status: "Active",
    occupancy: 80,
    adr: 290,
    revenueToday: 3_250,
    seed: "htl1006",
  },
  {
    id: "HTL-1007",
    name: "Mountain Peak Resort",
    clientId: "CLI-003",
    city: "St. Moritz",
    country: "Switzerland",
    stars: 5,
    rooms: 55,
    status: "Pending",
    occupancy: 0,
    adr: 680,
    revenueToday: 0,
    seed: "htl1007",
  },
  {
    id: "HTL-1008",
    name: "City Central Inn",
    clientId: "CLI-002",
    city: "Manchester",
    country: "United Kingdom",
    stars: 3,
    rooms: 150,
    status: "Active",
    occupancy: 90,
    adr: 165,
    revenueToday: 2_180,
    seed: "htl1008",
  },
  {
    id: "HTL-1009",
    name: "Desert Rose Resort",
    clientId: "CLI-005",
    city: "Dubai",
    country: "UAE",
    stars: 5,
    rooms: 200,
    status: "Active",
    occupancy: 65,
    adr: 420,
    revenueToday: 10_500,
    seed: "htl1009",
  },
  {
    id: "HTL-1010",
    name: "La Villa Toscana",
    clientId: "CLI-006",
    city: "Florence",
    country: "Italy",
    stars: 4,
    rooms: 35,
    status: "Suspended",
    occupancy: 0,
    adr: 310,
    revenueToday: 0,
    seed: "htl1010",
  },
  {
    id: "HTL-1011",
    name: "The Pearl Suite Hotel",
    clientId: "CLI-001",
    city: "Santa Barbara",
    country: "United States",
    stars: 5,
    rooms: 48,
    status: "Draft",
    occupancy: 0,
    adr: 425,
    revenueToday: 0,
    seed: "htl1011",
  },
  {
    id: "HTL-1012",
    name: "Lakeview Boutique Hotel",
    clientId: "CLI-003",
    city: "Lucerne",
    country: "Switzerland",
    stars: 4,
    rooms: 40,
    status: "Active",
    occupancy: 68,
    adr: 340,
    revenueToday: 2_960,
    seed: "htl1012",
  },
]

export function propertyById(id: string) {
  return adminProperties.find((p) => p.id === id)
}

export function propertyName(id: string) {
  return propertyById(id)?.name ?? "Unknown property"
}

export function propertiesForClient(clientId: string) {
  return adminProperties.filter((p) => p.clientId === clientId)
}

/**
 * Platform-level tax rules. Invoices pick the rule matching the property's
 * country, replacing the Figma's orphaned flat "GST (16%)".
 */
export const adminTaxRules: TaxRule[] = [
  {
    id: "TAX-US",
    name: "US VAT / GST",
    rate: "10%",
    appliesTo: "Room rate + services",
    includedIn: "Displayed price",
    scope: "Country-level",
    status: "Active",
    country: "United States",
  },
  {
    id: "TAX-UK",
    name: "UK VAT",
    rate: "20%",
    appliesTo: "Room rate + services",
    includedIn: "Displayed price",
    scope: "Country-level",
    status: "Active",
    country: "United Kingdom",
  },
  {
    id: "TAX-CH",
    name: "Swiss VAT",
    rate: "7.7%",
    appliesTo: "Room rate only",
    includedIn: "Displayed price",
    scope: "Country-level",
    status: "Active",
    country: "Switzerland",
  },
  {
    id: "TAX-JP",
    name: "Japan Consumption Tax",
    rate: "10%",
    appliesTo: "Total booking",
    includedIn: "Displayed price",
    scope: "Country-level",
    status: "Active",
    country: "Japan",
  },
  {
    id: "TAX-AE",
    name: "UAE VAT",
    rate: "5%",
    appliesTo: "Room rate + services",
    includedIn: "Displayed price",
    scope: "Country-level",
    status: "Active",
    country: "UAE",
  },
  {
    id: "TAX-MX",
    name: "Mexico IVA",
    rate: "16%",
    appliesTo: "Room rate + services",
    includedIn: "Displayed price",
    scope: "Country-level",
    status: "Active",
    country: "Mexico",
  },
  {
    id: "TAX-IT",
    name: "Italy IVA",
    rate: "10%",
    appliesTo: "Room rate + services",
    includedIn: "Displayed price",
    scope: "Country-level",
    status: "Active",
    country: "Italy",
  },
  {
    id: "TAX-CITY-CHI",
    name: "City Tax — Chicago",
    rate: "$4.50/night",
    appliesTo: "Per room, per night",
    includedIn: "Added at checkout",
    scope: "City-level",
    status: "Active",
    country: "United States",
  },
  {
    id: "TAX-RESORT",
    name: "Resort Fee Premium",
    rate: "$25/night",
    appliesTo: "Per room, per night",
    includedIn: "Added at checkout",
    scope: "Platform-wide",
    status: "Active",
    country: null,
  },
]

/** The percentage tax rule that applies to a property, for invoicing. */
export function taxRuleForCountry(country: string) {
  return (
    adminTaxRules.find(
      (t) => t.country === country && t.rate.endsWith("%")
    ) ?? adminTaxRules[0]
  )
}

const ROOM_TYPE_TEMPLATES = [
  {
    name: "Standard Room",
    description:
      "Cozy room with garden views, perfect for solo travellers or couples.",
    bed: "Queen",
    guests: 2,
    size: "32 m²",
    priceFactor: 0.49,
    unitShare: 0.32,
    occupancyFactor: 0.4,
    view: "Garden",
  },
  {
    name: "Premium King",
    description: "Spacious room with king bed and partial ocean views.",
    bed: "King",
    guests: 2,
    size: "45 m²",
    priceFactor: 0.9,
    unitShare: 0.27,
    occupancyFactor: 0.68,
    view: "Partial Ocean",
  },
  {
    name: "Deluxe Suite",
    description: "Luxurious suite with panoramic views and a private terrace.",
    bed: "King",
    guests: 3,
    size: "68 m²",
    priceFactor: 1.22,
    unitShare: 0.17,
    occupancyFactor: 0.79,
    view: "Full Ocean",
  },
  {
    name: "Family Suite",
    description:
      "Two-bedroom suite designed for families with kid-friendly amenities.",
    bed: "King + 2 Twins",
    guests: 5,
    size: "85 m²",
    priceFactor: 1.39,
    unitShare: 0.13,
    occupancyFactor: 0.83,
    view: "Garden",
  },
  {
    name: "Penthouse Suite",
    description:
      "Top-floor suite with panoramic views, Jacuzzi, and butler service.",
    bed: "California King",
    guests: 4,
    size: "140 m²",
    priceFactor: 3.29,
    unitShare: 0.11,
    occupancyFactor: 0.83,
    view: "Panoramic",
  },
]

const DETAIL_OVERRIDES: Record<
  string,
  Partial<
    Pick<
      PropertyDetail,
      | "type"
      | "floors"
      | "yearBuilt"
      | "lastRenovated"
      | "address"
      | "description"
      | "decision"
      | "verification"
    >
  >
> = {
  "HTL-1001": {
    type: "Luxury Beachfront Resort",
    floors: 8,
    yearBuilt: 2018,
    lastRenovated: 2024,
    address: "28420 Pacific Coast Highway, Malibu, CA 90265, United States",
    description:
      "Grand Horizon is a premier luxury beachfront resort perched on the iconic Malibu coastline. With 85 meticulously designed rooms and suites, the property offers an unparalleled blend of modern sophistication and coastal serenity.",
  },
  "HTL-1007": {
    type: "Alpine Ski Resort",
    floors: 5,
    yearBuilt: 2021,
    lastRenovated: 2021,
    address: "Via Serlas 12, 7500 St. Moritz, Switzerland",
    description:
      "A new luxury destination in St. Moritz, submitted for platform review. Ski-in/ski-out access, a two-level spa, and 55 suites facing the Engadin valley.",
    verification: {
      status: "Submitted",
      submittedBy: "Alpine Resorts AG (Hans Meier)",
      uploadedAt: "2026-07-28",
      duration: "4:32",
    },
  },
  "HTL-1010": {
    type: "Historic Boutique Villa",
    floors: 3,
    yearBuilt: 1904,
    lastRenovated: 2019,
    address: "Via dei Renai 8, 50125 Florence, Italy",
    description:
      "A restored Tuscan villa overlooking the Arno. Suspended pending resolution of an outstanding platform invoice.",
  },
}

/**
 * Builds the full detail record for a property, deriving what it can.
 *
 * Pass `override` with the live row from the mutable store so derived fields
 * (room occupancy, decision state) reflect mutations. Without it everything
 * derives from the immutable seed and freezes at its initial status.
 */
export function propertyDetail(
  id: string,
  liveBase?: Property
): PropertyDetail | undefined {
  const base = liveBase ?? propertyById(id)
  if (!base) return undefined

  const override = DETAIL_OVERRIDES[id] ?? {}
  const slug = base.name.toLowerCase().replace(/[^a-z]+/g, "")

  const roomTypes = ROOM_TYPE_TEMPLATES.map((t, i) => {
    const units = Math.max(2, Math.round(base.rooms * t.unitShare))
    return {
      id: `${id}-RT${i + 1}`,
      name: t.name,
      description: t.description,
      bed: t.bed,
      guests: t.guests,
      size: t.size,
      basePrice: Math.round((base.adr * t.priceFactor) / 5) * 5,
      units,
      booked: Math.round(units * t.occupancyFactor * (base.occupancy / 78)),
      view: t.view,
    }
  })

  const countryRule = adminTaxRules.filter(
    (t) => t.country === base.country || t.country === null
  )

  return {
    ...base,
    type: override.type ?? "Luxury Hotel",
    floors: override.floors ?? Math.max(3, Math.ceil(base.rooms / 20)),
    yearBuilt: override.yearBuilt ?? 2015,
    lastRenovated: override.lastRenovated ?? 2023,
    checkIn: "15:00",
    checkOut: "12:00",
    address: override.address ?? `${base.city}, ${base.country}`,
    description:
      override.description ??
      `${base.name} is a ${base.stars}-star property in ${base.city}, ${base.country}, offering ${base.rooms} rooms and suites to Stayora guests.`,
    phone: "+1 (310) 555-0101",
    email: `reservations@${slug}.com`,
    website: `www.${slug}.com`,
    emergency: "+1 (310) 555-0199",
    verification:
      override.verification ??
      ({
        status: base.status === "Draft" ? "Not Submitted" : "Reviewed",
        submittedBy: base.clientId,
        uploadedAt: "2026-06-02",
        duration: "3:18",
      } as PropertyDetail["verification"]),
    decision:
      override.decision ??
      (base.status === "Pending" || base.status === "Draft"
        ? null
        : {
            by: "Ahmed Khan",
            at: "2026-06-15",
            note:
              base.status === "Suspended"
                ? "Suspended pending payment of invoice INV-0623."
                : undefined,
          }),
    photos: Array.from({ length: 4 }, (_, i) =>
      hotelImage(`${base.seed}-${i}`, 800, 600)
    ),
    roomTypes,
    taxRules: countryRule,
  }
}
