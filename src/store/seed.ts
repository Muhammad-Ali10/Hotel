import type {
  AppNotification,
  Booking,
  Hotel,
  Promotion,
  Review,
  SupportTicket,
  UserProfile,
  UserSettings,
} from "@/types"
import { activeDiscountFor } from "@/lib/domain"
import { TODAY } from "@/data/config"
import { hotels } from "@/data/hotels"
import { reviews } from "@/data/reviews"
import { bookings } from "@/data/bookings"
import { promotions } from "@/data/promotions"
import { notifications } from "@/data/notifications"
import { tickets } from "@/data/tickets"
import { userProfile, userSettings } from "@/data/profile"
import { currentUser, teamUsers } from "@/data/extranet/team"
import { notificationSettings, securitySettings } from "@/data/extranet/account"
import type { TeamUser, ToggleSetting } from "@/lib/extranet/types"

export type PartnerProfile = {
  name: string
  role: string
  email: string
  phone: string
  company: string
  location: string
  seed: string
}

export type AppState = {
  hotels: Hotel[]
  reviews: Review[]
  bookings: Booking[]
  promotions: Promotion[]
  notifications: AppNotification[]
  tickets: SupportTicket[]
  favorites: string[]
  profile: UserProfile
  settings: UserSettings
  /** The signed-in partner user and their team — editable in the extranet. */
  partner: PartnerProfile
  team: TeamUser[]
  partnerSettings: ToggleSetting[]
}

/**
 * Applies every active, public-channel promotion to its hotels. This is why a
 * discount badge can appear on the public site at all: the partner switches a
 * promotion on, and the catalogue derives the badge from it.
 */
export function applyPromotions(hotels: Hotel[], promotions: Promotion[], today: string): Hotel[] {
  return hotels.map((hotel) => {
    const discount = activeDiscountFor(hotel.id, promotions, today)
    if (!discount && !hotel.discount) return hotel
    return { ...hotel, discount }
  })
}

/**
 * The initial state. Pure and deterministic — the same object on the server and
 * on the client, which is what keeps hydration stable before the persisted
 * state is merged in.
 */
export function buildSeed(): AppState {
  return {
    hotels: applyPromotions(hotels, promotions, TODAY),
    reviews,
    bookings,
    promotions,
    notifications,
    tickets,
    favorites: ["burj-al-arab", "aman-tokyo", "one-and-only", "six-senses"],
    profile: userProfile,
    settings: userSettings,
    partner: currentUser,
    team: teamUsers,
    partnerSettings: [...notificationSettings, ...securitySettings],
  }
}
