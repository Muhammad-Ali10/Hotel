/**
 * Every call the admin panel makes, against the real API.
 *
 * This file used to resolve against an in-memory store, behind a `request()`
 * seam that was supposed to make swapping in a backend a one-file change. It
 * could not have been: the mock spoke a **different language** from the API it
 * was standing in for, and three of the differences reach every screen.
 *
 * | | mock | API |
 * |---|---|---|
 * | statuses | `"Active"`, `"Past Due"` | `active`, `past_due` |
 * | money | a number of dollars | integer **cents** |
 * | paging | `{ rows, total }` and a page number | `{ items, nextCursor }`, keyset |
 *
 * None of those is cosmetic. Title-Case statuses would have to be translated
 * on every read and every write; dollars silently divide a payout by a hundred
 * the first time somebody forgets; and an `OFFSET` page number cannot be
 * expressed against a keyset endpoint at all — page 7 of a table nobody has
 * scrolled to is not a request this API can answer.
 *
 * So the vocabulary is the API's, everywhere, and the types come from
 * `@stayora/shared` wherever the API exports one. A field renamed on the
 * server stops this compiling rather than reaching a screen as `undefined`.
 */

import type {
  AdminGuestView,
  AdminPropertyRow,
  AdminRefundRequest,
  AdminTransitionInput,
  AdminUserUpdateInput,
  AuditLineView,
  CommissionReportRow,
  FinanceOverview,
  FinanceRevenueView,
  FinanceTransaction,
  ListingDecisionInput,
  PlatformClientRow,
  PlatformOverview,
  PropertySuspensionInput,
} from "@stayora/shared"

import { api } from "@/lib/api/client"
import type {
  BookingDto,
  InvoiceDto,
  PayoutDto,
  PromotionDto,
  ReviewDto,
  TeamMember,
} from "@/lib/api/endpoints"

export { ApiError } from "@/lib/api/errors"

/* ============================================================================
 * Paging
 *
 * Keyset, not pages. `nextCursor` is an opaque value the server hands back;
 * asking for "page 7" would mean counting six pages of rows nobody looked at,
 * and the answer would still shift under anybody making a booking meanwhile.
 * ========================================================================== */

export type Page<T> = { items: T[]; nextCursor: string | null }

/** What every list screen sends. `before` continues; omitting it starts over. */
export type PageQuery = { limit?: number; before?: string }

/**
 * A list query, as it actually travels.
 *
 * Everything here becomes a URL parameter, so by the time the server sees it
 * the whole thing is strings and numbers — and the server is what validates
 * the enums, returning a 400 for anything it does not recognise.
 *
 * Typing the client side with the narrow contract unions would push a cast
 * into every screen instead, because a facet's value is a string the screen
 * chose from options it declared: TypeScript cannot know that
 * `filters.status` is one of two words, only that it is a word. The write
 * paths keep their exact input types, which is where being wrong costs
 * something.
 */
export type ListQuery = Record<string, string | number | undefined>

/* ============================================================================
 * Platform analytics
 * ========================================================================== */

export type PlatformRange = { from: string; to: string }

export const analyticsApi = {
  /** GMV, revenue and the shape of the marketplace (rule #64). */
  overview: (range: PlatformRange) =>
    api<PlatformOverview>("/admin/analytics/overview", { query: range }),

  clients: (range: PlatformRange & { limit?: number }) =>
    api<PlatformClientRow[]>("/admin/analytics/clients", { query: range }),

  sales: (range: PlatformRange & { granularity?: "day" | "week" | "month" }) =>
    api<unknown>("/admin/analytics/sales", { query: range }),

  demand: (range: PlatformRange & { limit?: number }) =>
    api<PlatformDemand>("/admin/analytics/demand", { query: range }),
}

export type PlatformDemand = {
  destinations: {
    destination: string
    searches: number
    /** Searches that found nothing — demand the marketplace could not serve. */
    emptyResults: number
    averageResults: number
    travellers: number
  }[]
  trend: { period: string; searches: number; emptyResults: number }[]
}

/* ============================================================================
 * Clients — the partner organisations
 * ========================================================================== */

export type AdminOrg = {
  id: string
  name: string
  contactEmail: string
  contactPhone: string
  country: string
  createdAt: string
  status: string
  planTier: string
  /** Basis points, so a negotiated 12.5% is exactly `1250`. */
  commissionRateBps: number
}

