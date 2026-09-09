import { PROMOTION_KINDS, PROMOTION_STATUSES, VALUE_ADD_UNITS } from "@stayora/shared"

import type {
  BookersView,
  BookingConversation,
  BookWindowView,
  CancellationsView,
  CommissionReportRow,
  ContractTemplateView,
  ComparablesView,
  CreateBookingInput,
  FinanceOverview,
  FinanceRevenueView,
  FinanceTransaction,
  GeniusView,
  InviteCreateInput,
  MemberUpdateInput,
  OrgUpdateInput,
  PaceView,
  PerformanceRowView,
  SalesView,
  FavoriteItem,
  ProfileUpdateInput,
  PromotionCreateInput,
  PromotionUpdateInput,
  ProfileView,
  SessionView,
  BookingMessageView,
  CancellationPolicy,
  SupportMessageView,
  SupportThreadView,
  LoginInput,
  OccupancyGridView,
  OccupancyPricesInput,
  PropertyDetail,
  PropertyListItem,
  PartnerContractView,
  PartnerTicketInput,
  PropertyRating,
  PropertySearchInput,
  RegistrationDocumentView,
  RegistrationView,
  RankingFactor,
  QuoteRequestInput,
  SignupInput,
  ValueAddCreateInput,
  ValueAddUpdateInput,
} from "@stayora/shared"

import { allPages, api, browsingSessionId, type ApiRequest } from "./client"

/**
 * Every call the booking path makes, typed from `@stayora/shared`.
 *
 * The inputs are the API's OWN schemas — the same objects the Nest routes
 * validate against. When a field is added on one side, the other stops
 * compiling, which is the only reason the two can be trusted to agree.
 *
 * Returns are typed by hand where the API has no exported DTO yet; each one is
 * marked so it is obvious which are contract-backed and which are a promise
 * this file is making on the backend's behalf.
 */

/* ------------------------------------------------------------------ auth -- */

/**
 * The contract, not a copy of it.
 *
 * This was written out by hand here — the file's own header calls that "a
 * promise this file is making on the backend's behalf" — and it drifted the
 * moment the API gained `platformRole`: the field arrived on every response
 * and was invisible to TypeScript, so the admin panel went on hardcoding a
 * grade it no longer had to guess.
 *
 * `@stayora/shared` defines it once, the API answers with it, and this is
 * where the browser reads it.
 */
import type { SessionUser } from "@stayora/shared"
export type { SessionUser }

export const authApi = {
  /**
   * Signup answers the same way whether or not the address is taken (rule #58),
   * and deliberately returns NO session — the truth goes to the mailbox.
   */
  signup: (body: SignupInput) =>
    api<{ message: string }>("/auth/signup", { method: "POST", body }),

  /**
   * Proving an address, from the link in the verification email.
   *
   * Public: the person clicking it is not signed in — they may be reading the
   * mail on a different device from the one they signed up on. Expired,
   * already-used and never-real all come back as the same refusal.
   */
  verifyEmail: (token: string) =>
    api<{ verified: true }>("/auth/verify-email", { method: "POST", body: { token } }),

  /** A fresh link, for somebody who lost the first. Needs a session. */
  resendVerification: () =>
    api<{ pending: true }>("/auth/verify-email/resend", { method: "POST" }),

  login: (body: LoginInput) =>
    api<{ user: SessionUser }>("/auth/login", { method: "POST", body }),

  logout: () => api<void>("/auth/logout", { method: "POST" }),

  /**
   * Who the cookie belongs to, or `null`.
   *
   * A 401 here is the ordinary answer for a signed-out visitor, not a failure,
   * so it is caught and turned into `null`. Letting it throw would make every
   * public page render an error for anybody who is not signed in.
   */
  me: async (): Promise<SessionUser | null> => {
    try {
      // Wrapped in `{ user }`, like login — not the user on its own.
      const { user } = await api<{ user: SessionUser }>("/auth/me")
      return user
    } catch (error) {
      if (isUnauthorized(error)) return null
      throw error
    }
  },
}

/* ------------------------------------------------------------- catalogue -- */

export type SearchResponse = {
  items: PropertyListItem[]
  nextCursor: string | null
  /** For reporting which result was opened (rule #67). May be absent. */
  searchId?: string | null
}

export const catalogApi = {
  /**
   * The public search.
   *
   * Carries the browsing session id so the Demand and Ranking screens can tell
   * one visitor's five searches from five visitors' one. It is hashed before it
   * reaches a column and never leaves this header.
   */
  search: (query: Partial<PropertySearchInput>, options?: Pick<ApiRequest, "signal">) =>
    api<SearchResponse>("/properties", {
      query: query as Record<string, string | number | boolean | undefined>,
      headers: withSession(),
      signal: options?.signal,
    }),

  /** By SLUG — the guest-facing handle. The UUID is not a URL. */
  detail: (slug: string) => api<PropertyDetail>(`/properties/${encodeURIComponent(slug)}`),

  /**
   * The amenity vocabulary (rule #74).
   *
   * Public, because the search filter is built from it — a guest narrowing by
   * "Free WiFi" needs the list before they have an account. Deriving the
   * options from the current results instead would make them change every time
   * the results do, and an amenity would vanish from the panel the moment it
   * filtered everything out.
   */
  amenities: () =>
    api<{ slug: string; label: string; category: string; icon: string }[]>("/amenities"),

  /** Records that a search result was opened. Never worth failing a click over. */
  reportClick: (searchId: string, propertyId: string) =>
    api<void>(`/search-events/${searchId}/click`, {
      method: "POST",
      body: { propertyId },
    }).catch(() => undefined),
}

/* ----------------------------------------------------------------- quote -- */

