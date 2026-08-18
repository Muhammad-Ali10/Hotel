"use client"

/**
 * react-query bindings for the admin API.
 *
 * Screens consume these, never `endpoints.ts` directly, so caching,
 * invalidation and the loading/error contract live in one place. The
 * `QueryClientProvider` already exists app-wide in
 * `components/providers/query-provider`.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query"
import { toast } from "sonner"

import type {
  Cancellation,
  ContentItem,
  GuestStatus,
  InboxThread,
  InvoicePreview,
  Manager,
  ManagerRole,
  PlatformSettings,
  Promotion,
  PropertyStatus,
  ReviewStatus,
} from "@/lib/admin/types"

import { adminApi, ApiError, type ListParams } from "./endpoints"

/** Stable, hierarchical cache keys — `["admin"]` invalidates everything. */
export const adminKeys = {
  all: ["admin"] as const,
  list: (resource: string, params?: unknown) =>
    ["admin", resource, "list", params ?? {}] as const,
  detail: (resource: string, id: string) =>
    ["admin", resource, "detail", id] as const,
}

function useListQuery<T>(
  resource: string,
  params: ListParams,
  fetcher: () => Promise<T>,
  options?: Partial<UseQueryOptions<T, ApiError>>
) {
  return useQuery<T, ApiError>({
    queryKey: adminKeys.list(resource, params),
    queryFn: fetcher,
    // A stale-time keeps tab switches instant without hiding real mutations,
    // which explicitly invalidate.
    staleTime: 30_000,
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

/* ------------------------------------------------------------ counts */

/**
 * Live derived counts for stat tiles, facet badges and the sidebar. Reads the
 * mutable store, so the numbers move when a mutation lands rather than staying
 * frozen at the seed values.
 */
export function useAdminCounts() {
  return useQuery({
    queryKey: adminKeys.list("counts"),
    queryFn: () => adminApi.counts.all(),
    staleTime: 0,
  })
}

/* ---------------------------------------------------------- overview */

export function useOverview(range: "6M" | "1Y" = "6M") {
  return useQuery({
    queryKey: adminKeys.list("overview", range),
    queryFn: () => adminApi.overview.summary(range),
  })
}

export function useFinanceSummary() {
  return useQuery({
    queryKey: adminKeys.list("finance-summary"),
    queryFn: () => adminApi.overview.financeSummary(),
  })
}

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: adminKeys.list("analytics-summary"),
    queryFn: () => adminApi.overview.analyticsSummary(),
  })
}

/* ----------------------------------------------------------- clients */

export function useClients(params: ListParams = {}) {
  return useListQuery("clients", params, () => adminApi.clients.list(params))
}

export function useClient(id: string) {
  return useQuery({
    queryKey: adminKeys.detail("clients", id),
    queryFn: () => adminApi.clients.get(id),
  })
}

/* ------------------------------------------------------------ guests */

export function useGuests(params: ListParams = {}) {
  return useListQuery("guests", params, () => adminApi.guests.list(params))
}

export function useGuest(id: string) {
  return useQuery({
    queryKey: adminKeys.detail("guests", id),
    queryFn: () => adminApi.guests.get(id),
  })
}

export function useSetGuestStatus() {
  return useAdminMutation(
    (args: { id: string; status: GuestStatus; reason: string }) =>
      adminApi.guests.setStatus(args.id, args.status, args.reason),
    { success: (guest) => `${guest.name} is now ${guest.status.toLowerCase()}.` }
  )
}

/* -------------------------------------------------------- properties */

export function useProperties(params: ListParams = {}) {
  return useListQuery("properties", params, () =>
    adminApi.properties.list(params)
  )
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: adminKeys.detail("properties", id),
    queryFn: () => adminApi.properties.get(id),
  })
}

export function useTransitionProperty() {
  return useAdminMutation(
    (args: { id: string; next: PropertyStatus; note?: string }) =>
      adminApi.properties.transition(args.id, args.next, args.note),
    {
      success: (property) =>
        `${property.name} is now ${property.status.toLowerCase()}.`,
    }
  )
}

