import type {
  AdminNotification,
  AuditEvent,
  BillingInvoice,
  ContentItem,
  Integration,
  PlatformSettings,
  Subscription,
} from "@/lib/admin/types"
import { COMMISSION_RATE } from "./finance"

/**
 * Eight property descriptions — 5 Approved, 1 Pending Review, 2 Flagged,
 * matching the Figma's stat tiles.
 */
export const adminContent: ContentItem[] = [
  {
    id: "CNT-001",
    propertyId: "HTL-1001",
    score: 92,
    status: "Approved",
    updatedAt: "2026-06-10",
    flagReason: null,
    body: "Perched above the Malibu coastline, Grand Horizon offers breathtaking panoramic ocean views from every suite. Our 85 rooms blend contemporary California design with timeless luxury — floor-to-ceiling windows, handcrafted Italian linens, and private terraces where you can watch the sun melt into the Pacific. The infinity pool cascades toward the horizon, while our spa draws on Pacific botanicals for treatments found nowhere else on the coast.",
  },
  {
    id: "CNT-002",
    propertyId: "HTL-1002",
    score: 85,
    status: "Approved",
    updatedAt: "2026-05-28",
    flagReason: null,
    body: "In the heart of Chicago's Loop district, The Metropolitan stands as a monument to urban sophistication. Our 120 rooms and suites feature sleek mid-century modern design, smart-room technology, and some of the best skyline views in the city. Steps from Millennium Park, the Art Institute, and the Magnificent Mile, business and leisure travellers alike find their perfect base here.",
  },
  {
    id: "CNT-003",
    propertyId: "HTL-1003",
    score: 89,
    status: "Approved",
    updatedAt: "2026-06-02",
    flagReason: null,
    body: "Nestled in the shadow of the legendary Matterhorn, Alpine Lodge Zermatt is where Swiss tradition meets alpine luxury. Our 60 timber-framed rooms and suites wrap you in warmth with hand-carved furnishings, crackling fireplaces, and views that stretch across snow-dusted peaks. After a day on the slopes, unwind in our geothermal spa or savour fondue by the hearth.",
  },
  {
    id: "CNT-004",
    propertyId: "HTL-1004",
    score: 78,
    status: "Pending Review",
    updatedAt: "2026-06-12",
    flagReason: null,
    body: "Tulum's coastline finds its crown jewel in Casa del Mar — a boutique sanctuary where the jungle meets the Caribbean Sea. Our 42 white-stucco casitas dot a private stretch of powder-white sand, each with handwoven Mayan textiles, outdoor rain showers, and hammocks swaying in the salt breeze. Yoga at sunrise, ceviche by the pool, and mezcal tastings under a canopy of stars.",
  },
  {
    id: "CNT-005",
    propertyId: "HTL-1005",
    score: 95,
    status: "Approved",
    updatedAt: "2026-06-08",
    flagReason: null,
    body: "In a quiet lane of Kyoto's Higashiyama district, Sakura Ryokan has welcomed guests for three generations. Our 28 tatami rooms are an immersion in omotenashi — the art of Japanese hospitality — where sliding shoji screens frame views of our century-old cherry tree and koi pond. Soak in the onsen fed by natural hot springs, or partake in a traditional tea ceremony.",
  },
  {
    id: "CNT-006",
    propertyId: "HTL-1007",
    score: 42,
    status: "Flagged",
    updatedAt: "2026-06-14",
    flagReason:
      "Description is a placeholder — below the 60-point minimum for publication.",
    body: "Coming soon — a new luxury destination in St. Moritz.",
  },
  {
    id: "CNT-007",
    propertyId: "HTL-1009",
    score: 88,
    status: "Approved",
    updatedAt: "2026-06-05",
    flagReason: null,
    body: "Rising from the golden dunes of Dubai, Desert Rose Resort is more than a hotel — it is an oasis of Arabian luxury reimagined for the 21st century. Our 200 rooms and suites marry traditional mashrabiya patterns with contemporary design, each offering views of the endless desert or our lush courtyard gardens. Dine under the stars at Al Maha, our Bedouin-inspired restaurant.",
  },
  {
    id: "CNT-008",
    propertyId: "HTL-1010",
    score: 55,
    status: "Flagged",
    updatedAt: "2026-05-15",
    flagReason:
      "Written in Italian while the property's market language is English, and the content reads as a guest review rather than a description.",
    body: "La villa è bella ma il servizio scadente. Camera pulita ma il bagno necessita di ristrutturazione. Colazione mediocre.",
  },
]

