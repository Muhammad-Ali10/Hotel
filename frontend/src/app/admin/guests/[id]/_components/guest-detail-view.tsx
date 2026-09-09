"use client"

import Link from "next/link"

import { formatCurrency, formatDate } from "@/lib/format"
import { useUser } from "@/lib/admin/api/hooks"
import {
  AdminPageHeader,
  DescriptionList,
  SectionCard,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { CardListSkeleton } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Guest detail — the destination the Figma's "View" action never had.
 *
 * Enough to answer a complaint and no more (rule #80). There is no password
 * hash here because it lives in its own table precisely so a profile query
 * cannot return one, and no card details because this system has never held
 * any (rule #43).
 *
 * "Total spent" counts REALISED stays only — completed and in-progress. A
 * lifetime figure that included a cancelled booking would tell support this
 * guest is worth more than they are, on money that went back.
 */
export function GuestDetailView({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useUser(id)

  if (error) {
    return (
      <ErrorState
        variant="page"
        title="Guest not found"
        error={error}
        onRetry={() => void refetch()}
      />
    )
  }

  if (isLoading || !data) return <CardListSkeleton count={2} />

  const name = `${data.firstName} ${data.lastName}`.trim() || data.email

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={name}
        subtitle={[data.country, data.role].filter(Boolean).join(" · ")}
      >
        <StatusPill status={data.status} />
      </AdminPageHeader>

      <StatGrid
        stats={[
          {
            label: "Bookings",
            value: String(data.stats.bookings),
            caption: `${data.stats.completed} completed`,
            icon: "CalendarCheck",
          },
          {
            label: "Total spent",
            value: formatCurrency(data.stats.spend),
            caption: "realised stays only",
            icon: "DollarSign",
          },
          {
            label: "Cancelled",
            value: String(data.stats.cancelled),
            icon: "Clock",
          },
          {
            label: "Reviews written",
            value: String(data.stats.reviews),
            icon: "Star",
          },
        ]}
      />

      <SectionCard title="Contact">
        <DescriptionList
          columns={3}
          items={[
            { label: "Email", value: data.email },
            {
              label: "Email verified",
              value: data.emailVerified ? (
                "Yes"
              ) : (
                /*
                 * The usual explanation for "I never got my confirmation".
                 *
                 * Worth surfacing plainly rather than as a warning — an
                 * unverified address is common and not, by itself, a problem.
                 */
                <span className="text-muted-foreground">
                  No — confirmations may not be reaching them
                </span>
              ),
            },
            { label: "Phone", value: data.phone || "—" },
            { label: "Country", value: data.country || "—" },
            { label: "Tier", value: <Badge variant="secondary">{data.tier}</Badge> },
            { label: "Registered", value: formatDate(data.createdAt) },
          ]}
        />
      </SectionCard>

      <SectionCard title="Bookings" contentClassName="px-0">
        {data.bookings.length === 0 ? (
          <EmptyState
            title="No bookings on record"
            description="This guest has never booked on the platform."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="pl-6">
                  Reference
                </TableHead>
                <TableHead scope="col">Property</TableHead>
                <TableHead scope="col">Stay</TableHead>
                <TableHead scope="col">Source</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="pr-6 text-right">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="pl-6 font-medium">{booking.ref}</TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/properties/${booking.propertyId}`}
                      className="hover:text-primary underline-offset-2 hover:underline"
                    >
                      {/* The name is a snapshot on the booking — no lookup. */}
                      {booking.propertyName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {booking.source}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={booking.status} />
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">
                    {formatCurrency(booking.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title="Reviews" contentClassName="px-0">
        {data.reviews.length === 0 ? (
          <EmptyState
            title="No reviews written"
            description="This guest has not reviewed a stay."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="pl-6">
                  Review
                </TableHead>
                <TableHead scope="col">Rating</TableHead>
                <TableHead scope="col">Written</TableHead>
                <TableHead scope="col" className="pr-6">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.reviews.map((review) => (
                <TableRow key={review.id}>
                  <TableCell className="max-w-md pl-6">
                    <p className="truncate font-medium">{review.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {review.body}
                    </p>
                  </TableCell>
                  <TableCell className="tabular-nums">{review.rating}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(review.createdAt)}
                  </TableCell>
                  <TableCell className="pr-6">
                    <StatusPill status={review.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