/* ---------------------------------------------------------- managers */

export function useManagers(params: ListParams = {}) {
  return useListQuery("managers", params, () => adminApi.managers.list(params))
}

export function useInviteManager() {
  return useAdminMutation(
    (args: { email: string; role: ManagerRole; clientId: string }) =>
      adminApi.managers.invite(args),
    { success: (manager) => `Invitation sent to ${manager.email}.` }
  )
}

export function useSetManagerStatus() {
  return useAdminMutation(
    (args: { id: string; status: Manager["status"] }) =>
      adminApi.managers.setStatus(args.id, args.status),
    {
      success: (manager) =>
        `${manager.name} is now ${manager.status.toLowerCase()}.`,
    }
  )
}

/* ------------------------------------------------------ reservations */

export function useReservations(params: ListParams = {}) {
  return useListQuery("reservations", params, () =>
    adminApi.reservations.list(params)
  )
}

export function useReservation(id: string | null) {
  return useQuery({
    queryKey: adminKeys.detail("reservations", id ?? ""),
    queryFn: () => adminApi.reservations.get(id!),
    enabled: Boolean(id),
  })
}

export function useCancelReservation() {
  return useAdminMutation(
    (args: { id: string; reason: Cancellation["reason"]; note: string }) =>
      adminApi.reservations.cancel(args.id, args.reason, args.note),
    { success: (reservation) => `${reservation.id} cancelled.` }
  )
}

export function useCancellations(params: ListParams = {}) {
  return useListQuery("cancellations", params, () =>
    adminApi.cancellations.list(params)
  )
}

/* ------------------------------------------------------------- inbox */

export function useThreads(kind?: InboxThread["kind"]) {
  return useQuery({
    queryKey: adminKeys.list("inbox", kind ?? "all"),
    queryFn: () => adminApi.inbox.list(kind),
  })
}

export function useThread(id: string | null) {
  return useQuery({
    queryKey: adminKeys.detail("inbox", id ?? ""),
    queryFn: () => adminApi.inbox.get(id!),
    enabled: Boolean(id),
  })
}

/**
 * Marking read is a mutation, not a side effect of the read query, so the
 * sidebar's unread badge invalidates with it instead of going stale.
 */
export function useMarkThreadRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.inbox.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.list("counts") })
      void queryClient.invalidateQueries({ queryKey: adminKeys.list("inbox", "all") })
    },
  })
}

export function useReplyToThread() {
  return useAdminMutation(
    (args: { id: string; body: string }) =>
      adminApi.inbox.reply(args.id, args.body),
    { success: "Reply sent." }
  )
}

export function useSetThreadStatus() {
  return useAdminMutation(
    (args: { id: string; status: InboxThread["status"] }) =>
      adminApi.inbox.setStatus(args.id, args.status),
    { success: (thread) => `Conversation marked ${thread.status.toLowerCase()}.` }
  )
}

/* ----------------------------------------------------------- reviews */

export function useReviews(params: ListParams = {}) {
  return useListQuery("reviews", params, () => adminApi.reviews.list(params))
}

export function useSetReviewStatus() {
  return useAdminMutation(
    (args: { id: string; status: ReviewStatus; reason?: string }) =>
      adminApi.reviews.setStatus(args.id, args.status, args.reason),
    { success: (review) => `Review ${review.status.toLowerCase()}.` }
  )
}

/* ----------------------------------------------------------- finance */

export function usePayouts(params: ListParams = {}) {
  return useListQuery("payouts", params, () => adminApi.finance.payouts(params))
}

export function useRetryPayout() {
  return useAdminMutation(
    (args: { id: string }) => adminApi.finance.retryPayout(args.id),
    { success: (payout) => `${payout.id} re-queued for processing.` }
  )
}