/** What the API answers a quote with. Mirrors `PricingService.quote`. */
export type Quote = {
  property: { id: string; slug: string; name: string }
  room: { id: string; name: string }
  ratePlan: { id: string; name: string }
  checkIn: string
  checkOut: string
  occupancy: { adults: number; children: number }
  addOns: { valueAddId: string; name: string; unit: string; unitPrice: number; qty: number; amount: number }[]
  pricing: {
    nights: number
    nightlyRates: number[]
    ratePerNight: number
    roomSubtotal: number
    addOnsTotal: number
    discount?: { id: string; label: string; amount: number }
    total: number
  }
  promotion: { id: string; name: string; saving: number } | null
  /** Signed. The booking is made from THIS, never from a total the client sends. */
  quoteToken: string
  expiresAt: string
}

export const pricingApi = {
  quote: (slug: string, body: QuoteRequestInput) =>
    api<Quote>(`/properties/${encodeURIComponent(slug)}/quote`, { method: "POST", body }),
}

/* -------------------------------------------------------------- bookings -- */

export type BookingDto = {
  id: string
  ref: string
  status: "pending" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show"
  propertyId: string
  propertyName: string
  /** For re-quoting a modification — the names beside them are snapshots. */
  roomId: string
  ratePlanId: string
  roomName: string
  ratePlanName: string
  city: string
  checkIn: string
  checkOut: string
  adults: number
  children: number
  /**
   * Who the stay is FOR — not necessarily who booked it.
   *
   * A guest can book for somebody else: the booking belongs to whoever is
   * signed in, these are whoever is staying. So they cannot be read off the
   * session, which is why the API returns them.
   */
  guest: {
    firstName: string
    lastName: string
    email: string
    phone: string
    country: string
  }
  arrivalTime: string | null
  specialRequests: string | null
  pricing: {
    nights: number
    nightlyRates: number[]
    ratePerNight: number
    roomSubtotal: number
    addOnsTotal: number
    discount?: { id: string; label: string; amount: number }
    total: number
  }
  total: number
  /**
   * NESTED, not flat.
   *
   * The mode only — whether the money actually moved lives in the payments
   * ledger, and a copy here would be a second answer free to disagree with it.
   */
  payment: { mode: "prepay" | "guarantee" }
  /**
   * When the fifteen-minute hold lapses (rule #44). Non-null only while
   * `status` is `pending` — this is what the checkout countdown runs on.
   */
  holdExpiresAt: string | null
  source: string
  roomNo: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  /** In the words whoever cancelled it typed. */
  cancellationReason: string | null
  refundAmount: number | null
  refundStatus: string | null
  createdAt: string
}

export const bookingsApi = {
  /**
   * Creating a booking.
   *
   * The `Idempotency-Key` must be held STABLE across retries of the same
   * booking — that is the whole mechanism (rule #23). It is a parameter rather
   * than generated here so a component cannot accidentally mint a fresh one on
   * every attempt and book the same stay twice.
   */
  create: (body: CreateBookingInput, idempotencyKey: string) =>
    api<{ booking: BookingDto }>("/bookings", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey },
    }),

  /**
   * One booking, with the LIVE property beside it.
   *
   * The booking carries its own frozen `propertyName` and `city`; `property`
   * is the hotel as it is today — its address, its check-in times, and a slug
   * that links to the current page. A guest needs both: what they reserved,
   * and how to get there.
   */
  get: (id: string) =>
    api<{
      booking: BookingDto
      property: {
        slug: string
        name: string
        address: string
        city: string
        country: string
        checkInTime: string
        checkOutTime: string
        seed: string
      } | null
      /** Resolved for THIS stay by the server, not recomputed here (rule #10). */
      addOns: {
        id: string
        valueAddId: string
        name: string
        unit: string
        unitPrice: number
        qty: number
        amount: number
      }[]
      /**
       * The cancellation terms, and what cancelling right now would refund.
       *
       * `preview` is computed by the SERVER with the same `refundFor` the
       * cancellation itself runs — so the number on the confirmation screen is
       * the number the guest gets. `null` once the booking can no longer be
       * cancelled.
       */
      cancellation: {
        policy: CancellationPolicy
        /** Generated from the policy, never stored (rule #1). */
        text: string
        preview: { refund: number; charged: number } | null
      }
      events: { id: string; fromStatus: string | null; toStatus: string; createdAt: string }[]
    }>(`/bookings/${id}`),

  /**
   * Paged now, and followed to the end.
   *
   * It used to be a bare array capped at 100 in the service, with no cursor —
   * so a guest with 101 bookings saw 100 and nothing said otherwise. The API
   * answers `{ items, nextCursor }` today, like every other list; the walk
   * stays here so the dashboard's counts and trip lists see all of them.
   */
  mine: async () => (await allPages<BookingDto>("/bookings")).items,

  /**
   * Moving a booking (rule #45).
   *
   * A signed `quoteToken` and nothing else. The client never sends dates or a
   * price: the server priced them, signed them, and will not accept a stay it
   * did not quote.
   */
  modify: (id: string, quoteToken: string) =>
    api<{ booking: BookingDto; difference: number }>(`/bookings/${id}/modify`, {
      method: "POST",
      body: { quoteToken },
    }),

  cancel: (id: string, reason: string) =>
    api<{ booking: BookingDto; refund: { refund: number; charged: number } }>(
      `/bookings/${id}/cancel`,
      { method: "POST", body: { reason } }
    ),
}

/* -------------------------------------------------------------- payments -- */

export type PaymentIntent = {
  paymentId: string
  /** What the provider needs from the browser to finish the job. */
  clientSecret: string | null
  status: string
  amount: number
  mode: "prepay" | "guarantee"
}

export const paymentsApi = {
  /** Opens the payment for a booking that is holding inventory (rule #44). */
  start: (bookingId: string) =>
    api<PaymentIntent>("/payments/start", { method: "POST", body: { bookingId } }),

  forBooking: (bookingId: string) => api<PaymentIntent>(`/payments/booking/${bookingId}`),
}

/* ----------------------------------------------------------------- local -- */

function withSession(): Record<string, string> {
  const id = browsingSessionId()
  return id ? { "x-stayora-session": id } : {}
}

function isUnauthorized(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode: unknown }).statusCode === 401
  )
}

