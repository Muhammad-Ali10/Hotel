"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { formatDate } from "@/lib/format"
import { nightsBetween, toISODate } from "@/lib/domain"
import { usePartnerBookings, usePartnerReviews } from "@/lib/api/hooks"
import { Icon, SectionCard } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const cellPad =
  "[&_th]:px-4 [&_td]:px-4 [&_th:first-child]:pl-5 [&_td:first-child]:pl-5 [&_th:last-child]:pr-5 [&_td:last-child]:pr-5"

export function RecentReservations() {
  const bookings = usePartnerBookings()

  /*
   * Newest first, by when the booking was MADE.
   *
   * "Recent" on a reservations list means recently taken, not soonest to
   * arrive — the list beneath it is the one sorted by stay date.
   */
  const recent = [...(bookings.data ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)

  return (
    <SectionCard
      title="Recent Reservations"
      action={
        <Link
          href="/extranet/reservations"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
        >
          View all <ArrowRight className="size-3.5" />
        </Link>
      }
      contentClassName="px-0"
    >
      <Table className={cellPad}>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Guest</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead>Check-out</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recent.map((b) => (
            <TableRow key={b.id}>
              {/* The REF, not the id — it is what a guest quotes on the phone. */}
              <TableCell className="font-medium">{b.ref}</TableCell>
              <TableCell>
                <div className="font-medium">
                  {b.guest.firstName} {b.guest.lastName}
                </div>
                <div className="text-muted-foreground text-xs">{b.source}</div>
              </TableCell>
              <TableCell>
                <div>{b.roomName}</div>
                <div className="text-muted-foreground text-xs">
                  {b.roomNo ? `Room ${b.roomNo}` : b.propertyName}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(b.checkIn)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(b.checkOut)}
              </TableCell>
            </TableRow>
          ))}
          {bookings.isPending ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                Loading…
              </TableCell>
            </TableRow>
          ) : recent.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                No reservations yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </SectionCard>
  )
}

export function UpcomingCheckIns() {
  const bookings = usePartnerBookings()
  const today = toISODate(new Date())

  const checkIns = (bookings.data ?? [])
    .filter((b) => b.status === "confirmed" && b.checkIn >= today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .slice(0, 6)

  return (
    <SectionCard
      title="Upcoming Check-ins"
      action={
        <Link
          href="/extranet/reservations"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
        >
          View all <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      <ul className="divide-y">
        {checkIns.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {b.guest.firstName} {b.guest.lastName}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {b.roomNo ? `#${b.roomNo} · ` : ""}
                {b.roomName}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {nightsBetween(today, b.checkIn)}d
            </Badge>
          </li>
        ))}
        {bookings.isPending ? (
          <li className="text-muted-foreground py-3 text-sm">Loading…</li>
        ) : checkIns.length === 0 ? (
          <li className="text-muted-foreground py-3 text-sm">No arrivals scheduled.</li>
        ) : null}
      </ul>
    </SectionCard>
  )
}

/**
 * Work waiting, and only work that exists.
 *
 * This list used to be padded out with fixed copy — "Update your seasonal
 * rates", "Complete your property profile" — each with a Take Action button
 * that fired a toast. An action list whose items cannot be actioned trains a
 * partner to ignore the one item that can.
 *
 * Every row here is counted from the API and links to the screen that clears
 * it. When there is nothing, the card says so, which is a useful thing to know.
 */
export function PendingActions() {
  const bookings = usePartnerBookings()
  const reviews = usePartnerReviews("published")

  const today = toISODate(new Date())
  const all = bookings.data ?? []

  const arrivingToday = all.filter(
    (b) => b.checkIn === today && b.status === "confirmed"
  ).length
  const departingToday = all.filter(
    (b) => b.checkOut === today && b.status === "checked_in"
  ).length
  const awaitingReply = (reviews.data?.items ?? []).filter(
    (r) => r.response === null
  ).length

  type Action = {
    id: string
    icon: string
    title: string
    meta: string
    href: string
  }

  const items: Action[] = [
    arrivingToday > 0 && {
      id: "arrivals",
      icon: "CalendarClock",
      title: `${arrivingToday} ${arrivingToday === 1 ? "guest arrives" : "guests arrive"} today`,
      meta: "Check them in as they reach the desk",
      href: "/extranet/reservations",
    },
    departingToday > 0 && {
      id: "departures",
      icon: "LogOut",
      title: `${departingToday} ${departingToday === 1 ? "guest is" : "guests are"} due to check out`,
      meta: "Mark the stay complete once the room is free",
      href: "/extranet/reservations",
    },
    awaitingReply > 0 && {
      id: "reviews",
      icon: "MessageSquare",
      title: `${awaitingReply} ${awaitingReply === 1 ? "review has" : "reviews have"} no reply`,
      meta: "A reply is public and counts toward your rating",
      href: "/extranet/reviews",
    },
  ].filter((item): item is Action => item !== false)

  return (
    <SectionCard title="Pending Actions">
      {bookings.isPending ? (
        <div className="bg-muted h-20 animate-pulse rounded-lg" aria-busy="true" />
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing waiting. No arrivals or departures today, and every review has been
          answered.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Icon name={item.icon} className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug font-medium">{item.title}</p>
                <p className="text-muted-foreground text-xs">{item.meta}</p>
              </div>
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground shrink-0"
                render={
                  <Link href={item.href}>
                    Open <ArrowRight className="size-3" />
                  </Link>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
