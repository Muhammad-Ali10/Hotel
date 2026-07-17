// Shared shape for the whole partner-registration wizard. One flat object lives
// in context (see wizard-provider) and every step reads/writes a slice of it.

export type PropertyType =
  | "hotel"
  | "resort"
  | "guesthouse"
  | "hostel"
  | "apartment"
  | "villa"
  | "bnb"
  | "motel"

export type CancellationPolicy = "flexible" | "moderate" | "strict" | "non-refundable"

export type RoomTypeDraft = {
  id: string
  name: string
  bedType: string
  maxGuests: number
  count: number
}

/** A single unit the partner adds from the setup hub (steps 14–19). */
export type UnitDraft = {
  unitType: string
  unitCount: number
  beds: { twin: number; full: number; queen: number; king: number }
  guests: number
  size: string
  smoking: boolean
  amenities: string[]
  bathroomPrivate: boolean | null
  bathroomItems: string[]
  name: string
  price: number
  ratePlan: { enabled: boolean; discount: number }
}

export type RegistrationData = {
  // Account (steps 1–4)
  email: string
  firstName: string
  lastName: string
  phone: string
  verified: boolean

  // Property basics (steps 5–7)
  propertyName: string
  propertyType: PropertyType | null
  street: string
  city: string
  state: string
  zip: string
  country: string
  roomTypes: RoomTypeDraft[]

  // Property details (steps 8–12)
  amenities: string[]
  photos: number
  baseRate: number
  weekendPricing: boolean
  weekendMarkup: number
  checkInFrom: string
  checkOutBy: string
  cancellationPolicy: CancellationPolicy | null
  houseRules: string[]

  // Payout (step 12)
  payoutCurrency: string
  accountHolder: string
  bankName: string
  iban: string
  swift: string

  // Units (steps 14–19). `draftUnit` is the one currently being built through
  // the unit sub-flow; it's committed into `units` at the rate-plan step.
  units: UnitDraft[]
  draftUnit: UnitDraft

  // Final steps (21–31)
  paymentMethod: "platform" | "property" | null
  invoiceNameType: "personal" | "property" | "company"
  invoiceAddressSame: boolean
  cancelFreeUntil: string
  cancelCharge: "first-night" | "full"
  ownerType: "individual" | "business"
  hostType: "private" | "professional" | null
  contractType: "individual" | "business" | null
  agreedToTerms: boolean
}

export function newUnit(): UnitDraft {
  return {
    unitType: "Room",
    unitCount: 1,
    beds: { twin: 0, full: 0, queen: 1, king: 0 },
    guests: 2,
    size: "",
    smoking: false,
    amenities: [],
    bathroomPrivate: null,
    bathroomItems: [],
    name: "",
    price: 0,
    ratePlan: { enabled: false, discount: 10 },
  }
}

export const initialData: RegistrationData = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  verified: false,

  propertyName: "",
  propertyType: null,
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "Pakistan",
  roomTypes: [
    { id: "rt-1", name: "", bedType: "Double", maxGuests: 2, count: 1 },
  ],

  amenities: [],
  photos: 0,
  baseRate: 0,
  weekendPricing: false,
  weekendMarkup: 20,
  checkInFrom: "14:00",
  checkOutBy: "12:00",
  cancellationPolicy: null,
  houseRules: [],

  payoutCurrency: "PKR",
  accountHolder: "",
  bankName: "",
  iban: "",
  swift: "",

  units: [],
  draftUnit: newUnit(),

  paymentMethod: null,
  invoiceNameType: "property",
  invoiceAddressSame: true,
  cancelFreeUntil: "6pm-arrival",
  cancelCharge: "first-night",
  ownerType: "individual",
  hostType: null,
  contractType: null,
  agreedToTerms: false,
}