/* ------------------------------------------------------------ favourites -- */

export const favoritesApi = {
  list: () => api<{ items: FavoriteItem[]; nextCursor: string | null }>("/favorites"),

  /**
   * PUT, not POST — saving is a state the client asserts, not an event it
   * announces, so a retry after a dropped response lands on the same list.
   */
  save: (propertyId: string) =>
    api<{ saved: true; added: boolean }>(`/favorites/${propertyId}`, { method: "PUT" }),

  remove: (propertyId: string) =>
    api<{ saved: false; removed: boolean }>(`/favorites/${propertyId}`, { method: "DELETE" }),

  /** Which of a page of ids are saved — one call for the page, never per card. */
  lookup: (propertyIds: string[]) =>
    api<{ saved: string[] }>("/favorites/lookup", { method: "POST", body: { propertyIds } }),
}

/* --------------------------------------------------------- notifications -- */

/**
 * Written against `toDto` in `notifications.service.ts`.
 *
 * The first version of this type invented `template`, `kind` and a nullable
 * `readAt`. The API sends `type`, and `read` as a boolean — the timestamp is
 * deliberately not exposed, because "when did you see it" is not something a
 * notification list has any business telling anyone.
 */
export type NotificationDto = {
  id: string
  type: string
  audience: string
  title: string
  message: string
  href: string | null
  read: boolean
  createdAt: string
}

export const notificationsApi = {
  list: (query: { limit?: number; unreadOnly?: boolean } = {}) =>
    api<{ items: NotificationDto[]; unread: number }>("/notifications", {
      query: query as Record<string, string | number | boolean | undefined>,
    }),

  markRead: (id: string) =>
    api<NotificationDto>(`/notifications/${id}/read`, { method: "PATCH" }),

  markAllRead: () => api<{ marked: number }>("/notifications/read-all", { method: "POST" }),

  settings: () => api<NotificationSettingsDto>("/notifications/settings"),

  saveSettings: (patch: Partial<NotificationSettingsDto>) =>
    api<NotificationSettingsDto>("/notifications/settings", { method: "PATCH", body: patch }),

  /** Per-message switches (rule #105). Essential messages are never listed. */
  preferences: () => api<NotificationPreferencesDto>("/notifications/preferences"),

  savePreferences: (preferences: NotificationPreferenceRow[]) =>
    api<NotificationPreferencesDto>("/notifications/preferences", {
      method: "PATCH",
      body: { preferences },
    }),
}

export type NotificationSettingsDto = {
  emailUseful: boolean
  emailMarketing: boolean
}

export type NotificationPreferenceRow = {
  template: string
  /** The only two routes that exist. There is no SMS adapter. */
  channel: "email" | "in_app"
  enabled: boolean
}

export type NotificationPreferencesDto = {
  settings: NotificationSettingsDto
  items: {
    template: string
    klass: string
    /** From the shared catalogue, so every surface names a switch the same. */
    label: string
    description: string
    channels: { channel: "email" | "in_app"; enabled: boolean; isSet: boolean }[]
  }[]
}

/* --------------------------------------------------------------- account -- */

/*
 * The profile comes from `@stayora/shared`, not from a shape written here.
 *
 * The hand-written one was already wrong — it invented `address`,
 * `dateOfBirth` and `createdAt`, and omitted `points`, `membership`,
 * `preferences` and `avatarSeed`, which are the four the dashboard actually
 * renders. A contract-backed type cannot drift like that.
 */
export type ProfileDto = ProfileView

/** A signed-in device. Written against the API's `SessionView`. */
export type SessionDto = SessionView

export const accountApi = {
  profile: () => api<ProfileDto>("/auth/me/profile"),

  /** The API's own schema: it already refuses `role`, `tier` and `points`. */
  updateProfile: (patch: ProfileUpdateInput) =>
    api<ProfileDto>("/auth/me/profile", { method: "PATCH", body: patch }),

  /**
   * The answer is a COUNT, not a boolean.
   *
   * This was typed `{ changed: true }`, which the API has never returned — it
   * answers `{ endedElsewhere: n }`, the number of other sessions the change
   * signed out (rule #54). Verified against the running API.
   */
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api<{ endedElsewhere: number }>("/auth/password", { method: "POST", body }),

  /** A plain ARRAY, verified against the running API. */
  sessions: () => api<SessionDto[]>("/auth/sessions"),

  revokeSession: (id: string) => api<void>(`/auth/sessions/${id}`, { method: "DELETE" }),

  /** Signs every other device out. The current one is deliberately kept. */
  revokeOthers: () => api<{ revoked: number }>("/auth/sessions/revoke-others", { method: "POST" }),
}

/* --------------------------------------------------------------- reviews -- */

/**
 * A review as the API returns it.
 *
 * Written against `toDto` in `reviews.service.ts`, not guessed. The first
 * version of this type invented `propertyName`, `status`-only and a flat
 * `response`, and omitted `author`, `authorSeed`, `country`, `roomName` and
 * `verified` — which is the badge the review card is built around.
 */
export type ReviewDto = {
  id: string
  propertyId: string
  author: string
  authorSeed: string
  country: string
  roomName: string
  rating: number
  categories: Record<string, number>
  title: string
  body: string
  date: string
  /** Its presence is the Verified badge — the reviewer demonstrably stayed. */
  verified: boolean
  response: { text: string; at: string | null } | null
  createdAt: string
  /** Only on a guest's OWN reviews — the public list omits both by design. */
  status: string
  flagReason: string | null
  /**
   * Joined at read time on the guest's own list only.
   *
   * The review row carries just `propertyId`, because a review is about the
   * place and not the name it had that week.
   */
  propertyName?: string
}

/** A completed stay with no review yet. The server decides what qualifies. */
export type ReviewableBooking = {
  id: string
  ref: string
  propertyId: string
  propertyName: string
  roomName: string
  checkIn: string
  checkOut: string
}