/** Immutable platform action trail. */
export const adminAuditEvents: AuditEvent[] = [
  { id: "AUD-012", action: "User suspended", actorName: "Ahmed Khan", actorRole: "Super Admin", targetName: "Elena Rossi", targetKind: "Manager", details: "Account suspended due to payment default on STY-INV-2026-0613", category: "User", at: "2026-07-30 09:47" },
  { id: "AUD-011", action: "Property approved", actorName: "Ahmed Khan", actorRole: "Super Admin", targetName: "Lakeview Boutique Hotel", targetKind: "Property", details: "Property HTL-1012 approved and activated for Alpine Resorts AG", category: "Property", at: "2026-07-30 08:30" },
  { id: "AUD-010", action: "Rate plan override", actorName: "Ahmed Khan", actorRole: "Super Admin", targetName: "Flexible Rate (Aurora Hospitality)", targetKind: "Rate Plan", details: "Platform-wide 10% discount override applied for August 2026", category: "Billing", at: "2026-07-29 16:22" },
  { id: "AUD-009", action: "Description approved", actorName: "Ahmed Khan", actorRole: "Super Admin", targetName: "Sakura Ryokan", targetKind: "Description", details: "Content score: 95 — approved with minor grammar corrections", category: "Content", at: "2026-07-29 14:10" },
  { id: "AUD-008", action: "Review flagged", actorName: "System", actorRole: "AI Moderation", targetName: "REV-005 (Casa del Mar)", targetKind: "Review", details: "Automatically flagged for potential fraudulent content — anonymous author with no matching reservation", category: "Security", at: "2026-07-29 03:15" },
  { id: "AUD-007", action: "Invoice issued", actorName: "System", actorRole: "Billing Engine", targetName: "STY-INV-2026-0625", targetKind: "Invoice", details: "Commission invoice for Grand Horizon: $26,336 subtotal, 42 bookings", category: "Billing", at: "2026-07-29 00:01" },
  { id: "AUD-006", action: "Manager invited", actorName: "David Park", actorRole: "General Manager", targetName: "Maria Gonzalez", targetKind: "Manager", details: "Invited as Front Desk Manager for The Metropolitan", category: "User", at: "2026-07-28 11:45" },
  { id: "AUD-005", action: "Login from new device", actorName: "Hans Meier", actorRole: "General Manager", targetName: "Alpine Resorts AG", targetKind: "Account Security", details: "New login detected from IP 89.xxx in Zurich, CH", category: "Security", at: "2026-07-28 09:12" },
  { id: "AUD-004", action: "Tax rule updated", actorName: "Ahmed Khan", actorRole: "Super Admin", targetName: "US VAT / GST", targetKind: "Tax", details: "Rate changed from 8% to 10% for all US properties", category: "System", at: "2026-07-27 15:40" },
  { id: "AUD-003", action: "Payout failed", actorName: "System", actorRole: "Billing Engine", targetName: "PYT-9086 (La Villa Toscana)", targetKind: "Payout", details: "Beneficiary account closed — awaiting updated bank details from the client", category: "Billing", at: "2026-06-28 04:02" },
  { id: "AUD-002", action: "Subscription downgraded", actorName: "System", actorRole: "Billing Engine", targetName: "Mediterranean Boutique Stays", targetKind: "Subscription", details: "Marked Past Due after 30 days of non-payment", category: "Billing", at: "2026-06-01 00:00" },
  { id: "AUD-001", action: "2FA enabled", actorName: "Ahmed Khan", actorRole: "Super Admin", targetName: "All manager accounts", targetKind: "Account Security", details: "Two-factor authentication enforced for every tenant-side manager", category: "Security", at: "2026-05-28 18:05" },
]

/** SaaS subscriptions — one per client. */
export const adminSubscriptions: Subscription[] = [
  { id: "SUB-001", clientId: "CLI-001", plan: "Enterprise", status: "Active", amount: 2_499, interval: "Monthly", nextBilling: "2026-08-15", paymentMethod: "Visa •••• 4242" },
  { id: "SUB-002", clientId: "CLI-002", plan: "Professional", status: "Active", amount: 899, interval: "Monthly", nextBilling: "2026-08-01", paymentMethod: "Mastercard •••• 8888" },
  { id: "SUB-003", clientId: "CLI-003", plan: "Enterprise", status: "Active", amount: 2_499, interval: "Monthly", nextBilling: "2026-08-20", paymentMethod: "Bank Transfer" },
  { id: "SUB-004", clientId: "CLI-004", plan: "Professional", status: "Trial", amount: 0, interval: "Monthly", nextBilling: "2026-08-10", paymentMethod: "Amex •••• 3701" },
  { id: "SUB-005", clientId: "CLI-005", plan: "Starter", status: "Active", amount: 299, interval: "Monthly", nextBilling: "2026-08-14", paymentMethod: "Visa •••• 7590" },
  { id: "SUB-006", clientId: "CLI-006", plan: "Starter", status: "Past Due", amount: 299, interval: "Monthly", nextBilling: "2026-07-01", paymentMethod: "Mastercard •••• 1122" },
]

