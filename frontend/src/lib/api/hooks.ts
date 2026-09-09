"use client"

/**
 * react-query bindings for the Stayora API.
 *
 * Pages consume these, never `endpoints.ts` directly, so caching, invalidation
 * and the loading/error contract live in one place — the same arrangement the
 * admin surface already uses, so there is one pattern in the codebase and not
 * two.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query"
import type {
  FavoriteItem,
  LoginInput,
  OccupancyGridView,
  OccupancyPricesInput,
  ProfileUpdateInput,
  PromotionCreateInput,
  PropertyRating,
  PromotionUpdateInput,
  ValueAddCreateInput,
  ValueAddUpdateInput,
  BookersView,
  BookingConversation,
  BookWindowView,
  CancellationsView,
  CommissionReportRow,
  ComparablesView,
  FinanceOverview,
  FinanceRevenueView,
  FinanceTransaction,
  GeniusView,
  PaceView,
  ContractTemplateView,
  InviteCreateInput,
  MemberUpdateInput,
  OrgUpdateInput,
  PartnerContractView,
  PartnerTicketInput,
  RegistrationDocumentView,
  RegistrationPatchInput,
  RegistrationView,
  PerformanceRowView,
  PropertySearchInput,
  SupportMessageView,
  SupportThreadView,
  SalesView,
} from "@stayora/shared"

import {
  accountApi,
  analyticsApi,
  authApi,
  bookingsApi,
  catalogApi,
  favoritesApi,
  listingApi,
  notificationsApi,
  partnerApi,
  partnerBookingsApi,
  partnerReviewsApi,
  paymentsApi,
  photosApi,
  roomsApi,
  inventoryApi,
  ratePlansApi,
  occupancyApi,
  valueAddsApi,
  promotionsApi,
  rankingApi,
  financeApi,
  partnerInboxApi,
  teamApi,
  orgApi,
  contractsApi,
  pricingApi,
  reviewsApi,
  destinationsApi,
  platformApi,
  registrationApi,
  supportApi,
  type BookingDto,
  type NotificationSettingsDto,
  type ListingDetail,
  type PartnerProperty,
  type PhotoView,
  type RoomDto,
  type CalendarView,
  type RoomUnitsResult,
  type PropertyRatePlan,
  type CopyRatesResult,
  type ValueAddDto,
  type PromotionDto,
  type Destination,
  type PlatformStats,
  type PropertyRanking,
  type AnalyticsRange,
  type DemandView,
  type FinanceRange,
  type InvoiceDto,
  type PayoutAccountDto,
  type PayoutDto,
  type TeamMember,
  type TeamInvite,
  type PartnerOrgView,
  type NotificationPreferencesDto,
  type NotificationPreferenceRow,
  type ReviewDto,
  type Quote,
  type SearchResponse,
  type SessionUser,
} from "./endpoints"
import { ApiError } from "./errors"
import { idempotencyKey } from "./client"

/** Hierarchical, so `["stayora"]` clears everything. */
export const keys = {
  all: ["stayora"] as const,
  me: ["stayora", "me"] as const,
  search: (query: unknown) => ["stayora", "properties", "search", query ?? {}] as const,
  property: (slug: string) => ["stayora", "properties", slug] as const,
  bookings: ["stayora", "bookings"] as const,
  booking: (id: string) => ["stayora", "bookings", id] as const,
  payment: (bookingId: string) => ["stayora", "payments", bookingId] as const,
  favorites: ["stayora", "favorites"] as const,
  /* Two keys: the list varies by filter, the group invalidates both. */
  notificationsAll: ["stayora", "notifications"] as const,
  notifications: (unreadOnly: boolean) => ["stayora", "notifications", { unreadOnly }] as const,
  notificationSettings: ["stayora", "notifications", "settings"] as const,
  profile: ["stayora", "profile"] as const,
  sessions: ["stayora", "sessions"] as const,
  reviews: ["stayora", "reviews"] as const,
  reviewable: ["stayora", "reviews", "reviewable"] as const,
  tickets: ["stayora", "tickets"] as const,
  ticket: (id: string) => ["stayora", "tickets", id] as const,
  partnerProperties: ["stayora", "partner", "properties"] as const,
  partnerOrg: ["stayora", "partner", "org"] as const,
  partnerBookings: ["stayora", "partner", "bookings"] as const,
  partnerReviewsAll: ["stayora", "partner", "reviews"] as const,
  partnerReviews: (status?: string) =>
    ["stayora", "partner", "reviews", { status: status ?? "all" }] as const,
  performance: (range: unknown) => ["stayora", "partner", "performance", range] as const,
  listing: (id: string) => ["stayora", "partner", "listing", id] as const,
  listingScore: (id: string) => ["stayora", "partner", "listing", id, "score"] as const,
  rooms: (propertyId: string) => ["stayora", "partner", "rooms", propertyId] as const,
  ratePlans: (propertyId: string) => ["stayora", "partner", "rate-plans", propertyId] as const,
  occupancyPrices: (ratePlanId: string) =>
    ["stayora", "partner", "occupancy-prices", ratePlanId] as const,
  valueAdds: (propertyId: string) => ["stayora", "partner", "value-adds", propertyId] as const,
  /*
   * Not keyed by property.
   *
   * A promotion belongs to the ORG and can cover several properties at once,
   * so keying this per property would cache the same rows under every one of
   * them and leave the others stale after an edit.
   */
  promotions: ["stayora", "partner", "promotions"] as const,
  ranking: (propertyId: string) => ["stayora", "partner", "ranking", propertyId] as const,
  analytics: (screen: string, range: object) =>
    ["stayora", "partner", "analytics", screen, range] as const,
  finance: (screen: string, range: object) =>
    ["stayora", "partner", "finance", screen, range] as const,
  payouts: ["stayora", "partner", "payouts"] as const,
  payoutAccount: ["stayora", "partner", "payout-account"] as const,
  invoices: ["stayora", "partner", "invoices"] as const,
  partnerConversations: ["stayora", "partner", "conversations"] as const,
  bookingMessages: (bookingId: string) =>
    ["stayora", "bookings", bookingId, "messages"] as const,
  partnerTickets: ["stayora", "partner", "tickets"] as const,
  partnerTicket: (threadId: string) =>
    ["stayora", "partner", "tickets", threadId] as const,
  team: ["stayora", "partner", "team"] as const,
  contracts: ["stayora", "partner", "contracts"] as const,
  propertyReviews: (slug: string) => ["stayora", "properties", slug, "reviews"] as const,
  destinations: (limit: number) => ["stayora", "destinations", limit] as const,
  registration: ["stayora", "join", "registration"] as const,
  notificationPreferences: ["stayora", "notifications", "preferences"] as const,
  calendar: (propertyId: string, range: { from: string; to: string; roomId?: string }) =>
    ["stayora", "partner", "calendar", propertyId, range] as const,
}