export const reviewsApi = {
  mine: () => api<{ items: ReviewDto[] }>("/reviews/mine"),

  /**
   * Stays that finished and have no review yet — the only ones that qualify.
   *
   * A plain ARRAY. Verified against the running API, not assumed: the same
   * mistake on `/bookings` typechecked cleanly and would have read `undefined`
   * on every load.
   */
  reviewable: () => api<ReviewableBooking[]>("/reviews/reviewable"),

  create: (body: {
    bookingId: string
    rating: number
    categories: Record<string, number>
    title: string
    body: string
  }) => api<ReviewDto>("/reviews", { method: "POST", body }),

  remove: (id: string) => api<{ removed: true }>(`/reviews/${id}`, { method: "DELETE" }),

  /**
   * A property's published reviews, and its headline rating.
   *
   * The rating is DERIVED on every read rather than stored, so a moderation
   * decision moves it the moment it lands — a cached average is one a rejected
   * review keeps propping up.
   *
   * `categories` is what the per-category bars are drawn from; typing it as
   * the contract's own `PropertyRating` is what stops a screen averaging the
   * reviews on the page instead, which would disagree with the total the
   * moment there were more reviews than one page.
   */
  forProperty: (slug: string, query: { limit?: number; cursor?: string } = {}) =>
    api<{
      items: ReviewDto[]
      nextCursor: string | null
      rating: PropertyRating
    }>(`/properties/${encodeURIComponent(slug)}/reviews`, { query }),
}

/* --------------------------------------------------------------- support -- */

/** Contract-backed, so it cannot drift from what the API sends. */
export type TicketDto = SupportThreadView
export type TicketMessageDto = SupportMessageView

export const supportApi = {
  /**
   * Opening a ticket. PUBLIC — no session needed (rule #85).
   *
   * The most common thing support is asked is "I cannot sign in", and a help
   * desk behind a login turns that into a closed loop.
   */
  open: (body: {
    subject: string
    body: string
    email?: string
    name?: string
    category?: string
    bookingId?: string
  }) => api<TicketDto>("/support/tickets", { method: "POST", body }),

  mine: () => api<TicketDto[]>("/support/tickets"),

  get: (id: string) =>
    api<{ thread: TicketDto; messages: TicketMessageDto[] }>(`/support/tickets/${id}`),

  reply: (id: string, body: string) =>
    api<TicketMessageDto>(`/support/tickets/${id}/reply`, { method: "POST", body: { body } }),
}

/* ------------------------------------------------- booking messages (#89) -- */

/**
 * A guest and a property, about one booking.
 *
 * NOT support: no category, no priority, no assignee, no resolution. A stay
 * ends and the conversation stops, and the platform is not a participant.
 */
export const bookingMessagesApi = {
  list: (bookingId: string) =>
    api<{ side: "guest" | "property"; messages: BookingMessageView[] }>(
      `/bookings/${bookingId}/messages`
    ),

  send: (bookingId: string, body: string) =>
    api<BookingMessageView>(`/bookings/${bookingId}/messages`, {
      method: "POST",
      body: { body },
    }),
}

/* ---------------------------------------------------------------- partner -- */

/** One of the partner's own properties, as every extranet list shows it. */
export type PartnerProperty = {
  id: string
  slug: string
  name: string
  city: string
  country: string
  type: string
  stars: number | null
  status: string
  verification: string
  fromPrice: number
  timezone: string
  description: string
  /** Sellable units across active rooms. */
  rooms: number
  /** How many distinct room types. */
  roomTypes: number
}

export const partnerApi = {
  properties: () => api<PartnerProperty[]>("/partner/properties"),

  org: () => api<PartnerOrgView>("/partner/org"),

  /*
   * Followed to the end, because the extranet builds its calendar, its stat
   * cards and its per-property counts from this one call. A page would make
   * every one of those numbers wrong rather than small.
   */
  bookings: async () => (await allPages<BookingDto>("/partner/bookings")).items,
}

export type PartnerOrgView = {
  id: string
  name: string
  contactEmail: string
  contactPhone: string
  country: string
  createdAt: string
}

/* ------------------------------------------- partner booking actions (#6) -- */

export const partnerBookingsApi = {
  /**
   * Moving a booking through its states.
   *
   * The state machine still applies (rule #6) — the server refuses a
   * transition the booking cannot make, whoever asks. `roomNo` rides along
   * with a check-in because that is when a property assigns one.
   */
  setStatus: (id: string, body: { status: string; roomNo?: string; reason?: string }) =>
    api<BookingDto>(`/bookings/${id}/status`, { method: "PATCH", body }),

  /** A property cancelling. The refund follows the guest's own terms (#37). */
  cancel: (id: string, reason: string) =>
    api<{ booking: BookingDto; refund: { refund: number; charged: number } }>(
      `/bookings/${id}/cancel`,
      { method: "POST", body: { reason } }
    ),
}

/* ---------------------------------------------- partner reviews (#40, #41) -- */

export const partnerReviewsApi = {
  list: (query: { status?: string; limit?: number } = {}) =>
    api<{
      items: ReviewDto[]
      nextCursor: string | null
      /** Counts across the WHOLE set, not the page — the tabs need totals. */
      counts: Record<string, number>
    }>("/partner/reviews", {
      query: query as Record<string, string | number | boolean | undefined>,
    }),

  respond: (id: string, text: string) =>
    api<ReviewDto>(`/partner/reviews/${id}/respond`, { method: "POST", body: { text } }),

  /** Objecting. It leaves the public site at once; an admin decides (#40). */
  flag: (id: string, reason: string) =>
    api<ReviewDto>(`/partner/reviews/${id}/flag`, { method: "POST", body: { reason } }),
}

/* ------------------------------------------------ partner analytics (#62) -- */

/* ------------------------------------------------- partner listing (#69) -- */

export type PhotoView = {
  id: string
  category: string
  caption: string
  position: number
  status: "pending" | "approved" | "rejected"
  url: string | null
  seed: string
}

