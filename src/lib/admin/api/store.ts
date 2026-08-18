/**
 * In-memory mutable store.
 *
 * The fixtures in `src/data/admin/*` are the immutable seed; this module holds
 * the working copy that mutations write to, so approving a property or
 * suspending a guest persists for the lifetime of the session and every screen
 * reading through react-query sees the change.
 *
 * A real backend replaces this file entirely — `endpoints.ts` is the only
 * consumer.
 */

import {
  adminBillingInvoices,
  adminCancellations,
  adminClients,
  adminCommissionInvoices,
  adminContent,
  adminGuests,
  adminIntegrations,
  adminManagers,
  adminNotifications,
  adminPayouts,
  adminPromotions,
  adminProperties,
  adminReservations,
  adminReviews,
  adminThreads,
  defaultPlatformSettings,
} from "@/data/admin"
import { propertyDetail } from "@/data/admin"
import type {
  AdminNotification,
  PropertyDetail,
  BillingInvoice,
  Cancellation,
  Client,
  CommissionInvoice,
  ContentItem,
  Guest,
  InboxThread,
  Integration,
  Manager,
  Payout,
  PlatformSettings,
  Promotion,
  Property,
  Reservation,
  Review,
} from "@/lib/admin/types"

export type AdminDb = {
  clients: Client[]
  guests: Guest[]
  properties: Property[]
  managers: Manager[]
  reservations: Reservation[]
  cancellations: Cancellation[]
  threads: InboxThread[]
  reviews: Review[]
  payouts: Payout[]
  commissionInvoices: CommissionInvoice[]
  content: ContentItem[]
  promotions: Promotion[]
  billingInvoices: BillingInvoice[]
  integrations: Integration[]
  notifications: AdminNotification[]
  settings: PlatformSettings
  /**
   * Approval decisions, keyed by property id. `Property` has no decision field
   * — it lives here so `transition()` can record who decided what and when,
   * and the detail screen can show it back.
   */
  propertyDecisions: Record<string, PropertyDetail["decision"]>
}

/** Deep-enough clone: every array gets fresh objects so seeds stay pristine. */
function seed(): AdminDb {
  return {
    clients: adminClients.map((x) => ({ ...x })),
    guests: adminGuests.map((x) => ({ ...x })),
    properties: adminProperties.map((x) => ({ ...x })),
    managers: adminManagers.map((x) => ({ ...x, propertyIds: [...x.propertyIds] })),
    reservations: adminReservations.map((x) => ({ ...x })),
    cancellations: adminCancellations.map((x) => ({ ...x })),
    threads: adminThreads.map((x) => ({
      ...x,
      messages: x.messages.map((m) => ({ ...m })),
    })),
    reviews: adminReviews.map((x) => ({ ...x })),
    payouts: adminPayouts.map((x) => ({ ...x })),
    commissionInvoices: adminCommissionInvoices.map((x) => ({ ...x })),
    content: adminContent.map((x) => ({ ...x })),
    promotions: adminPromotions.map((x) => ({ ...x, propertyIds: [...x.propertyIds] })),
    billingInvoices: adminBillingInvoices.map((x) => ({ ...x })),
    integrations: adminIntegrations.map((x) => ({ ...x })),
    notifications: adminNotifications.map((x) => ({ ...x })),
    settings: {
      general: { ...defaultPlatformSettings.general },
      plans: { ...defaultPlatformSettings.plans },
    },
    propertyDecisions: adminProperties.reduce<
      Record<string, PropertyDetail["decision"]>
    >((acc, property) => {
      acc[property.id] = propertyDetail(property.id)?.decision ?? null
      return acc
    }, {}),
  }
}

export const db: AdminDb = seed()

/** Test/dev helper — restores every table to its seeded state. */
export function resetDb() {
  Object.assign(db, seed())
}