/* ------------------------------------------------------------------ auth -- */

/**
 * Who is signed in, or `null`.
 *
 * Never retried. A 401 is the ordinary answer for a visitor, not a failure, and
 * retrying it three times before rendering the page would delay every
 * signed-out load for nothing.
 */
export function useSession() {
  return useQuery<SessionUser | null, ApiError>({
    queryKey: keys.me,
    queryFn: authApi.me,
    staleTime: 60_000,
    retry: false,
  })
}

/**
 * Prove an address from the emailed token.
 *
 * The session is invalidated on success rather than patched: `emailVerified`
 * lives on `/auth/me`, and a stale `false` there is what makes a verified
 * partner keep seeing "please confirm your email".
 */
export function useVerifyEmail() {
  const client = useQueryClient()
  return useMutation<{ verified: true }, ApiError, string>({
    mutationFn: (token) => authApi.verifyEmail(token),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.me })
    },
  })
}

export function useResendVerification() {
  return useMutation<{ pending: true }, ApiError, void>({
    mutationFn: () => authApi.resendVerification(),
  })
}

export function useLogin() {
  const client = useQueryClient()
  // The API's own schema, not a hand-written shape — `remember` is required
  // and a local copy would have quietly omitted it.
  return useMutation<{ user: SessionUser }, ApiError, LoginInput>({
    mutationFn: (body) => authApi.login(body),
    onSuccess: ({ user }) => {
      // Seeded rather than invalidated: the response already carries the user,
      // and a refetch would show a signed-out flash on the way back.
      client.setQueryData(keys.me, user)
      /*
       * The price a guest is shown depends on their tier (rule #3), so every
       * quote taken while signed out is now potentially wrong.
       */
      void client.invalidateQueries({ queryKey: ["stayora", "properties"] })
    },
  })
}

export function useLogout() {
  const client = useQueryClient()
  return useMutation<void, ApiError, void>({
    mutationFn: () => authApi.logout(),
    // Everything cached was fetched as somebody. None of it is theirs now.
    onSuccess: () => client.clear(),
  })
}

/* ------------------------------------------------------------- catalogue -- */

export function useSearch(
  query: Partial<PropertySearchInput>,
  options?: Partial<UseQueryOptions<SearchResponse, ApiError>>
) {
  return useQuery<SearchResponse, ApiError>({
    queryKey: keys.search(query),
    queryFn: ({ signal }) => catalogApi.search(query, { signal }),
    staleTime: 30_000,
    ...options,
  })
}

export function useProperty(slug: string) {
  return useQuery<Awaited<ReturnType<typeof catalogApi.detail>>, ApiError>({
    queryKey: keys.property(slug),
    queryFn: () => catalogApi.detail(slug),
    staleTime: 60_000,
    enabled: slug.length > 0,
    // A hotel that does not exist will not start existing on the third try.
    retry: (count, error) => !error.isNotFound && count < 2,
  })
}

/**
 * The amenity vocabulary.
 *
 * Long-lived: the platform's controlled list changes when an administrator
 * edits it, which is rare. Refetching it on every search would be a request
 * per keystroke for a list that is the same all day.
 */
export function useAmenities() {
  return useQuery({
    queryKey: ["stayora", "amenities"],
    queryFn: catalogApi.amenities,
    staleTime: 60 * 60 * 1000,
  })
}

/* ----------------------------------------------------------------- quote -- */

/**
 * The price, from the server.
 *
 * A MUTATION although it only reads, because it is a POST that mints a signed
 * token with a lifetime. Caching it as a query would let a guest book against
 * a price that expired while they were choosing.
 */
export function useQuote(slug: string) {
  return useMutation<Quote, ApiError, Parameters<typeof pricingApi.quote>[1]>({
    mutationFn: (body) => pricingApi.quote(slug, body),
  })
}

/**
 * The same quote, as a QUERY.
 *
 * A quote is a read that happens to need a body. Shaped as a mutation, a
 * screen that re-prices as the guest changes dates has to fire it from an
 * effect — which means a `setState` cascade on every settle, and no caching of
 * a price the guest has already been shown.
 *
 * `useQuote` stays for the checkout, where quoting is an ACTION the guest
 * takes. This is for screens where the price simply follows the form.
 */