export type AdminOrgDetail = {
  client: AdminOrg
  properties: {
    id: string
    slug: string
    name: string
    city: string
    country: string
    status: string
    stars: number | null
    fromPrice: number
    createdAt: string
  }[]
  managers: TeamMember[]
}

export const clientsApi = {
  list: () => api<AdminOrg[]>("/admin/partner-orgs"),

  get: (orgId: string) => api<AdminOrgDetail>(`/admin/partner-orgs/${orgId}`),

  /**
   * The rate applies to bookings made FROM NOW ON.
   *
   * Nothing here rewrites a past invoice: a platform that can edit one field
   * and change last quarter's numbers is one nobody can reconcile against.
   */
  update: (orgId: string, patch: Record<string, unknown>) =>
    api<AdminOrg>(`/admin/partner-orgs/${orgId}`, { method: "PATCH", body: patch }),

  create: (body: Record<string, unknown>) =>
    api<AdminOrg>("/admin/partner-orgs", { method: "POST", body }),
}

/* ============================================================================
 * Platform settings
 * ========================================================================== */

export type PlatformSettings = {
  supportEmail: string
  defaultCommissionRateBps: number
  /** Read-only: every price in the system is USD cents, in four places. */
  currency: string
  updatedAt: string
}

/* ------------------------------------------------ notification delivery -- */

export type MailHealth = {
  /**
   * `not_sending` is not a failure — it is the `fake` driver, which accepts
   * every message and delivers none. Correct locally, invisible in production.
   */
  status: "ok" | "not_sending" | "stuck" | "failing"
  driver: string
  from: string
  stuckAfterMinutes: number
  pending: number
  /** Due to be sent, and still waiting well past when it should have gone. */
  stuck: number
  failedLastHour: number
  sentLastHour: number
  /** How long the oldest queued message has been queued. */
  oldestPendingMinutes: number
}

export const mailApi = {
  health: () => api<MailHealth>("/admin/notifications/health"),
}

export const settingsApi = {
  get: () => api<PlatformSettings>("/admin/partner-orgs/settings"),

  update: (patch: { supportEmail?: string; defaultCommissionRateBps?: number }) =>
    api<PlatformSettings>("/admin/partner-orgs/settings", {
      method: "PATCH",
      body: patch,
    }),
}

/* ============================================================================
 * Properties — the listing queue and the catalogue
 * ========================================================================== */

export type AdminPropertyDetail = {
  id: string
  slug: string
  name: string
  city: string
  country: string
  type: string
  stars: number | null
  address: string
  description: string
  timezone: string
  checkInTime: string
  checkOutTime: string
  policyPayment: string
  policyPets: string
  policySmoking: string
  policyChildren: string
  status: string
  /** What the partner has edited and is waiting on the platform (rule #71). */
  pendingChanges: Record<string, unknown> | null
  createdAt: string
  /** Whose it is. The partner's own read of this listing carries neither. */
  orgId: string | null
  orgName: string | null
  /** How far off publishing it is — `gaps` says what, these say how much. */
  counts: { rooms: number; ratePlans: number; photos: number }
  photos: {
    id: string
    category: string
    caption: string
    position: number
    status: string
    url: string | null
    seed: string
  }[]
  /** Everything still missing before it could be published (rule #70). */
  gaps: string[]
}

/**
 * One category of the listing score (rule #99).
 *
 * `applicable: false` means the category does not apply yet — a property with
 * no published reviews is not BAD at reviews, it simply has none, and the
 * weights renormalise around it. `score` is `null` in exactly that case.
 */
export type ScoreCategory = {
  key: string
  name: string
  score: number | null
  weight: number
  applicable: boolean
  /** What to do about it, in the words a partner would act on. */
  tip: string
}

/** The content queue carries a quality score; the review queue does not. */
export type AdminContentRow = AdminPropertyRow & {
  score: {
    propertyId: string
    total: number
    band: string
    categories: ScoreCategory[]
  } | null
}

