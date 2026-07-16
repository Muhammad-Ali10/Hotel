import type { UserProfile, UserSettings } from "@/types"

/**
 * The signed-in customer. One identity, used by the dashboard chrome, the
 * profile screen, checkout prefill, and as the author of their own reviews —
 * previously each surface had its own idea of who the user was.
 */
export const userProfile: UserProfile = {
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  phone: "+1 (555) 014-2389",
  country: "United States",
  city: "New York",
  avatarSeed: "john-doe",
  membership: "Gold Member",
  points: 12450,
  joined: "2024-01-18",
  preferences: ["Luxury", "City", "Spa"],
}

export const userSettings: UserSettings = {
  emailNotifications: true,
  smsNotifications: false,
  marketing: true,
  twoFactor: false,
  currency: "USD",
  language: "English",
}

/** The signed-in partner user in the extranet. */
export const partnerProfile = {
  id: "sarah-mitchell",
  name: "Sarah Mitchell",
  email: "sarah.mitchell@aurorahospitality.com",
  role: "General Manager",
  org: "Aurora Hospitality",
  location: "New York, USA",
  seed: "sarah-mitchell",
}