export function useLiveQuote(
  slug: string,
  input: Parameters<typeof pricingApi.quote>[1] | null
) {
  return useQuery<Quote, ApiError>({
    queryKey: ["stayora", "quote", slug, input ?? {}],
    queryFn: () => pricingApi.quote(slug, input!),
    enabled: Boolean(slug) && input !== null,
    // A signed quote expires; re-asking on focus would surprise nobody, but
    // re-asking constantly would price the same stay over and over.
    staleTime: 60_000,
    retry: false,
  })
}

/* -------------------------------------------------------------- bookings -- */

/**
 * Creating a booking, retry-safe.
 *
 * The idempotency key is minted ONCE per hook instance and reused for every
 * attempt, which is the whole mechanism (rule #23). Generating it inside
 * `mutationFn` would give each retry a fresh key, and a network blip after the
 * server committed would book the same stay twice.
 */
export function useCreateBooking() {
  const client = useQueryClient()
  const key = idempotencyKey()

  return useMutation<
    { booking: BookingDto },
    ApiError,
    Parameters<typeof bookingsApi.create>[0]
  >({
    mutationFn: (body) => bookingsApi.create(body, key),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.bookings }),
  })
}

export function useBooking(id: string) {
  return useQuery<Awaited<ReturnType<typeof bookingsApi.get>>, ApiError>({
    queryKey: keys.booking(id),
    queryFn: () => bookingsApi.get(id),
    enabled: id.length > 0,
  })
}

/**
 * `enabled`, because this renders on the PUBLIC support page.
 *
 * "A 401 is the ordinary answer" was true and still left every signed-out
 * visitor with a red error in their console on a page they were meant to be
 * able to use, and the API answering a question nobody had standing to ask.
 * The ordinary answer to "do you have bookings" for somebody with no account
 * is not to ask.
 */
export function useMyBookings(enabled = true) {
  return useQuery<BookingDto[], ApiError>({
    queryKey: keys.bookings,
    queryFn: bookingsApi.mine,
    enabled,
    retry: false,
  })
}

export function useModifyBooking(id: string) {
  const client = useQueryClient()
  return useMutation<
    Awaited<ReturnType<typeof bookingsApi.modify>>,
    ApiError,
    string
  >({
    mutationFn: (quoteToken) => bookingsApi.modify(id, quoteToken),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.bookings })
      void client.invalidateQueries({ queryKey: keys.booking(id) })
    },
  })
}

export function useCancelBooking(id: string) {
  const client = useQueryClient()
  return useMutation<Awaited<ReturnType<typeof bookingsApi.cancel>>, ApiError, string>({
    mutationFn: (reason) => bookingsApi.cancel(id, reason),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.bookings })
      void client.invalidateQueries({ queryKey: keys.booking(id) })
    },
  })
}

/* -------------------------------------------------------------- payments -- */

export function useStartPayment() {
  return useMutation<Awaited<ReturnType<typeof paymentsApi.start>>, ApiError, string>({
    mutationFn: (bookingId) => paymentsApi.start(bookingId),
  })
}

/**
 * Watches a booking until the payment settles.
 *
 * Polling, because settlement arrives at the API as a webhook from the
 * provider — there is no way for the browser to be told directly. It stops the
 * moment the booking leaves `pending`, so a confirmed booking costs nothing.
 */
export function useAwaitConfirmation(id: string, enabled: boolean) {
  return useQuery<Awaited<ReturnType<typeof bookingsApi.get>>, ApiError>({
    queryKey: keys.booking(id),
    queryFn: () => bookingsApi.get(id),
    enabled: enabled && id.length > 0,
    refetchInterval: (query) =>
      query.state.data?.booking.status === "pending" ? 2_000 : false,
  })
}

/* ------------------------------------------------------------ favourites -- */

/**
 * `enabled`, because the heart is on every property card on the marketplace.
 *
 * Unguarded, this fired on the home page, the search results and every property
 * page — one 401 per visit, for every visitor who has not signed up yet, which
 * is most of them.
 */
export function useFavorites(enabled = true) {
  return useQuery<{ items: FavoriteItem[]; nextCursor: string | null }, ApiError>({
    queryKey: keys.favorites,
    queryFn: () => favoritesApi.list(),
    enabled,
    retry: false,
  })
}

/**
 * Saving and un-saving, from one hook.
 *
 * One mutation rather than two because the heart is a toggle, and two hooks
 * would let a component fire both at once from the same click.
 */
export function useToggleFavorite() {
  const client = useQueryClient()

  return useMutation<{ saved: boolean }, ApiError, { propertyId: string; saved: boolean }>({
    // The union of the two responses narrows to what both agree on: whether it
    // is saved afterwards. That is the only thing a heart needs to know.
    mutationFn: (input) =>
      input.saved
        ? favoritesApi.remove(input.propertyId)
        : favoritesApi.save(input.propertyId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.favorites })
    },
  })
}

/* --------------------------------------------------------- notifications -- */

/**
 * `enabled` because the bell lives in the PUBLIC header.
 *
 * A signed-out visitor has no notifications and asking for theirs is a
 * guaranteed 401 on every page of the marketplace. The caller knows whether
 * there is a session; this query should not fire until there is.
 */
export function useNotifications(unreadOnly = false, enabled = true) {
  return useQuery({
    queryKey: keys.notifications(unreadOnly),
    queryFn: () => notificationsApi.list({ unreadOnly, limit: 50 }),
    enabled,
    retry: false,
  })
}