export function useCommissionInvoices(params: ListParams = {}) {
  return useListQuery("commission-invoices", params, () =>
    adminApi.finance.invoices(params)
  )
}

export function usePreviewInvoice() {
  return useMutation<
    InvoicePreview,
    ApiError,
    Parameters<typeof adminApi.finance.previewInvoice>[0]
  >({
    mutationFn: (input) => adminApi.finance.previewInvoice(input),
    onError: (error) =>
      toast.error("Could not build preview", { description: error.message }),
  })
}

export function useIssueInvoice() {
  return useAdminMutation(
    (preview: InvoicePreview) => adminApi.finance.issueInvoice(preview),
    { success: (invoice) => `Invoice ${invoice.id} issued.` }
  )
}

/* ----------------------------------------------------------- content */

export function useContent(params: ListParams = {}) {
  return useListQuery("content", params, () => adminApi.content.list(params))
}

export function useSetContentStatus() {
  return useAdminMutation(
    (args: { id: string; status: ContentItem["status"]; reason?: string }) =>
      adminApi.content.setStatus(args.id, args.status, args.reason),
    { success: (item) => `Description ${item.status.toLowerCase()}.` }
  )
}

export function useUpdateContent() {
  return useAdminMutation(
    (args: { id: string; body: string }) =>
      adminApi.content.update(args.id, args.body),
    { success: "Description saved and queued for review." }
  )
}

/* -------------------------------------------------------- promotions */

export function usePromotions(city?: string) {
  return useQuery({
    queryKey: adminKeys.list("promotions", city ?? "All"),
    queryFn: () => adminApi.promotions.list(city),
  })
}

export function usePromotionRankings() {
  return useQuery({
    queryKey: adminKeys.list("promotion-rankings"),
    queryFn: () => adminApi.promotions.rankings(),
  })
}

export function useSetPromotionStatus() {
  return useAdminMutation(
    (args: { id: string; status: Promotion["status"] }) =>
      adminApi.promotions.setStatus(args.id, args.status),
    { success: (promotion) => `${promotion.name} is now ${promotion.status.toLowerCase()}.` }
  )
}

/* ----------------------------------------------------------- billing */

export function useBillingInvoices() {
  return useQuery({
    queryKey: adminKeys.list("billing"),
    queryFn: () => adminApi.billing.subscriptions(),
  })
}

export function useMarkInvoicePaid() {
  return useAdminMutation(
    (args: { id: string }) => adminApi.billing.markPaid(args.id),
    { success: (invoice) => `${invoice.id} marked paid.` }
  )
}

/* ------------------------------------------------------------- audit */

export function useAuditEvents(params: ListParams = {}) {
  return useListQuery("audit", params, () => adminApi.audit.list(params))
}

/* ---------------------------------------------------------- settings */

export function usePlatformSettings() {
  return useQuery({
    queryKey: adminKeys.list("settings"),
    queryFn: () => adminApi.settings.get(),
  })
}

export function useUpdateSettings() {
  return useAdminMutation(
    (patch: Partial<PlatformSettings>) => adminApi.settings.update(patch),
    { success: "Settings saved." }
  )
}

export function useIntegrations() {
  return useQuery({
    queryKey: adminKeys.list("integrations"),
    queryFn: () => adminApi.settings.integrations(),
  })
}

export function useToggleIntegration() {
  return useAdminMutation(
    (args: { id: string }) => adminApi.settings.toggleIntegration(args.id),
    {
      success: (integration) =>
        `${integration.name} ${integration.connected ? "connected" : "disconnected"}.`,
    }
  )
}

/* ----------------------------------------------------- notifications */

export function useNotifications() {
  return useQuery({
    queryKey: adminKeys.list("notifications"),
    queryFn: () => adminApi.notifications.list(),
  })
}

export function useMarkAllNotificationsRead() {
  return useAdminMutation(() => adminApi.notifications.markAllRead(), {
    success: "All notifications marked read.",
    invalidate: [adminKeys.list("notifications")],
  })
}
