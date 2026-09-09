"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { formatCurrency, formatRelativeTime } from "@/lib/format"
import {
  useAdminCounts,
  useAuditEvents,
  usePlatformClients,
  usePlatformOverview,
} from "@/lib/admin/api/hooks"
import {
  DateRangeBar,
  delta,
  useDateRange,
} from "@/components/admin/date-range-bar"
import { AdminPageHeader, SectionCard, StatGrid } from "@/components/admin/shared"
import { MailHealthBanner } from "@/components/admin/mail-health-banner"
import { ErrorState } from "@/components/shared/states"
import { Skeleton, StatGridSkeleton } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/**
 * What the marketplace is doing, and what is waiting on the platform.
 *
 * The "Export report" button is gone. It fired a toast saying an email was on
 * its way and nothing followed — no job, no file, no email.
 *
 * The three queue tiles are the same counts the sidebar badges read, so the
 * dashboard and the sidebar cannot disagree about how much work is waiting.
 *
 * **GMV is not revenue.** The larger number is what guests paid across every
 * property — money passing through — and the platform's own revenue is the
 * commission inside it. Presenting the first as the second is the standard way
 * a marketplace overstates itself, so both are here, labelled.
 */
export function DashboardView() {
  const { range, controls } = useDateRange(90)
  const overview = usePlatformOverview(range)
  const clients = usePlatformClients(range)
  const { badges, isPending: countsPending } = useAdminCounts()
  const audit = useAuditEvents({ limit: 8 })

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const d = overview.data

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Dashboard"
        subtitle={`Every client, property and booking · ${today}`}
      />

      {/*
        Renders nothing while mail is healthy. It is here rather than on the
        settings page because a delivery failure is silent everywhere else —
        the only way anybody finds out today is a partner asking why they were
        never told something.
      */}
      <MailHealthBanner />

      <DateRangeBar controls={controls} />

      {overview.error ? (
        <ErrorState
          error={overview.error}
          onRetry={() => void overview.refetch()}
          variant="page"
        />
      ) : overview.isLoading || !d ? (
        <StatGridSkeleton count={6} />
      ) : (
        <StatGrid
          className="lg:grid-cols-3 xl:grid-cols-6"
          stats={[
            {
              label: "GMV",
              value: formatCurrency(d.gmv),
              delta: delta(d.gmv, d.previous.gmv),
              caption: "what guests paid",
            },
            {
              label: "Our revenue",
              value: formatCurrency(d.revenue),
              delta: delta(d.revenue, d.previous.revenue),
              caption: "commission earned",
            },
            {
              label: "Take rate",
              value: d.takeRate === null ? "—" : `${(d.takeRate * 100).toFixed(2)}%`,
              caption: d.takeRate === null ? "nothing traded" : "revenue ÷ GMV",
            },
            {
              label: "Bookings",
              value: String(d.bookings),
              delta: delta(d.bookings, d.previous.bookings),
              caption: `${d.cancelled} cancelled`,
            },
            {
              label: "Clients",
              value: String(d.shape.activeOrgs),
              caption: `of ${d.shape.orgs}`,
            },
            {
              label: "Live listings",
              value: String(d.shape.liveProperties),
              caption: `of ${d.shape.properties}`,
            },
          ]}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Waiting on us" className="lg:col-span-1">
          <ul className="space-y-3">
            {[
              {
                label: "Listings to review",
                value: badges.propertiesPending,
                href: "/admin/properties",
              },
              {
                label: "Reviews to moderate",
                value: badges.reviewsToModerate,
                href: "/admin/reviews",
              },
              {
                label: "Open tickets",
                value: badges.inboxUnread,
                href: "/admin/inbox",
              },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-3">
                <Link
                  href={row.href}
                  className="hover:text-primary text-sm underline-offset-2 hover:underline"
                >
                  {row.label}
                </Link>
                <span className="font-heading text-lg font-semibold tabular-nums">
                  {countsPending ? "—" : row.value}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Biggest clients"
          description="By gross booking value inside the window"
          className="lg:col-span-2"
        >
          {clients.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (clients.data?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm">
              No client traded in this window.
            </p>
          ) : (
            <ul className="divide-y">
              {(clients.data ?? []).slice(0, 6).map((row) => (
                <li
                  key={row.orgId}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/clients/${row.orgId}`}
                      className="hover:text-primary truncate text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {row.orgName}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {row.properties}{" "}
                      {row.properties === 1 ? "property" : "properties"} ·{" "}
                      {row.bookings} bookings
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {formatCurrency(row.gmv)}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {(row.share * 100).toFixed(1)}% of GMV
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recently done"
        description="The last few actions the platform took, with the reason given."
        action={
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link href="/admin/audit">
                Full log <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
        }
      >
        {audit.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (audit.data?.items.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing logged yet. Suspensions, refunds and listing decisions all
            appear here.
          </p>
        ) : (
          <ul className="divide-y">
            {(audit.data?.items ?? []).map((line) => (
              <li key={line.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <Badge variant="secondary" className="mt-0.5 shrink-0">
                  {line.subjectType}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{line.action}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {line.actorEmail || "system"}
                    {line.reason ? ` — ${line.reason}` : ""}
                  </p>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatRelativeTime(line.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

/**
 * The route-level fallback while the admin bundle streams in.
 *
 * Deliberately shaped like the dashboard rather than a spinner: the layout
 * settling into place is less jarring than a blank page snapping into a full
 * one, and it lands in the same file so the two cannot drift apart.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <StatGridSkeleton count={6} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl lg:col-span-2" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