export function useMarkNotificationRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.notificationsAll })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.notificationsAll })
    },
  })
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: keys.notificationSettings,
    queryFn: () => notificationsApi.settings(),
    retry: false,
  })
}

export function useSaveNotificationSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<NotificationSettingsDto>) =>
      notificationsApi.saveSettings(patch),
    onSuccess: (settings) => {
      client.setQueryData(keys.notificationSettings, settings)
    },
  })
}

/* --------------------------------------------------------------- account -- */

export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: () => accountApi.profile(),
    retry: false,
  })
}

export function useUpdateProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: ProfileUpdateInput) => accountApi.updateProfile(patch),
    onSuccess: (profile) => {
      client.setQueryData(keys.profile, profile)
      // The header greets by name, and it reads the session, not the profile.
      void client.invalidateQueries({ queryKey: keys.me })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      accountApi.changePassword(body),
  })
}

export function useSessions() {
  return useQuery({
    queryKey: keys.sessions,
    queryFn: () => accountApi.sessions(),
    retry: false,
  })
}

export function useRevokeSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => accountApi.revokeSession(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.sessions })
    },
  })
}

export function useRevokeOtherSessions() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => accountApi.revokeOthers(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.sessions })
    },
  })
}

/* --------------------------------------------------------------- reviews -- */

export function useMyReviews() {
  return useQuery({
    queryKey: keys.reviews,
    queryFn: () => reviewsApi.mine(),
    retry: false,
  })
}

/** Stays that finished and have no review yet. The server decides, not us. */
export function useReviewableBookings() {
  return useQuery({
    queryKey: keys.reviewable,
    queryFn: () => reviewsApi.reviewable(),
    retry: false,
  })
}

export function useCreateReview() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof reviewsApi.create>[0]) => reviewsApi.create(body),
    onSuccess: () => {
      // Writing one moves it OFF the reviewable list, so both must refresh.
      void client.invalidateQueries({ queryKey: keys.reviews })
      void client.invalidateQueries({ queryKey: keys.reviewable })
    },
  })
}

export function useDeleteReview() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reviewsApi.remove(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.reviews })
      void client.invalidateQueries({ queryKey: keys.reviewable })
    },
  })
}

/* --------------------------------------------------------------- support -- */

/** `enabled`, because the ticket list is on the public support page. */
export function useMyTickets(enabled = true) {
  return useQuery({
    queryKey: keys.tickets,
    queryFn: () => supportApi.mine(),
    enabled,
    retry: false,
  })
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: keys.ticket(id),
    queryFn: () => supportApi.get(id),
    enabled: Boolean(id),
  })
}

export function useOpenTicket() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof supportApi.open>[0]) => supportApi.open(body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.tickets })
    },
  })
}

export function useReplyToTicket(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => supportApi.reply(id, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.ticket(id) })
      void client.invalidateQueries({ queryKey: keys.tickets })
    },
  })
}

/* ---------------------------------------------------------------- partner -- */

/**
 * The properties this member may act on.
 *
 * Scoped by the SESSION — the org and the member's own property list come off
 * the session, never from a parameter. The extranet used to read a hardcoded
 * `PARTNER_ORG` with five slugs baked into it.
 */
export function usePartnerProperties() {
  return useQuery<PartnerProperty[], ApiError>({
    queryKey: keys.partnerProperties,
    queryFn: partnerApi.properties,
    retry: false,
  })
}

/** Every reservation across the properties this member may see. */
export function usePartnerBookings() {
  return useQuery<BookingDto[], ApiError>({
    queryKey: keys.partnerBookings,
    queryFn: partnerApi.bookings,
    retry: false,
  })
}

/**
 * A property moving one of its own bookings.
 *
 * Both mutations invalidate the PARTNER list and the guest's — a cancellation
 * taken at the desk has to reach the guest's dashboard, which is the whole
 * point of there being one booking rather than two datasets.
 */
export function usePartnerBookingActions() {
  const client = useQueryClient()
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: keys.partnerBookings })
    void client.invalidateQueries({ queryKey: keys.bookings })
  }

  const setStatus = useMutation<
    BookingDto,
    ApiError,
    { id: string; status: string; roomNo?: string; reason?: string }
  >({
    mutationFn: ({ id, ...body }) => partnerBookingsApi.setStatus(id, body),
    onSuccess: invalidate,
  })

  const cancel = useMutation<
    Awaited<ReturnType<typeof partnerBookingsApi.cancel>>,
    ApiError,
    { id: string; reason: string }
  >({
    mutationFn: ({ id, reason }) => partnerBookingsApi.cancel(id, reason),
    onSuccess: invalidate,
  })

  return { setStatus, cancel }
}

export function usePartnerReviews(status?: string) {
  return useQuery({
    queryKey: keys.partnerReviews(status),
    queryFn: () => partnerReviewsApi.list(status && status !== "all" ? { status } : {}),
    retry: false,
  })
}

export function useRespondToReview() {
  const client = useQueryClient()
  return useMutation<ReviewDto, ApiError, { id: string; text: string }>({
    mutationFn: ({ id, text }) => partnerReviewsApi.respond(id, text),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.partnerReviewsAll })
    },
  })
}

export function useFlagReview() {
  const client = useQueryClient()
  return useMutation<ReviewDto, ApiError, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => partnerReviewsApi.flag(id, reason),
    onSuccess: () => {
      // Flagging moves it between tabs, so the counts move too.
      void client.invalidateQueries({ queryKey: keys.partnerReviewsAll })
    },
  })
}