export type ListingDetail = {
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
  /*
   * House rules. Cancellation is NOT here — it belongs to a rate plan
   * (rule #1), because two rates on the same room carry different terms.
   */
  policyPayment: string
  policyPets: string
  policySmoking: string
  policyChildren: string
  status: string
  /** What is waiting for the platform, so a partner sees their own edit (#71). */
  pendingChanges: Record<string, unknown> | null
  createdAt: string
  /**
   * Amenity SLUGS this property has (rule #74).
   *
   * The whole set, because the extranet splits them across two screens by
   * category and a save replaces all of them — each screen needs to know the
   * other's answers or it clears them.
   */
  amenities: string[]
  photos: PhotoView[]
  /** Everything still missing before it can be published (#70). */
  gaps: string[]
}

export const listingApi = {
  get: (propertyId: string) => api<ListingDetail>(`/partner/listings/${propertyId}`),

  update: (propertyId: string, patch: Record<string, unknown>) =>
    api<ListingDetail>(`/partner/listings/${propertyId}`, { method: "PATCH", body: patch }),

  /** How well the page is built, and why (rule #99). */
  score: (propertyId: string) =>
    api<{
      propertyId: string
      name: string
      total: number
      band: "excellent" | "good" | "needs_work"
      categories: {
        key: string
        name: string
        score: number | null
        weight: number
        applicable: boolean
        tip: string
      }[]
    }>(`/partner/listings/${propertyId}/score`),
}

/* -------------------------------------------------- listing photos (#73) -- */

export const photosApi = {
  /**
   * A place to PUT one file. No bytes come through this API.
   *
   * The type and the size are checked before a URL is handed out, so an
   * oversized upload is refused in a round trip rather than after it.
   */
  uploadUrl: (
    propertyId: string,
    body: { fileName: string; contentType: string; size: number }
  ) =>
    api<{ key: string; url: string; method: string; headers: Record<string, string> }>(
      `/partner/listings/${propertyId}/photos/upload-url`,
      { method: "POST", body }
    ),

  /** Confirming the bytes landed. The photo is born `pending` (rule #73). */
  confirm: (
    propertyId: string,
    body: { key: string; category?: string; caption?: string }
  ) => api<PhotoView>(`/partner/listings/${propertyId}/photos`, { method: "POST", body }),

  update: (
    propertyId: string,
    photoId: string,
    patch: { category?: string; caption?: string; position?: number }
  ) =>
    api<PhotoView>(`/partner/listings/${propertyId}/photos/${photoId}`, {
      method: "PATCH",
      body: patch,
    }),

  remove: (propertyId: string, photoId: string) =>
    api<{ removed: true }>(`/partner/listings/${propertyId}/photos/${photoId}`, {
      method: "DELETE",
    }),
}

/* ------------------------------------------------------ rooms & rates (#27) -- */

export type RoomDto = {
  id: string
  name: string
  description: string
  maxAdults: number
  maxChildren: number
  maxOccupancy: number
  bed: string
  size: number
  features: string[]
  units: number
  status: string
  seed: string
  /** The default rate plan's nightly price. A room has none of its own. */
  basePrice: number | null
  /** Which plan that price belongs to — "edit the rate" writes there. */
  defaultRatePlanId: string | null
  ratePlans: number
}

/** Which dates a unit reduction could not reach, and why. */
export type RoomUnitsResult = {
  applied: number
  blocked: string[]
}

export const roomsApi = {
  list: (propertyId: string) => api<RoomDto[]>(`/partner/properties/${propertyId}/rooms`),

  /**
   * The update reports what a UNIT change did to the calendar.
   *
   * Lowering the count is not all-or-nothing: dates that already hold more
   * bookings than the new number keep the old one, and are named. A screen
   * that swallowed `units` would tell a partner they now sell 4 rooms while
   * three weeks in their calendar still sell 6.
   */
  update: (roomId: string, patch: Record<string, unknown>) =>
    api<{ room: RoomDto; units: RoomUnitsResult | null }>(`/partner/rooms/${roomId}`, {
      method: "PATCH",
      body: patch,
    }),

  create: (propertyId: string, body: Record<string, unknown>) =>
    api<RoomDto>(`/partner/properties/${propertyId}/rooms`, { method: "POST", body }),

  /**
   * Repricing.
   *
   * The rate lives on the PLAN, not the room (rule #27) — a room can be sold
   * on several, and they carry different terms and different prices.
   */
  updateRatePlan: (ratePlanId: string, patch: Record<string, unknown>) =>
    api<unknown>(`/partner/rate-plans/${ratePlanId}`, { method: "PATCH", body: patch }),
}

/* --------------------------------------------------------- inventory calendar */

/**
 * One night on one rate plan, already resolved.
 *
 * Every field is the ANSWER, not the override: the server has folded the plan's
 * defaults into whatever was set for the date, so a screen never has to know
 * which layer a number came from. `isOverridden` is the one thing it cannot
 * work out for itself — without it a partner cannot tell "I set this price"
 * from "this is simply the plan's price".
 */
export type CalendarNight = {
  date: string
  /** Cents. */
  rate: number
  minStay: number
  minStayThrough: number | null
  maxStay: number | null
  closedToArrival: boolean
  closedToDeparture: boolean
  minAdvanceHours: number | null
  isOverridden: boolean
}

export type CalendarStock = {
  date: string
  totalUnits: number
  sellableUnits: number
  bookedUnits: number
  isClosed: boolean
  /**
   * Whether a row actually exists for that night.
   *
   * A room that has never been sold on a date has no inventory row; the numbers
   * above are then the room's own defaults rather than something anyone set.
   */
  isMaterialised: boolean
}

export type CalendarRatePlan = {
  id: string
  name: string
  basePrice: number
  status: string
  /**
   * What the PLAN says, beside what each night resolved to.
   *
   * Every night is already resolved against these, so the resolved numbers
   * alone cannot answer "did somebody set this here". A screen listing the
   * nights that carry a restriction compares against these; without them a
   * plan whose own minimum is two nights reads as though every night in the
   * year had been restricted by hand.
   */
  defaultMinStay: number
  defaultMaxStay: number | null
  nights: CalendarNight[]
}