export const propertiesApi = {
  list: (query: ListQuery = {}) =>
    api<Page<AdminPropertyRow> & { counts: Record<string, number> }>(
      "/admin/listings",
      { query }
    ),

  /** Only what is waiting on a decision — a shorter, sharper list. */
  queue: () => api<AdminPropertyRow[]>("/admin/listings/queue"),

  get: (propertyId: string) =>
    api<AdminPropertyDetail>(`/admin/listings/${propertyId}`),

  /**
   * Approving, or sending it back with a reason (rule #71).
   *
   * There is no "reject" that deletes anything. A listing sent back keeps
   * everything on it; the partner fixes what was named and resubmits.
   */
  decide: (propertyId: string, body: ListingDecisionInput) =>
    api<AdminPropertyDetail>(`/admin/listings/${propertyId}/decision`, {
      method: "POST",
      body,
    }),

  /** Taking a listing off the market, or putting it back (rules #78, #79). */
  suspend: (propertyId: string, body: PropertySuspensionInput) =>
    api<AdminPropertyDetail>(`/admin/listings/${propertyId}/suspension`, {
      method: "POST",
      body,
    }),
}

export const contentApi = {
  list: (query: ListQuery = {}) =>
    api<Page<AdminContentRow> & { counts: Record<string, number> }>(
      "/admin/content",
      { query }
    ),
}

/* ============================================================================
 * Reservations
 * ========================================================================== */

/* ============================================================================
 * What the admin reservation endpoints ACTUALLY return.
 *
 * Both were typed `BookingDto`, the guest-facing view, and neither matches it.
 * The guest's own booking carries a nested `guest: { firstName, … }`, because
 * a booking can be made FOR somebody else; the admin list returns the booking
 * ROW, where those live flat as `guestFirstName` and friends.
 *
 * Three screens read `booking.guest.firstName` off that and threw
 * `Cannot read properties of undefined` — the reservations table, the
 * cancellations table, and the detail dialog. Verified against the running API.
 * ========================================================================== */

export type AdminReservationRow = {
  id: string
  ref: string
  status: string
  source: string

  /** Flat on the row — NOT a nested `guest` object. */
  guestFirstName: string
  guestLastName: string
  guestEmail: string
  guestPhone: string
  guestCountry: string

  propertyId: string
  propertyName: string
  city: string
  roomId: string
  roomName: string
  roomNo: string | null
  ratePlanId: string
  ratePlanName: string

  checkIn: string
  checkOut: string
  adults: number
  children: number
  arrivalTime: string | null
  specialRequests: string | null
  notes: string | null

  /** Cents. */
  total: number
  commissionAmount: number
  commissionRateBps: number
  commissionStatus: string
  refundAmount: number
  refundStatus: string | null
  paymentMode: string
  pricing: unknown

  cancelFreeUntil: string | null
  cancelCharge: string | null
  cancelChargeValue: number | null
  noShowCharge: string | null
  noShowChargeValue: number | null
  cancelledAt: string | null
  cancelledBy: string | null
  cancellationReason: string | null

  customerId: string | null
  promotionId: string | null
  holdExpiresAt: string | null
  seed: string
  createdAt: string
  updatedAt: string
}

/** The detail route answers with the booking AND its history, not a booking. */
export type AdminReservationDetail = {
  booking: AdminReservationRow
  events: {
    id: string
    bookingId: string
    fromStatus: string | null
    toStatus: string
    actorId: string | null
    createdAt: string
  }[]
  payments: {
    id: string
    bookingId: string
    kind: string
    status: string
    amount?: number
    createdAt: string
  }[]
  /** Cents actually taken and given back — not what the booking is worth. */
  totals: { captured: number; refunded: number }
}

export const reservationsApi = {
  list: (query: ListQuery = {}) =>
    api<Page<AdminReservationRow>>("/admin/reservations", { query }),

  get: (bookingId: string) =>
    api<AdminReservationDetail>(`/admin/reservations/${bookingId}`),

  /**
   * A goodwill refund, over and above the guest's own terms (rule #76).
   *
   * The reason has a floor because somebody reads this months later and has to
   * understand the decision. The commission on a fully refunded booking is
   * VOIDED rather than kept — the platform does not earn on a stay it gave
   * back.
   */
  refund: (bookingId: string, body: AdminRefundRequest) =>
    api<{ booking: BookingDto; refunded: number }>(
      `/admin/reservations/${bookingId}/refund`,
      { method: "POST", body }
    ),

  /** Moving a booking the partner cannot. The state machine still applies. */
  transition: (bookingId: string, body: AdminTransitionInput) =>
    api<BookingDto>(`/admin/reservations/${bookingId}/status`, {
      method: "POST",
      body,
    }),
}

/* ============================================================================
 * People — guests, partners and the platform's own staff
 * ========================================================================== */