export function usePerformance(range: AnalyticsRange) {
  return useQuery<PerformanceRowView[], ApiError>({
    queryKey: keys.performance(range),
    queryFn: () => analyticsApi.performance(range),
    retry: false,
  })
}

export function useListing(propertyId: string) {
  return useQuery<ListingDetail, ApiError>({
    queryKey: keys.listing(propertyId),
    queryFn: () => listingApi.get(propertyId),
    enabled: Boolean(propertyId),
    retry: false,
  })
}

export function useUpdateListing(propertyId: string) {
  const client = useQueryClient()
  return useMutation<ListingDetail, ApiError, Record<string, unknown>>({
    mutationFn: (patch) => listingApi.update(propertyId, patch),
    onSuccess: (listing) => {
      client.setQueryData(keys.listing(propertyId), listing)
      // A rename shows in the switcher, and a material edit changes the score.
      void client.invalidateQueries({ queryKey: keys.partnerProperties })
      void client.invalidateQueries({ queryKey: keys.listingScore(propertyId) })
    },
  })
}

export function useListingScore(propertyId: string) {
  return useQuery({
    queryKey: keys.listingScore(propertyId),
    queryFn: () => listingApi.score(propertyId),
    enabled: Boolean(propertyId),
    retry: false,
  })
}

/**
 * Reordering, captioning and removing a listing's photos.
 *
 * Every mutation refreshes the LISTING rather than patching a local array: the
 * server decides a photo's `status`, and a reorder can move more than the one
 * row that was dragged.
 */
export function usePhotoActions(propertyId: string) {
  const client = useQueryClient()
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: keys.listing(propertyId) })
    void client.invalidateQueries({ queryKey: keys.listingScore(propertyId) })
  }

  const update = useMutation<
    PhotoView,
    ApiError,
    { photoId: string; category?: string; caption?: string; position?: number }
  >({
    mutationFn: ({ photoId, ...patch }) => photosApi.update(propertyId, photoId, patch),
    onSuccess: invalidate,
  })

  const remove = useMutation<{ removed: true }, ApiError, string>({
    mutationFn: (photoId) => photosApi.remove(propertyId, photoId),
    onSuccess: invalidate,
  })

  return { update, remove }
}

export function useRooms(propertyId: string) {
  return useQuery<RoomDto[], ApiError>({
    queryKey: keys.rooms(propertyId),
    queryFn: () => roomsApi.list(propertyId),
    enabled: Boolean(propertyId),
    retry: false,
  })
}

export function useUpdateRoom(propertyId: string) {
  const client = useQueryClient()
  return useMutation<
    { room: RoomDto; units: RoomUnitsResult | null },
    ApiError,
    { roomId: string; patch: Record<string, unknown> }
  >({
    mutationFn: ({ roomId, patch }) => roomsApi.update(roomId, patch),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.rooms(propertyId) })
      // Room count feeds the switcher, the score and the calendar.
      void client.invalidateQueries({ queryKey: keys.partnerProperties })
      void client.invalidateQueries({ queryKey: keys.listingScore(propertyId) })
      void client.invalidateQueries({ queryKey: ["stayora", "partner", "calendar", propertyId] })
    },
  })
}

/**
 * The partner's calendar.
 *
 * `roomId` narrows it; leaving it out returns every room, which is what the
 * grid screens want and what a single-room screen does not.
 */
export function useCalendar(
  propertyId: string,
  range: { from: string; to: string; roomId?: string }
) {
  return useQuery<CalendarView, ApiError>({
    queryKey: keys.calendar(propertyId, range),
    queryFn: () => inventoryApi.calendar(propertyId, range),
    enabled: Boolean(propertyId && range.from && range.to),
    retry: false,
  })
}

export function usePropertyRatePlans(propertyId: string) {
  return useQuery<PropertyRatePlan[], ApiError>({
    queryKey: keys.ratePlans(propertyId),
    queryFn: () => ratePlansApi.forProperty(propertyId),
    enabled: Boolean(propertyId),
    retry: false,
  })
}

/* -------------------------------------------------- notification switches -- */

export function useNotificationPreferences() {
  return useQuery<NotificationPreferencesDto, ApiError>({
    queryKey: keys.notificationPreferences,
    queryFn: () => notificationsApi.preferences(),
    retry: false,
  })
}

/**
 * Flipping switches.
 *
 * Several at once, because "all email off" is one intent, not eight — and
 * because eight PATCHes racing each other is eight chances for the last write
 * to win with a stale view of the other seven.
 */
export function useSaveNotificationPreferences() {
  const client = useQueryClient()
  return useMutation<NotificationPreferencesDto, ApiError, NotificationPreferenceRow[]>({
    mutationFn: (rows) => notificationsApi.savePreferences(rows),
    onSuccess: (data) => {
      // The response IS the new state, so there is nothing to re-fetch.
      client.setQueryData(keys.notificationPreferences, data)
    },
  })
}

/* ------------------------------------------------------- writing a calendar -- */

/**
 * Every calendar write invalidates every calendar range of that property.
 *
 * A partner edits one night in a month view and then pages to the next month;
 * that is a different query key holding the same underlying rows. Keying the
 * invalidation on the property rather than the range is what stops the second
 * view showing what the first one already changed.
 */
function invalidateCalendar(client: ReturnType<typeof useQueryClient>, propertyId: string) {
  void client.invalidateQueries({ queryKey: ["stayora", "partner", "calendar", propertyId] })
}