/** Monthly recurring revenue counts only actively-billing subscriptions. */
export const monthlyRecurringRevenue = adminSubscriptions
  .filter((s) => s.status === "Active")
  .reduce((sum, s) => sum + s.amount, 0)

export const adminBillingInvoices: BillingInvoice[] = [
  { id: "INV-0628", clientId: "CLI-001", description: "Enterprise Plan — July 2026", amount: 2_499, status: "Paid", due: "2026-07-15" },
  { id: "INV-0627", clientId: "CLI-002", description: "Professional Plan — July 2026", amount: 899, status: "Pending", due: "2026-08-01" },
  { id: "INV-0626", clientId: "CLI-003", description: "Enterprise Plan — July 2026", amount: 2_499, status: "Paid", due: "2026-07-20" },
  { id: "INV-0625", clientId: "CLI-001", description: "Enterprise Plan — June 2026", amount: 2_499, status: "Paid", due: "2026-06-15" },
  { id: "INV-0624", clientId: "CLI-005", description: "Starter Plan — June 2026", amount: 299, status: "Paid", due: "2026-06-14" },
  { id: "INV-0623", clientId: "CLI-006", description: "Starter Plan — June 2026", amount: 299, status: "Overdue", due: "2026-06-01" },
]

export const overdueBillingAmount = adminBillingInvoices
  .filter((i) => i.status === "Overdue")
  .reduce((sum, i) => sum + i.amount, 0)

export const adminIntegrations: Integration[] = [
  { id: "INT-supabase", name: "Supabase", description: "Postgres database, auth and storage", icon: "Database", connected: false },
  { id: "INT-stripe", name: "Stripe", description: "Card payments, payouts and subscription billing", icon: "CreditCard", connected: false },
  { id: "INT-resend", name: "Resend", description: "Transactional email for invites, receipts and alerts", icon: "Mail", connected: false },
  { id: "INT-ga", name: "Google Analytics", description: "Marketplace traffic and conversion tracking", icon: "BarChart3", connected: false },
  { id: "INT-twilio", name: "Twilio", description: "SMS notifications for guests and property staff", icon: "MessageSquare", connected: false },
  { id: "INT-calendly", name: "Calendly", description: "Onboarding calls with prospective clients", icon: "Calendar", connected: false },
]

export const defaultPlatformSettings: PlatformSettings = {
  general: {
    platformName: "Stayora",
    supportEmail: "support@stayora.com",
    defaultCurrency: "USD",
    defaultLanguage: "English",
    timezone: "UTC",
  },
  plans: {
    defaultCommissionRate: COMMISSION_RATE * 100,
    trialPeriodDays: 14,
    maxPropertiesFreePlan: 1,
  },
}

export const adminNotifications: AdminNotification[] = [
  { id: "NTF-001", kind: "client", title: "New client registered", detail: "Pacific Luxury Stays completed onboarding", at: "2026-07-30T12:25:00Z", read: false, href: "/admin/clients/CLI-004" },
  { id: "NTF-002", kind: "security", title: "Suspicious booking detected", detail: "RSV-8832 · Lakeview Boutique Hotel · $1,360", at: "2026-07-30T12:18:00Z", read: false, href: "/admin/reservations" },
  { id: "NTF-003", kind: "billing", title: "Payment overdue", detail: "Mediterranean Boutique Stays · Invoice INV-0623", at: "2026-07-30T11:30:00Z", read: false, href: "/admin/billing" },
  { id: "NTF-004", kind: "approval", title: "Property approval needed", detail: "Mountain Peak Resort · Submitted 2 days ago", at: "2026-07-30T10:30:00Z", read: true, href: "/admin/properties/HTL-1007" },
  { id: "NTF-005", kind: "review", title: "Review flagged by moderation", detail: "REV-005 · Casa del Mar · anonymous author", at: "2026-07-29T03:15:00Z", read: true, href: "/admin/reviews" },
]