export type AdminUserRow = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: "customer" | "partner" | "admin"
  status: string
  tier: string
  emailVerifiedAt: string | null
  createdAt: string
}

/** The detail view adds the guest's own history — never a password hash (#80). */
export type AdminUserDetail = AdminGuestView & {
  bookings: BookingDto[]
  reviews: ReviewDto[]
}

export const usersApi = {
  /**
   * `counts` is scoped by ROLE, and by nothing else.
   *
   * Guests and platform staff are two different populations; one shared total
   * would be right for neither. The caller's search is not applied to it —
   * a tile that moves while somebody types is a second result count.
   */
  list: (query: ListQuery = {}) =>
    api<Page<AdminUserRow> & { counts: Record<string, number> }>("/admin/users", {
      query,
    }),

  get: (userId: string) => api<AdminUserDetail>(`/admin/users/${userId}`),

  /**
   * Suspending an account, or changing what it may reach (rule #79).
   *
   * A reason is required. Somebody locked out will ask why, and "an admin did
   * it in March" is not an answer anybody can act on.
   */
  update: (userId: string, body: AdminUserUpdateInput) =>
    api<AdminUserRow>(`/admin/users/${userId}`, { method: "PATCH", body }),
}

/* ============================================================================
 * Reviews
 * ========================================================================== */

export const reviewsApi = {
  list: (query: ListQuery = {}) =>
    api<Page<ReviewDto> & { counts: Record<string, number> }>("/admin/reviews", {
      query,
    }),

  /**
   * Publishing a review, or taking it down (rules #40, #41).
   *
   * This is the platform's call and nobody else's — a property that could hide
   * its own bad reviews would leave a rating nobody should trust.
   */
  moderate: (id: string, body: { status: string; reason?: string }) =>
    api<ReviewDto>(`/admin/reviews/${id}`, { method: "PATCH", body }),
}

/* ============================================================================
 * The platform's inbox
 * ========================================================================== */

export type AdminThread = {
  id: string
  ref: string
  audience: "guest" | "partner"
  subject: string
  category: string
  priority: string
  status: string
  requesterName: string
  requesterEmail: string
  requesterId: string | null
  orgId: string | null
  bookingId: string | null
  assigneeId: string | null
  lastMessageAt: string
  createdAt: string
  resolvedAt: string | null
}

export type AdminThreadMessage = {
  id: string
  authorKind: "requester" | "agent" | "internal"
  authorName: string
  body: string
  createdAt: string
}

export const inboxApi = {
  /** `counts` is over the WHOLE queue, not the page — it feeds the badge. */
  list: (query: ListQuery = {}) =>
    api<Page<AdminThread> & { counts: Record<string, number> }>("/admin/support", {
      query,
    }),

  get: (threadId: string) =>
    api<{ thread: AdminThread; messages: AdminThreadMessage[] }>(
      `/admin/support/${threadId}`
    ),

  /** `internal: true` is a note the requester never sees. */
  reply: (threadId: string, body: { body: string; internal?: boolean }) =>
    api<AdminThreadMessage>(`/admin/support/${threadId}/reply`, {
      method: "POST",
      body,
    }),

  update: (threadId: string, patch: Record<string, unknown>) =>
    api<AdminThread>(`/admin/support/${threadId}`, { method: "PATCH", body: patch }),
}

/* ============================================================================
 * Money
 * ========================================================================== */

export type FinanceRange = { from: string; to: string }

export const financeApi = {
  overview: (range: FinanceRange) =>
    api<FinanceOverview>("/admin/finance/overview", { query: range }),

  revenue: (range: FinanceRange & { granularity?: "day" | "week" | "month" }) =>
    api<FinanceRevenueView>("/admin/finance/revenue", { query: range }),

  commissions: (range: FinanceRange) =>
    api<CommissionReportRow[]>("/admin/finance/commissions", { query: range }),

  transactions: (range: FinanceRange & { limit?: number; before?: string }) =>
    api<Page<FinanceTransaction>>("/admin/finance/transactions", { query: range }),
}

export type AdminPayout = PayoutDto & {
  orgId: string
  orgName: string
}