export function useSetRates(propertyId: string) {
  const client = useQueryClient()
  return useMutation<{ datesAffected: number }, ApiError, Record<string, unknown>>({
    mutationFn: (body) => inventoryApi.setRates(body),
    onSuccess: () => {
      invalidateCalendar(client, propertyId)
      // The headline "from" price is recomputed server-side; re-read it.
      void client.invalidateQueries({ queryKey: keys.rooms(propertyId) })
      void client.invalidateQueries({ queryKey: keys.ratePlans(propertyId) })
    },
  })
}

export function useSetClosed(propertyId: string) {
  const client = useQueryClient()
  return useMutation<
    { rooms: number; datesAffected: number },
    ApiError,
    Record<string, unknown>
  >({
    mutationFn: (body) => inventoryApi.close(body),
    onSuccess: () => invalidateCalendar(client, propertyId),
  })
}

export function useCopyRates(propertyId: string) {
  const client = useQueryClient()
  return useMutation<CopyRatesResult, ApiError, Record<string, unknown>>({
    mutationFn: (body) => inventoryApi.copyRates(body) as Promise<CopyRatesResult>,
    onSuccess: () => invalidateCalendar(client, propertyId),
  })
}

export function useOccupancyPrices(ratePlanId: string) {
  return useQuery<OccupancyGridView, ApiError>({
    queryKey: keys.occupancyPrices(ratePlanId),
    queryFn: () => occupancyApi.get(ratePlanId),
    enabled: Boolean(ratePlanId),
    retry: false,
  })
}

export function useSetOccupancyPrices(ratePlanId: string, propertyId: string) {
  const client = useQueryClient()
  return useMutation<OccupancyGridView, ApiError, OccupancyPricesInput>({
    mutationFn: (body) => occupancyApi.set(ratePlanId, body),
    onSuccess: (data) => {
      // The response IS the new grid; nothing to re-fetch for this plan.
      client.setQueryData(keys.occupancyPrices(ratePlanId), data)
      // A quote reads these, so anything quoting a price is now stale.
      void client.invalidateQueries({ queryKey: ["stayora", "partner", "calendar", propertyId] })
    },
  })
}

export function useValueAdds(propertyId: string) {
  return useQuery<ValueAddDto[], ApiError>({
    queryKey: keys.valueAdds(propertyId),
    queryFn: () => valueAddsApi.list(propertyId),
    enabled: Boolean(propertyId),
    retry: false,
  })
}

export function useValueAddActions(propertyId: string) {
  const client = useQueryClient()
  const refresh = () =>
    void client.invalidateQueries({ queryKey: keys.valueAdds(propertyId) })

  const create = useMutation<ValueAddDto, ApiError, ValueAddCreateInput>({
    mutationFn: (body) => valueAddsApi.create(propertyId, body),
    onSuccess: refresh,
  })

  const update = useMutation<
    ValueAddDto,
    ApiError,
    { valueAddId: string; patch: ValueAddUpdateInput }
  >({
    mutationFn: ({ valueAddId, patch }) => valueAddsApi.update(valueAddId, patch),
    onSuccess: refresh,
  })

  return { create, update }
}

/* ------------------------------------------------------------ promotions -- */

export function usePromotions() {
  return useQuery<PromotionDto[], ApiError>({
    queryKey: keys.promotions,
    queryFn: () => promotionsApi.list({ limit: 100 }),
    retry: false,
  })
}

export function usePromotionActions() {
  const client = useQueryClient()
  const refresh = () => void client.invalidateQueries({ queryKey: keys.promotions })

  const create = useMutation<PromotionDto, ApiError, PromotionCreateInput>({
    mutationFn: (body) => promotionsApi.create(body),
    onSuccess: refresh,
  })

  const update = useMutation<
    PromotionDto,
    ApiError,
    { id: string; patch: PromotionUpdateInput }
  >({
    mutationFn: ({ id, patch }) => promotionsApi.update(id, patch),
    onSuccess: refresh,
  })

  return { create, update }
}

export function usePropertyRanking(propertyId: string) {
  return useQuery<PropertyRanking, ApiError>({
    queryKey: keys.ranking(propertyId),
    queryFn: () => rankingApi.get(propertyId),
    enabled: Boolean(propertyId),
    retry: false,
  })
}

/* -------------------------------------------------------------- analytics -- */

/**
 * One hook shape for every analytics screen.
 *
 * They all take the same range and all answer for the same portfolio, so a
 * per-screen hook would be nine copies of the same four lines. `retry: false`
 * throughout: a 400 on a bad range is an answer, not a blip worth retrying.
 */
function analyticsQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<T>,
  enabled = true
) {
  return { queryKey: key, queryFn: fetcher, enabled, retry: false as const }
}

export function useSales(
  range: AnalyticsRange & { granularity?: "day" | "week" | "month" }
) {
  return useQuery<SalesView, ApiError>(
    analyticsQuery(keys.analytics("sales", range), () => analyticsApi.sales(range))
  )
}

export function usePace(
  range: AnalyticsRange & { granularity?: "day" | "week" | "month" }
) {
  return useQuery<PaceView, ApiError>(
    analyticsQuery(keys.analytics("pace", range), () => analyticsApi.pace(range))
  )
}

export function useCancellations(range: AnalyticsRange) {
  return useQuery<CancellationsView, ApiError>(
    analyticsQuery(keys.analytics("cancellations", range), () =>
      analyticsApi.cancellations(range)
    )
  )
}

export function useBookWindow(range: AnalyticsRange) {
  return useQuery<BookWindowView, ApiError>(
    analyticsQuery(keys.analytics("book-window", range), () =>
      analyticsApi.bookWindow(range)
    )
  )
}