export type CalendarRoom = {
  id: string
  name: string
  units: number
  status: string
  stock: CalendarStock[]
  ratePlans: CalendarRatePlan[]
}

export type CalendarView = {
  from: string
  to: string
  rooms: CalendarRoom[]
}

/**
 * What a copy actually did.
 *
 * `datesAffected` counts the target nights that changed — including the ones
 * CLEARED, because a source night with no override means "no override here
 * either" and a screen reporting only what it wrote would say nothing happened
 * when it had in fact removed a price (rule #100).
 */
export type CopyRatesResult = {
  datesAffected: number
  targetRatePlanId: string
}

export const inventoryApi = {
  /**
   * What is actually being sold, night by night.
   *
   * The one honest source for "occupied tonight": it is the same ledger the
   * booking transaction locks and the `CHECK` constraint guards, so it cannot
   * disagree with what the database will let somebody book.
   */
  calendar: (propertyId: string, q: { from: string; to: string; roomId?: string }) =>
    api<CalendarView>(`/partner/inventory/calendar/${propertyId}`, { query: q }),

  close: (body: Record<string, unknown>) =>
    api<{ rooms: number; datesAffected: number }>("/partner/inventory/close", {
      method: "POST",
      body,
    }),

  setRates: (body: Record<string, unknown>) =>
    api<{ datesAffected: number }>("/partner/inventory/rates", { method: "POST", body }),

  copyRates: (body: Record<string, unknown>) =>
    api<CopyRatesResult>("/partner/inventory/rates/copy", { method: "POST", body }),
}

/* ----------------------------------------------------------------- rate plans */

export type RatePlanDto = {
  id: string
  roomId: string
  name: string
  basePrice: number
  cancellation: CancellationPolicy
  /** Generated from the same fields the refund is computed from (rule #1). */
  cancellationText: string
  paymentMode: string
  inclusions: string[]
  defaultMinStay: number
  defaultMaxStay: number | null
  status: string
  isDefault: boolean
}

/** A plan carrying the room it sells, from the property-wide list. */
export type PropertyRatePlan = RatePlanDto & {
  roomName: string
  roomUnits: number
  roomStatus: string
}

export const ratePlansApi = {
  /**
   * Every plan across the property, read-only.
   *
   * Creating and editing a plan happens under its ROOM, where the role split
   * lives — a manager may reprice, only an org admin may change what was
   * promised. This direction is for the screens that summarise a whole hotel.
   */
  forProperty: (propertyId: string) =>
    api<PropertyRatePlan[]>(`/partner/properties/${propertyId}/rate-plans`),
}

/* ------------------------------------------- per-guest pricing (rule #101) -- */

export const occupancyApi = {
  /**
   * The grid, resolved.
   *
   * Every guest level up to the room's capacity comes back with a price, and
   * `isSet` says which of them the partner actually chose — the rest are what
   * the plan already charges. Without that flag a screen cannot tell a
   * deliberate £20 single-occupancy discount from the base rate showing
   * through.
   */
  get: (ratePlanId: string) =>
    api<OccupancyGridView>(`/partner/rate-plans/${ratePlanId}/occupancy-prices`),

  /**
   * PUT, not PATCH.
   *
   * The numbers only mean anything relative to each other, so the grid is
   * replaced whole — a half-applied matrix where three guests cost less than
   * two is a price nobody meant to publish.
   */
  set: (ratePlanId: string, body: OccupancyPricesInput) =>
    api<OccupancyGridView>(`/partner/rate-plans/${ratePlanId}/occupancy-prices`, {
      method: "PUT",
      body,
    }),
}

/* ------------------------------------------------------------- value-adds -- */

export type ValueAddDto = {
  id: string
  name: string
  category: string
  description: string
  /** Cents. Zero is legal — a free extra is still an extra worth listing. */
  price: number
  /** From the shared list, so a unit added there stops this compiling. */
  unit: (typeof VALUE_ADD_UNITS)[number]
  active: boolean
}

export const valueAddsApi = {
  list: (propertyId: string) =>
    api<ValueAddDto[]>(`/partner/properties/${propertyId}/value-adds`),

  create: (propertyId: string, body: ValueAddCreateInput) =>
    api<ValueAddDto>(`/partner/properties/${propertyId}/value-adds`, {
      method: "POST",
      body,
    }),

  /**
   * There is no delete, deliberately.
   *
   * A booking's add-ons point at these rows, and "what was this $65 line" has
   * to stay answerable long after a property stops selling it. `active: false`
   * retires it instead.
   */
  update: (valueAddId: string, patch: ValueAddUpdateInput) =>
    api<ValueAddDto>(`/partner/value-adds/${valueAddId}`, { method: "PATCH", body: patch }),
}

/* ------------------------------------------------------------ promotions -- */

export type PromotionDto = {
  id: string
  name: string
  /** Marketing categorisation only (rule #16). Pricing never reads it. */
  kind: (typeof PROMOTION_KINDS)[number]
  discountType: "percent" | "amount" | "free_night"
  /** A percentage, a number of cents, or a count of free nights. */
  discountValue: number
  startDate: string
  endDate: string
  /** `null` = any length of stay. */
  minStay: number | null
  channel: "all" | "mobile" | "genius"
  status: (typeof PROMOTION_STATUSES)[number]
  createdAt: string
  propertyIds: string[]
  /** Empty = every room of every listed property (rule #21). */
  roomIds: string[]
}

export const promotionsApi = {
  list: (query: { status?: string; limit?: number } = {}) =>
    api<PromotionDto[]>("/partner/promotions", { query }),

  create: (body: PromotionCreateInput) =>
    api<PromotionDto>("/partner/promotions", { method: "POST", body }),

  /**
   * There is no delete.
   *
   * Every booking a promotion discounted points at it, and "why was this stay
   * $400 cheaper" has to stay answerable. `status: "ended"` retires it.
   */
  update: (id: string, patch: PromotionUpdateInput) =>
    api<PromotionDto>(`/partner/promotions/${id}`, { method: "PATCH", body: patch }),
}

