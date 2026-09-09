"use client"

/**
 * react-query bindings for the admin API.
 *
 * Screens consume these, never `endpoints.ts` directly, so caching,
 * invalidation and the loading/error contract live in one place.
 *
 * Two things changed when the mock went away, and both reach every list screen:
 *
 *   - **paging is keyset.** There is no page number and no total. A screen
 *     shows what it has and asks for more; `nextCursor` is the server's own
 *     bookmark. "Page 7" was never a question this API could answer.
 *   - **filtering happens on the SERVER.** The mock held every row and sliced
 *     it in the browser, which is why it could offer a total. A real list
 *     endpoint sees one page, so a filter is a query parameter — and a filter
 *     the API does not support is one the screen must not offer.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query"
import { toast } from "sonner"

import type {
  AdminRefundRequest,
  AdminTransitionInput,
  AdminUserUpdateInput,
  ListingDecisionInput,
  PropertySuspensionInput,
} from "@stayora/shared"

import { ApiError } from "@/lib/api/errors"
import {
  analyticsApi,
  auditApi,
  clientsApi,
  contentApi,
  financeApi,
  inboxApi,
  mailApi,
  invoicesApi,
  payoutsApi,
  promotionsApi,
  propertiesApi,
  registrationsApi,
  reservationsApi,
  reviewsApi,
  settingsApi,
  usersApi,
  type FinanceRange,
  type ListQuery,
  type PlatformRange,
} from "./endpoints"

/** Stable, hierarchical cache keys — `["admin"]` invalidates everything. */
export const adminKeys = {
  all: ["admin"] as const,
  list: (resource: string, params?: unknown) =>
    ["admin", resource, "list", params ?? {}] as const,
  detail: (resource: string, id: string) =>
    ["admin", resource, "detail", id] as const,
}

function useAdminQuery<T>(
  resource: string,
  params: unknown,
  fetcher: () => Promise<T>,
  options?: Partial<UseQueryOptions<T, ApiError>>
) {
  return useQuery<T, ApiError>({
    queryKey: adminKeys.list(resource, params),
    queryFn: fetcher,
    // A stale-time keeps tab switches instant without hiding real mutations,
    // which explicitly invalidate.
    staleTime: 30_000,
    // A 403 or a 404 is an answer, not a blip. Retrying one only delays it.
    retry: false,
    ...options,
  })
}

/** Shared mutation plumbing: toast on both paths, invalidate on success. */
function useAdminMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  options: {
    success: string | ((result: TResult, args: TArgs) => string)
    invalidate?: readonly (readonly unknown[])[]
    onSuccess?: (result: TResult, args: TArgs) => void
  }
) {
  const queryClient = useQueryClient()
  return useMutation<TResult, ApiError, TArgs>({
    mutationFn,
    onSuccess: (result, args) => {
      const keys = options.invalidate ?? [adminKeys.all]
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
      const message =
        typeof options.success === "function"
          ? options.success(result, args)
          : options.success
      toast.success(message)
      options.onSuccess?.(result, args)
    },
    onError: (error) => {
      toast.error("Action failed", { description: error.message })
    },
  })
}

/* ------------------------------------------------------ platform analytics */

export function usePlatformOverview(range: PlatformRange) {
  return useAdminQuery("platform-overview", range, () =>
    analyticsApi.overview(range)
  )
}

export function usePlatformClients(range: PlatformRange) {
  return useAdminQuery("platform-clients", range, () =>
    analyticsApi.clients(range)
  )
}

export function usePlatformDemand(range: PlatformRange & { limit?: number }) {
  return useAdminQuery("platform-demand", range, () => analyticsApi.demand(range))
}

/* ------------------------------------------------------------------ money */

export function useFinanceOverview(range: FinanceRange) {
  return useAdminQuery("finance-overview", range, () => financeApi.overview(range))
}

export function useFinanceRevenue(
  range: FinanceRange & { granularity?: "day" | "week" | "month" }
) {
  return useAdminQuery("finance-revenue", range, () => financeApi.revenue(range))
}