export function useBookers(range: AnalyticsRange) {
  return useQuery<BookersView, ApiError>(
    analyticsQuery(keys.analytics("bookers", range), () => analyticsApi.bookers(range))
  )
}

export function useGeniusAnalytics(range: AnalyticsRange) {
  return useQuery<GeniusView, ApiError>(
    analyticsQuery(keys.analytics("genius", range), () => analyticsApi.genius(range))
  )
}

export function useDemand(range: AnalyticsRange) {
  return useQuery<DemandView, ApiError>(
    analyticsQuery(keys.analytics("demand", range), () => analyticsApi.demand(range))
  )
}

/** Needs one property — "how do I compare" has no answer for a portfolio. */
export function useComparables(range: AnalyticsRange & { propertyId: string }) {
  return useQuery<ComparablesView, ApiError>(
    analyticsQuery(
      keys.analytics("comparables", range),
      () => analyticsApi.comparables(range),
      Boolean(range.propertyId)
    )
  )
}

/* ---------------------------------------------------------------- finance -- */

export function useFinanceOverview(range: FinanceRange) {
  return useQuery<FinanceOverview, ApiError>({
    queryKey: keys.finance("overview", range),
    queryFn: () => financeApi.overview(range),
    retry: false,
  })
}

export function useFinanceRevenue(
  range: FinanceRange & { granularity?: "day" | "week" | "month" }
) {
  return useQuery<FinanceRevenueView, ApiError>({
    queryKey: keys.finance("revenue", range),
    queryFn: () => financeApi.revenue(range),
    retry: false,
  })
}

export function useCommissionReport(range: FinanceRange) {
  return useQuery<CommissionReportRow[], ApiError>({
    queryKey: keys.finance("commissions", range),
    queryFn: () => financeApi.commissions(range),
    retry: false,
  })
}

export function useFinanceTransactions(range: FinanceRange & { limit?: number }) {
  return useQuery<{ items: FinanceTransaction[]; nextCursor: string | null }, ApiError>({
    queryKey: keys.finance("transactions", range),
    queryFn: () => financeApi.transactions(range),
    retry: false,
  })
}

export function usePayouts() {
  return useQuery<PayoutDto[], ApiError>({
    queryKey: keys.payouts,
    queryFn: () => financeApi.payouts(),
    retry: false,
  })
}

export function usePayoutAccount() {
  return useQuery<PayoutAccountDto, ApiError>({
    queryKey: keys.payoutAccount,
    queryFn: () => financeApi.payoutAccount(),
    retry: false,
  })
}

export function useInvoices() {
  return useQuery<InvoiceDto[], ApiError>({
    queryKey: keys.invoices,
    queryFn: () => financeApi.invoices(),
    retry: false,
  })
}

/* ------------------------------------------------------------ partner inbox */

export function usePartnerConversations() {
  return useQuery<{ items: BookingConversation[]; nextCursor: string | null }, ApiError>({
    queryKey: keys.partnerConversations,
    queryFn: () => partnerInboxApi.conversations({ limit: 50 }),
    retry: false,
  })
}

export function usePartnerTickets() {
  return useQuery<SupportThreadView[], ApiError>({
    queryKey: keys.partnerTickets,
    queryFn: () => partnerInboxApi.tickets(),
    retry: false,
  })
}

export function usePartnerTicket(threadId: string) {
  return useQuery<
    { thread: SupportThreadView; messages: SupportMessageView[] },
    ApiError
  >({
    queryKey: keys.partnerTicket(threadId),
    queryFn: () => partnerInboxApi.ticket(threadId),
    enabled: Boolean(threadId),
    retry: false,
  })
}

export function usePartnerTicketActions() {
  const client = useQueryClient()

  const open = useMutation<SupportThreadView, ApiError, PartnerTicketInput>({
    mutationFn: (body) => partnerInboxApi.openTicket(body),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.partnerTickets }),
  })

  const reply = useMutation<
    SupportMessageView,
    ApiError,
    { threadId: string; body: string }
  >({
    mutationFn: ({ threadId, body }) => partnerInboxApi.replyToTicket(threadId, body),
    onSuccess: (_data, { threadId }) => {
      void client.invalidateQueries({ queryKey: keys.partnerTicket(threadId) })
      // A reply reopens a resolved thread, so the list's status is stale too.
      void client.invalidateQueries({ queryKey: keys.partnerTickets })
    },
  })

  return { open, reply }
}

/* --------------------------------------------------------- team & contracts */

export function useTeam() {
  return useQuery<{ members: TeamMember[]; invites: TeamInvite[] }, ApiError>({
    queryKey: keys.team,
    queryFn: () => teamApi.list(),
    retry: false,
  })
}

export function useTeamActions() {
  const client = useQueryClient()
  const refresh = () => void client.invalidateQueries({ queryKey: keys.team })

  const invite = useMutation<TeamInvite, ApiError, InviteCreateInput>({
    mutationFn: (body) => teamApi.invite(body),
    onSuccess: refresh,
  })

  const revokeInvite = useMutation<{ ok: true }, ApiError, string>({
    mutationFn: (id) => teamApi.revokeInvite(id),
    onSuccess: refresh,
  })

  const update = useMutation<
    TeamMember,
    ApiError,
    { memberId: string; patch: MemberUpdateInput }
  >({
    mutationFn: ({ memberId, patch }) => teamApi.update(memberId, patch),
    onSuccess: refresh,
  })

  const remove = useMutation<{ ok: true }, ApiError, string>({
    mutationFn: (memberId) => teamApi.remove(memberId),
    onSuccess: refresh,
  })

  return { invite, revokeInvite, update, remove }
}