/* ------------------------------------------------------- ranking (rule #104) */

export type PropertyRanking = {
  propertyId: string
  name: string
  city: string
  /** 0–10000, so it sorts in the database rather than in memory. */
  score: number
  /**
   * Position and factors can disagree by a day, and that is honest.
   *
   * The POSITION is last night's materialised sort; the FACTORS are computed
   * now. Pretending they were taken at the same moment would be the lie.
   */
  position: number | null
  total: number | null
  factors: RankingFactor[]
  /** The factor costing the most, weighted — what to fix first. */
  weakest: RankingFactor | null
  rankedAt: string | null
}

export const rankingApi = {
  get: (propertyId: string) =>
    api<PropertyRanking>(`/partner/analytics/ranking/${propertyId}`),
}

/* -------------------------------------------------------------- analytics -- */

/**
 * Every analytics screen, typed from the API's OWN contract.
 *
 * These shapes are not written here. `SalesView`, `PaceView` and the rest come
 * from `@stayora/shared`, which is what the Nest routes return — so a field
 * renamed on one side stops the other compiling instead of quietly reading
 * `undefined` on a dashboard.
 *
 * The one exception is `demand`, which has no exported view type yet; it is
 * written out below and marked as the promise it is.
 */
export type DemandView = {
  /** The cities this partner actually sells in. */
  cities: string[]
  destinations: {
    destination: string
    searches: number
    /** Searches that found nothing — unmet demand, which is the point. */
    emptyResults: number
    averageResults: number
    travellers: number
  }[]
  trend: { period: string; searches: number; emptyResults: number }[]
}

export type AnalyticsRange = {
  from: string
  to: string
  /** Absent = every property the caller may see. */
  propertyId?: string
}

export const analyticsApi = {
  sales: (q: AnalyticsRange & { granularity?: "day" | "week" | "month" }) =>
    api<SalesView>("/partner/analytics/sales", { query: q }),

  /**
   * Per-property trading, by the night STAYED (rule #62).
   *
   * ADR, RevPAR and occupancy are computed on the server from `booking_nights`
   * — the extranet used to work them out in the browser from a fixture, which
   * meant every property screen quoted a different number for the same hotel.
   */
  performance: (q: AnalyticsRange) =>
    api<PerformanceRowView[]>("/partner/analytics/performance", { query: q }),

  pace: (q: AnalyticsRange & { granularity?: "day" | "week" | "month" }) =>
    api<PaceView>("/partner/analytics/pace", { query: q }),

  cancellations: (q: AnalyticsRange) =>
    api<CancellationsView>("/partner/analytics/cancellations", { query: q }),

  bookWindow: (q: AnalyticsRange) =>
    api<BookWindowView>("/partner/analytics/book-window", { query: q }),

  bookers: (q: AnalyticsRange) =>
    api<BookersView>("/partner/analytics/bookers", { query: q }),

  genius: (q: AnalyticsRange) =>
    api<GeniusView>("/partner/analytics/genius", { query: q }),

  demand: (q: AnalyticsRange) =>
    api<DemandView>("/partner/analytics/demand", { query: q }),

  /** Needs ONE property — "how do I compare" has no answer for a portfolio. */
  comparables: (q: AnalyticsRange & { propertyId: string }) =>
    api<ComparablesView>("/partner/analytics/comparables", { query: q }),
}

/* ---------------------------------------------------------------- finance -- */

/**
 * A payout, signed.
 *
 * `net` can be NEGATIVE: a month of refunds bigger than the month's takings
 * means the property owes the platform, and `carryIn` is what a previous
 * period left behind (rule #52). A screen showing the absolute value would
 * report money arriving when money is leaving.
 */
export type PayoutDto = {
  id: string
  periodStart: string
  periodEnd: string
  gross: number
  commission: number
  carryIn: number
  net: number
  direction: string
  status: string
  paidAt: string | null
  failureReason: string | null
  createdAt: string
}

export type PayoutAccountDto = {
  holderName: string
  bankName: string
  last4: string
  currency: string
  status: string
} | null

export type InvoiceDto = {
  id: string
  ref: string
  partnerOrgId: string
  periodStart: string
  periodEnd: string
  grossAmount: number
  /** The commission owed. `grossAmount` is what the bookings were worth. */
  amount: number
  bookingCount: number
  currency: string
  status: string
  dueDate: string
  paidAt: string | null
  paymentNote: string
  createdAt: string
}

export type FinanceRange = { from: string; to: string; propertyId?: string }

export const financeApi = {
  overview: (q: FinanceRange) =>
    api<FinanceOverview>("/partner/finance/overview", { query: q }),

  revenue: (q: FinanceRange & { granularity?: "day" | "week" | "month" }) =>
    api<FinanceRevenueView>("/partner/finance/revenue", { query: q }),

  commissions: (q: FinanceRange) =>
    api<CommissionReportRow[]>("/partner/finance/commissions", { query: q }),

  transactions: (q: FinanceRange & { limit?: number; cursor?: string }) =>
    api<{ items: FinanceTransaction[]; nextCursor: string | null }>(
      "/partner/finance/transactions",
      { query: q }
    ),

  payouts: () => api<PayoutDto[]>("/partner/payouts"),

  /** `null` until a partner has pointed the money somewhere. */
  payoutAccount: () => api<PayoutAccountDto>("/partner/payouts/account"),

  invoices: () => api<InvoiceDto[]>("/partner/invoices"),
}

/* ------------------------------------------------------------ partner inbox */