export function useFinanceCommissions(range: FinanceRange) {
  return useAdminQuery("finance-commissions", range, () =>
    financeApi.commissions(range)
  )
}

export function useFinanceTransactions(range: FinanceRange & { limit?: number }) {
  return useAdminQuery("finance-transactions", range, () =>
    financeApi.transactions(range)
  )
}

/* ---------------------------------------------------------------- clients */

export function useClients() {
  return useAdminQuery("clients", {}, () => clientsApi.list())
}

export function useClient(id: string) {
  return useQuery({
    queryKey: adminKeys.detail("clients", id),
    queryFn: () => clientsApi.get(id),
    enabled: Boolean(id),
    retry: false,
  })
}

export function useUpdateClient() {
  return useAdminMutation(
    ({ orgId, patch }: { orgId: string; patch: Record<string, unknown> }) =>
      clientsApi.update(orgId, patch),
    {
      success: "Client updated",
      /*
       * The rate applies from now on.
       *
       * Nothing already invoiced moves, so the finance screens are not stale —
       * but the client list and the detail both carry the rate, and both are.
       */
      invalidate: [adminKeys.all],
    }
  )
}

/* --------------------------------------------------------------- settings */

/**
 * Whether mail is leaving the building.
 *
 * Polled rather than fetched once: an operator who leaves this screen open
 * during an incident should see it change. A minute is often enough — the
 * delivery job runs every minute, so nothing can move faster than that anyway.
 */