export const payoutsApi = {
  list: (query: ListQuery = {}) => api<AdminPayout[]>("/admin/payouts", { query }),

  get: (id: string) => api<unknown>(`/admin/payouts/${id}`),

  /** A failed transfer, tried again. The reason it failed stays on the row. */
  retry: (id: string) => api<AdminPayout>(`/admin/payouts/${id}/retry`, { method: "POST" }),

  /** Verifying the bank details somebody typed. The platform's word, not theirs. */
  verifyAccount: (orgId: string) =>
    api<{ ok: true }>(`/admin/payouts/accounts/${orgId}/verify`, { method: "POST" }),

  /** Cuts settlements for everything eligible. Idempotent by period. */
  run: (body: { periodStart: string; periodEnd: string }) =>
    api<{ created: number; skipped: number }>("/admin/payouts/run", {
      method: "POST",
      body,
    }),
}

export type AdminInvoice = InvoiceDto & { orgName: string }

export const invoicesApi = {
  list: (query: ListQuery = {}) => api<AdminInvoice[]>("/admin/invoices", { query }),

  get: (invoiceId: string) =>
    api<{ invoice: AdminInvoice; lines: InvoiceLine[] }>(
      `/admin/invoices/${invoiceId}`
    ),

  /** Bills a month's commission across every org on `invoice` settlement. */
  run: (body: { periodStart: string; periodEnd: string }) =>
    api<{ created: number; skipped: number }>("/admin/invoices/run", {
      method: "POST",
      body,
    }),

  /**
   * Marking an invoice paid — the platform's word, not the partner's.
   *
   * Money arrives by bank transfer and somebody reconciles it. Payouts resume
   * only when NOTHING is outstanding: clearing one of three unpaid invoices
   * should not release the money.
   */
  markPaid: (invoiceId: string, note: string) =>
    api<AdminInvoice>(`/admin/invoices/${invoiceId}/paid`, {
      method: "POST",
      body: { note },
    }),

  /**
   * How an organisation settles: off each payout, or billed monthly (#91).
   *
   * A reason is required, and the floor is the server's own. This is not a
   * detail of a partner's profile — it decides where the platform's money
   * sits between the booking and the payout, and somebody will ask months
   * later why a client was moved.
   */
  setMode: (orgId: string, mode: "deduct" | "invoice", reason: string) =>
    api<{ ok: true }>(`/admin/invoices/orgs/${orgId}/mode`, {
      method: "POST",
      body: { mode, reason },
    }),
}

export type InvoiceLine = {
  id: string
  bookingId: string
  ref: string
  propertyName: string
  checkIn: string
  gross: number
  commission: number
}

/* ============================================================================
 * Promotions
 * ========================================================================== */

export const promotionsApi = {
  list: (query: ListQuery = {}) => api<PromotionDto[]>("/admin/promotions", { query }),

  get: (id: string) => api<PromotionDto>(`/admin/promotions/${id}`),

  /**
   * Ends what has expired and starts what is due (rule #17).
   *
   * A promotion's status is a fact about today, and nothing was moving it —
   * this is the job that does, run by hand until a cron exists.
   */
  sweep: () =>
    api<{ activated: number; ended: number }>("/admin/promotions/sweep", {
      method: "POST",
    }),
}

/* ============================================================================
 * Audit
 * ========================================================================== */

export const auditApi = {
  /**
   * Who did what, and why they said they did it.
   *
   * Append-only by construction. Every consequential action the platform takes
   * writes a line here with the reason its operator typed, which is the whole
   * point: a suspension nobody can explain six months later is indefensible.
   */
  list: (query: ListQuery = {}) =>
    api<Page<AuditLineView>>("/admin/audit", { query }),
}

/* ============================================================================
 * Registrations — properties applying to join
 * ========================================================================== */

export type RegistrationRow = {
  id: string
  status: string
  propertyName: string
  city: string
  country: string
  contactEmail: string
  submittedAt: string | null
  createdAt: string
}

export const registrationsApi = {
  list: (query: ListQuery = {}) =>
    api<Page<RegistrationRow>>("/admin/registrations", { query }),

  get: (registrationId: string) =>
    api<Record<string, unknown>>(`/admin/registrations/${registrationId}`),

  reviewDocument: (documentId: string, body: { status: string; reason?: string }) =>
    api<unknown>(`/admin/registrations/documents/${documentId}/review`, {
      method: "POST",
      body,
    }),

  /** Approval is ONE transaction: org, property, rooms, rate plan (rule #103). */
  decide: (registrationId: string, body: { decision: string; reason?: string }) =>
    api<unknown>(`/admin/registrations/${registrationId}/decision`, {
      method: "POST",
      body,
    }),
}