export function usePartnerOrg() {
  return useQuery<PartnerOrgView, ApiError>({
    queryKey: keys.partnerOrg,
    queryFn: () => orgApi.get(),
    retry: false,
  })
}

export function useUpdateOrg() {
  const client = useQueryClient()
  return useMutation<PartnerOrgView, ApiError, OrgUpdateInput>({
    mutationFn: (patch) => orgApi.update(patch),
    // The response IS the new org, so there is nothing to re-fetch.
    onSuccess: (data) => client.setQueryData(keys.partnerOrg, data),
  })
}

export function useContracts() {
  return useQuery<
    { signed: PartnerContractView[]; outstanding: ContractTemplateView[] },
    ApiError
  >({
    queryKey: keys.contracts,
    queryFn: () => contractsApi.list(),
    retry: false,
  })
}

export function useAcceptContract() {
  const client = useQueryClient()
  return useMutation<PartnerContractView, ApiError, string>({
    mutationFn: (templateId) => contractsApi.accept(templateId),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.contracts }),
  })
}

/**
 * A property's public reviews, with its rating.
 *
 * The rating comes from the SERVER rather than being averaged from the page:
 * a property with sixty reviews returns twenty, and averaging those twenty
 * would print a headline score that disagrees with the count beside it.
 */
export function usePropertyReviews(slug: string) {
  return useQuery<
    { items: ReviewDto[]; nextCursor: string | null; rating: PropertyRating },
    ApiError
  >({
    queryKey: keys.propertyReviews(slug),
    queryFn: () => reviewsApi.forProperty(slug, { limit: 20 }),
    enabled: Boolean(slug),
    retry: false,
  })
}

/**
 * The cities the marketplace actually sells in.
 *
 * Public, cached for a while: supply does not change minute to minute, and
 * this renders on the busiest page in the product.
 */
export function useDestinations(limit = 8) {
  return useQuery<Destination[], ApiError>({
    queryKey: keys.destinations(limit),
    queryFn: () => destinationsApi.list(limit),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

/**
 * The platform's own figures (rule #113).
 *
 * Long-lived: a property count changes when a partner is approved, which is
 * rare enough that an hour-old number is still true.
 */
export function usePlatformStats() {
  return useQuery<PlatformStats, ApiError>({
    queryKey: ["stayora", "platform", "stats"],
    queryFn: () => platformApi.stats(),
    staleTime: 60 * 60_000,
    retry: false,
  })
}

/**
 * The applicant's registration draft.
 *
 * `retry: false`: a 401 here means "not signed in yet", which the wizard's
 * account steps exist to fix — retrying it four times only delays the redirect.
 *
 * `enabled` is passed rather than assumed, because the first four screens run
 * BEFORE there is an account. Firing this there would 401 on every one of them
 * and put an error in the console for the normal path through the flow.
 */
export function useRegistration(enabled = true) {
  return useQuery<RegistrationView, ApiError>({
    queryKey: keys.registration,
    queryFn: () => registrationApi.mine(),
    enabled,
    retry: false,
  })
}

/**
 * One screen's answers, saved.
 *
 * The response IS the whole draft, so it is seeded into the cache instead of
 * invalidating: an invalidate would refetch what the server just handed back,
 * and the next screen would render its defaults for a frame while it did.
 *
 * `gaps` comes back with every save, which is what lets the final screens list
 * what is still missing without a second request — and without the frontend
 * re-implementing `submissionGaps` and drifting from it.
 */
export function useSaveRegistration() {
  const client = useQueryClient()
  return useMutation<RegistrationView, ApiError, RegistrationPatchInput>({
    mutationFn: (body) => registrationApi.save(body),
    onSuccess: (view) => client.setQueryData(keys.registration, view),
  })
}

/**
 * Hand the application to the platform for review.
 *
 * Refused while any gap remains — the server checks, not the button — so a
 * rejection here is a list of what to go back and finish, not a failure.
 */
/**
 * One file, uploaded and confirmed.
 *
 * The bytes go straight to storage and never through the API. On success the
 * whole draft is refetched rather than patched locally, because `gaps` moves
 * when a photo lands — "Add at least one photo" is a gap the server owns.
 */
export function useUploadRegistrationFile() {
  const client = useQueryClient()
  return useMutation<
    RegistrationDocumentView,
    ApiError,
    { file: File; kind: RegistrationDocumentView["kind"] }
  >({
    mutationFn: async ({ file, kind }) => {
      const signed = await registrationApi.uploadUrl({
        kind,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      })

      const response = await fetch(signed.url, {
        method: signed.method,
        headers: signed.headers,
        body: file,
      })
      if (!response.ok) throw new Error(`Upload failed for ${file.name}`)

      return registrationApi.confirmDocument({
        kind,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        key: signed.key,
      })
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.registration })
    },
  })
}

export function useRemoveRegistrationFile() {
  const client = useQueryClient()
  return useMutation<{ removed: true }, ApiError, string>({
    mutationFn: (documentId) => registrationApi.removeDocument(documentId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.registration })
    },
  })
}

export function useSubmitRegistration() {
  const client = useQueryClient()
  return useMutation<RegistrationView, ApiError, void>({
    mutationFn: () => registrationApi.submit(),
    onSuccess: (view) => client.setQueryData(keys.registration, view),
  })
}