export function useMailHealth() {
  return useAdminQuery("mail-health", {}, () => mailApi.health(), {
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function usePlatformSettings() {
  return useAdminQuery("settings", {}, () => settingsApi.get())
}

export function useUpdateSettings() {
  return useAdminMutation(
    (patch: { supportEmail?: string; defaultCommissionRateBps?: number }) =>
      settingsApi.update(patch),
    { success: "Settings saved", invalidate: [adminKeys.list("settings", {})] }
  )
}

/* ------------------------------------------------------------- properties */

/**
 * `enabled`, because the command palette asks for all three of these and only
 * wants the ones the role can open.
 *
 * It used to say "do not fetch" by passing `{ limit: 0 }` — a value the API's
 * schema rejects (`limit` is min 1), so every admin page fired three requests
 * that came back 400. Three failed calls per screen, on every screen, for a
 * palette nobody had opened.
 */
export function useProperties(query: ListQuery = {}, enabled = true) {
  return useAdminQuery("properties", query, () => propertiesApi.list(query), { enabled })
}

/** Only what is waiting on a decision — the queue, not the catalogue. */
export function useListingQueue(enabled = true) {
  return useAdminQuery("listing-queue", {}, () => propertiesApi.queue(), { enabled })
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: adminKeys.detail("properties", id),
    queryFn: () => propertiesApi.get(id),
    enabled: Boolean(id),
    retry: false,
  })
}

export function useDecideListing() {
  return useAdminMutation(
    ({ propertyId, body }: { propertyId: string; body: ListingDecisionInput }) =>
      propertiesApi.decide(propertyId, body),
    {
      success: (_result, { body }) =>
        body.decision === "approve"
          ? "Listing approved — it is live now"
          : "Sent back to the partner with your notes",
    }
  )
}

export function useSuspendListing() {
  return useAdminMutation(
    ({
      propertyId,
      body,
    }: {
      propertyId: string
      body: PropertySuspensionInput
    }) => propertiesApi.suspend(propertyId, body),
    {
      success: (_result, { body }) =>
        body.action === "suspend"
          ? "Listing suspended — existing bookings are untouched"
          : "Listing reinstated",
    }
  )
}

/* ---------------------------------------------------------------- content */

export function useContent(query: ListQuery = {}) {
  return useAdminQuery("content", query, () => contentApi.list(query))
}

/* ----------------------------------------------------------- reservations */

export function useReservations(query: ListQuery = {}, enabled = true) {
  return useAdminQuery("reservations", query, () => reservationsApi.list(query), { enabled })
}

export function useReservation(id: string | null) {
  return useQuery({
    queryKey: adminKeys.detail("reservations", id ?? ""),
    queryFn: () => reservationsApi.get(id!),
    enabled: Boolean(id),
    retry: false,
  })
}

export function useRefundReservation() {
  return useAdminMutation(
    ({ bookingId, body }: { bookingId: string; body: AdminRefundRequest }) =>
      reservationsApi.refund(bookingId, body),
    {
      success: (result) =>
        `Refunded — ${(result.refunded / 100).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        })} back to the guest`,
    }
  )
}

export function useTransitionReservation() {
  return useAdminMutation(
    ({ bookingId, body }: { bookingId: string; body: AdminTransitionInput }) =>
      reservationsApi.transition(bookingId, body),
    { success: (result) => `Booking is now ${result.status.replace("_", " ")}` }
  )
}

/* ----------------------------------------------------------------- people */

export function useUsers(query: ListQuery = {}, enabled = true) {
  return useAdminQuery("users", query, () => usersApi.list(query), { enabled })
}

export function useUser(id: string) {
  return useQuery({
    queryKey: adminKeys.detail("users", id),
    queryFn: () => usersApi.get(id),
    enabled: Boolean(id),
    retry: false,
  })
}

export function useUpdateUser() {
  return useAdminMutation(
    ({ userId, body }: { userId: string; body: AdminUserUpdateInput }) =>
      usersApi.update(userId, body),
    {
      success: (result) =>
        result.status === "suspended"
          ? "Account suspended"
          : "Account updated",
    }
  )
}

/* ---------------------------------------------------------------- reviews */

export function useReviews(query: ListQuery = {}, enabled = true) {
  return useAdminQuery("reviews", query, () => reviewsApi.list(query), { enabled })
}

export function useModerateReview() {
  return useAdminMutation(
    ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      reviewsApi.moderate(id, { status, ...(reason ? { reason } : {}) }),
    {
      success: (_result, { status }) =>
        status === "published" ? "Review published" : `Review ${status}`,
    }
  )
}

/* ------------------------------------------------------------------ inbox */

export function useThreads(query: ListQuery = {}, enabled = true) {
  return useAdminQuery("threads", query, () => inboxApi.list(query), { enabled })
}

export function useThread(id: string | null) {
  return useQuery({
    queryKey: adminKeys.detail("threads", id ?? ""),
    queryFn: () => inboxApi.get(id!),
    enabled: Boolean(id),
    retry: false,
  })
}

export function useReplyToThread() {
  return useAdminMutation(
    ({
      threadId,
      body,
      internal,
    }: {
      threadId: string
      body: string
      internal?: boolean
    }) => inboxApi.reply(threadId, { body, ...(internal ? { internal } : {}) }),
    {
      success: (_result, { internal }) =>
        internal ? "Internal note added" : "Reply sent",
    }
  )
}

export function useUpdateThread() {
  return useAdminMutation(
    ({ threadId, patch }: { threadId: string; patch: Record<string, unknown> }) =>
      inboxApi.update(threadId, patch),
    { success: "Ticket updated" }
  )
}

/* ---------------------------------------------------------------- payouts */

export function usePayouts(query: ListQuery = {}) {
  return useAdminQuery("payouts", query, () => payoutsApi.list(query))
}

export function useRetryPayout() {
  return useAdminMutation((id: string) => payoutsApi.retry(id), {
    success: "Payout queued again",
  })
}

export function useVerifyPayoutAccount() {
  return useAdminMutation((orgId: string) => payoutsApi.verifyAccount(orgId), {
    success: "Payout account verified",
  })
}

export function useRunPayouts() {
  return useAdminMutation(
    (body: { periodStart: string; periodEnd: string }) => payoutsApi.run(body),
    {
      success: (result) =>
        `${result.created} settlements cut, ${result.skipped} already existed`,
    }
  )
}

/* --------------------------------------------------------------- invoices */

export function useInvoices(query: ListQuery = {}) {
  return useAdminQuery("invoices", query, () => invoicesApi.list(query))
}

export function useInvoice(invoiceId: string | null) {
  return useQuery({
    queryKey: adminKeys.detail("invoices", invoiceId ?? ""),
    queryFn: () => invoicesApi.get(invoiceId!),
    enabled: Boolean(invoiceId),
    retry: false,
  })
}

export function useRunInvoices() {
  return useAdminMutation(
    (body: { periodStart: string; periodEnd: string }) => invoicesApi.run(body),
    {
      success: (result) =>
        `${result.created} invoices issued, ${result.skipped} already existed`,
    }
  )
}

export function useMarkInvoicePaid() {
  return useAdminMutation(
    ({ invoiceId, note }: { invoiceId: string; note: string }) =>
      invoicesApi.markPaid(invoiceId, note),
    {
      success: "Invoice marked paid",
    }
  )
}

export function useSetSettlementMode() {
  return useAdminMutation(
    ({
      orgId,
      mode,
      reason,
    }: {
      orgId: string
      mode: "deduct" | "invoice"
      reason: string
    }) => invoicesApi.setMode(orgId, mode, reason),
    {
      success: (_result, { mode }) =>
        mode === "deduct"
          ? "Commission now comes off each payout"
          : "Commission will be invoiced monthly",
    }
  )
}

/* ------------------------------------------------------------- promotions */

export function usePromotions(query: ListQuery = {}) {
  return useAdminQuery("promotions", query, () => promotionsApi.list(query))
}

export function useSweepPromotions() {
  return useAdminMutation(() => promotionsApi.sweep(), {
    success: (result) =>
      `${result.activated} started, ${result.ended} ended`,
  })
}

/* ------------------------------------------------------------------ audit */

export function useAuditEvents(query: ListQuery = {}) {
  return useAdminQuery("audit", query, () => auditApi.list(query))
}

/* ---------------------------------------------------------- registrations */

export function useRegistrations(query: ListQuery = {}) {
  return useAdminQuery("registrations", query, () => registrationsApi.list(query))
}

export function useDecideRegistration() {
  return useAdminMutation(
    ({
      registrationId,
      body,
    }: {
      registrationId: string
      body: { decision: string; reason?: string }
    }) => registrationsApi.decide(registrationId, body),
    {
      success: (_result, { body }) =>
        body.decision === "approve"
          ? "Approved — the organisation, property and rooms exist now"
          : "Application declined",
    }
  )
}

/* --------------------------------------------------------- sidebar badges -- */

/**
 * The three numbers the sidebar is allowed to claim.
 *
 * Each is a real count from a real endpoint, not a length of whatever page
 * happened to load. Three queries rather than one aggregate: there is no
 * counts endpoint, and inventing one to save two cached round trips would be
 * a second source for numbers these screens already read.
 *
 * A badge whose query has not resolved is `0`, which renders as no badge —
 * better than a number that turns out to be wrong a moment later.
 */
/**
 * `enabled`, because the sidebar renders before the route guard refuses.
 *
 * The admin shell — topbar, sidebar, badges — mounts around the guard rather
 * than inside it, so a guest or a partner who opens `/admin` painted the
 * navigation for a moment and fired these three queries at the API, which
 * answered 403 three times. The guard was right; the chrome asked anyway.
 */
export function useAdminCounts(enabled = true) {
  const queue = useListingQueue(enabled)
  const reviews = useReviews({ status: "pending", limit: 1 }, enabled)
  const threads = useThreads({ status: "open", limit: 1 }, enabled)

  return {
    isPending: queue.isPending || reviews.isPending || threads.isPending,
    badges: {
      propertiesPending: queue.data?.length ?? 0,
      reviewsToModerate: reviews.data?.counts.pending ?? 0,
      inboxUnread: threads.data?.counts.open ?? 0,
    },
  }
}