export const partnerInboxApi = {
  /**
   * Guest conversations, one row per booking.
   *
   * The LIST lives here; reading and replying to one conversation stays on
   * `/bookings/:id/messages`, where both sides already meet. A second reply
   * route for the partner would be a second code path into the same table, and
   * the two would drift on who is allowed to write.
   */
  conversations: (query: { limit?: number; before?: string } = {}) =>
    api<{ items: BookingConversation[]; nextCursor: string | null }>(
      "/partner/messages",
      { query }
    ),

  /** The property's own tickets with the platform — not a guest's. */
  tickets: () => api<SupportThreadView[]>("/partner/support"),

  ticket: (threadId: string) =>
    api<{ thread: SupportThreadView; messages: SupportMessageView[] }>(
      `/partner/support/${threadId}`
    ),

  openTicket: (body: PartnerTicketInput) =>
    api<SupportThreadView>("/partner/support", { method: "POST", body }),

  replyToTicket: (threadId: string, body: string) =>
    api<SupportMessageView>(`/partner/support/${threadId}/reply`, {
      method: "POST",
      body: { body },
    }),
}

/* --------------------------------------------------------- team & contracts */

export type TeamMember = {
  id: string
  userId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  /** What they do, not what they may do. Free text on purpose. */
  jobTitle: string
  role: "admin" | "manager" | "staff"
  status: string
  /** Empty = every property the org owns. */
  propertyIds: string[]
  lastLoginAt: string | null
  createdAt: string
}

export type TeamInvite = {
  id: string
  email: string
  role: "admin" | "manager" | "staff"
  propertyIds: string[]
  expiresAt: string
  createdAt: string
}

export const teamApi = {
  list: () => api<{ members: TeamMember[]; invites: TeamInvite[] }>("/partner/team"),

  /**
   * Inviting, not creating.
   *
   * There is no "add user" — an account belongs to a person, and the platform
   * cannot make one on somebody's behalf and set their password. The invite is
   * a token they redeem, which is also what proves the address is theirs.
   */
  invite: (body: InviteCreateInput) =>
    api<TeamInvite>("/partner/team/invites", { method: "POST", body }),

  revokeInvite: (id: string) =>
    api<{ ok: true }>(`/partner/team/invites/${id}`, { method: "DELETE" }),

  update: (memberId: string, patch: MemberUpdateInput) =>
    api<TeamMember>(`/partner/team/${memberId}`, { method: "PATCH", body: patch }),

  remove: (memberId: string) =>
    api<{ ok: true }>(`/partner/team/${memberId}`, { method: "DELETE" }),
}

export const orgApi = {
  get: () => api<PartnerOrgView>("/partner/org"),

  update: (patch: OrgUpdateInput) =>
    api<PartnerOrgView>("/partner/org", { method: "PATCH", body: patch }),
}

export const contractsApi = {
  /**
   * What has been agreed, and what has not.
   *
   * A signature is final — a database trigger refuses any update that touches
   * the organisation, the version, the text, who signed or when (rule #98) —
   * so a signed contract is shown as a record, never as a form.
   */
  list: () =>
    api<{ signed: PartnerContractView[]; outstanding: ContractTemplateView[] }>(
      "/partner/contracts"
    ),

  accept: (templateId: string) =>
    api<PartnerContractView>(`/partner/contracts/templates/${templateId}/accept`, {
      method: "POST",
    }),
}

/* ----------------------------------------------------------- destinations -- */

export type Destination = {
  city: string
  country: string
  /** Live properties in that city. The card's count is what a click finds. */
  properties: number
  /** Cheapest live rate there, in cents. */
  fromPrice: number
  /** Stable image seed — the same city always draws the same picture. */
  seed: string
}

export const destinationsApi = {
  list: (limit = 8) => api<Destination[]>("/destinations", { query: { limit } }),
}

/* ------------------------------------------------------ platform stats (#113) */

export type PlatformStats = {
  /** Live, publicly visible properties. */
  properties: number
  countries: number
  cities: number
  /** Published reviews only. */
  reviews: number
  /** `null` until somebody has left one — never 0, which reads as zero stars. */
  averageRating: number | null
}

/**
 * What the pages describing the platform may state as fact.
 *
 * `/about` and `/press` carried "2,400+ properties", "68 countries" and "1.2
 * million guests" over a catalogue of eight in two — figures a visitor could
 * disprove by clicking Hotels. There is deliberately no guest count here.
 */
export const platformApi = {
  stats: () => api<PlatformStats>("/platform/stats"),
}

/* ------------------------------------------------- registration (rule #103) */

export const registrationApi = {
  /**
   * The applicant's own draft. Creating it on first read is deliberate — there
   * is no "start an application" step to forget.
   *
   * There is no `:id` anywhere on this surface: a registration is always the
   * caller's own, which IS the access control. A route that cannot name
   * somebody else's cannot be asked for it.
   */
  mine: () => api<RegistrationView>("/join/registration"),

  save: (body: { step?: number; data: Record<string, unknown> }) =>
    api<RegistrationView>("/join/registration", { method: "PATCH", body }),

  /** Refused while anything is still missing — every gap, not the first. */
  submit: () => api<RegistrationView>("/join/registration/submit", { method: "POST" }),

  /**
   * A place to PUT one file, checked before a URL is handed out.
   *
   * The same three-step upload as a listing photo (rule #73) — presign, PUT
   * the bytes at storage, confirm — and it carries BOTH the applicant's
   * verification documents and the property's photographs. `kind: "photo"` is
   * the second: there is no property to hang a gallery off until the platform
   * approves this, so approval carries these rows across.
   */
  uploadUrl: (body: {
    kind: RegistrationDocumentView["kind"]
    fileName: string
    contentType: string
    size: number
  }) =>
    api<{ key: string; url: string; method: string; headers: Record<string, string> }>(
      "/join/registration/documents/upload-url",
      { method: "POST", body }
    ),

  /** Confirming the bytes landed. A file never confirmed is not a document. */
  confirmDocument: (body: {
    kind: RegistrationDocumentView["kind"]
    fileName: string
    contentType: string
    size: number
    key: string
  }) =>
    api<RegistrationDocumentView>("/join/registration/documents", {
      method: "POST",
      body,
    }),

  removeDocument: (documentId: string) =>
    api<{ removed: true }>(`/join/registration/documents/${documentId}`, {
      method: "DELETE",
    }),
}
