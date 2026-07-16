"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { pendingActions, tips } from "@/data/extranet"
import { formatDate } from "@/lib/format"
import { guestName, nightsBetween, toISODate } from "@/lib/domain"
import { usePartnerReservations, usePartnerStats } from "@/store/selectors"
import {
  ActionButton,
  ConfirmDialog,
  SectionCard,
  Icon,
} from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  const reservations = usePartnerReservations()

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
            <TableHead>ID</TableHead>
            <TableHead>Guest</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead>Check-out</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.slice(0, 8).map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.id}</TableCell>
              <TableCell>
                <div className="font-medium">{guestName(r)}</div>
                <div className="text-muted-foreground text-xs">{r.source}</div>
              </TableCell>
              <TableCell>
                <div>{r.roomName}</div>
                <div className="text-muted-foreground text-xs">
                  {r.roomNo ? `Room ${r.roomNo}` : r.hotelName}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(r.checkIn)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(r.checkOut)}
              </TableCell>
            </TableRow>
          ))}
          {reservations.length === 0 ? (
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

/** Derived from the reservation list rather than a hand-written side table, so
 *  the guests named here are guests who actually have a booking. */
export function UpcomingCheckIns() {
  const reservations = usePartnerReservations()
  const today = toISODate(new Date())
  const checkIns = reservations
    .filter((r) => r.status === "confirmed" && r.checkIn >= today)
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
        {checkIns.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{guestName(c)}</p>
              <p className="text-muted-foreground truncate text-xs">
                {c.roomNo ? `#${c.roomNo} · ` : ""}
                {c.roomName}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {nightsBetween(today, c.checkIn)}d
            </Badge>
          </li>
        ))}
        {checkIns.length === 0 ? (
          <li className="text-muted-foreground py-3 text-sm">No arrivals scheduled.</li>
        ) : null}
      </ul>
    </SectionCard>
  )
}

/**
 * Pending actions. The review and arrival lines are counted from the store —
 * they used to be fixed copy ("3 guest reviews need a response") sitting next
 * to a Reviews screen that derived a different number from the same data.
 */
export function PendingActions() {
  const { pendingReviews, awaitingReply } = usePartnerStats()
  const reservations = usePartnerReservations()
  const today = toISODate(new Date())
  const toConfirm = reservations.filter(
    (r) => r.status === "pending" && r.checkIn >= today
  ).length
  const reviewsToAction = pendingReviews + awaitingReply

  const derived: typeof pendingActions = [
    ...(toConfirm > 0
      ? [
          {
            id: "pa-confirm",
            title: `${toConfirm} ${toConfirm === 1 ? "reservation requires" : "reservations require"} confirmation`,
            meta: "Guests are waiting",
            icon: "CalendarClock",
          },
        ]
      : []),
    ...(reviewsToAction > 0
      ? [
          {
            id: "pa-reviews",
            title: `${reviewsToAction} guest ${reviewsToAction === 1 ? "review needs" : "reviews need"} a response`,
            meta: "Respond within 48h",
            icon: "MessageSquare",
          },
        ]
      : []),
    // the rest are genuinely static demo items with no store counterpart
    ...pendingActions.filter(
      (a) => !/check-in confirmation|guest reviews/i.test(a.title)
    ),
  ]

  return (
    <SectionCard title="Pending Actions">
      <ul className="space-y-3">
        {derived.map((a) => (
          <li key={a.id} className="flex items-start gap-3">
            <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Icon name={a.icon} className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug font-medium">{a.title}</p>
              <p className="text-muted-foreground text-xs">{a.meta}</p>
            </div>
            {a.title.toLowerCase().includes("confirm") ? (
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground shrink-0"
                  >
                    Take action <ArrowRight className="size-3" />
                  </Button>
                }
                title="Confirm check-ins"
                description={a.title}
                confirmLabel="Confirm"
                toastMessage={`Handling: ${a.title}`}
              />
            ) : (
              <ActionButton
                variant="ghost"
                size="xs"
                toastType="info"
                toastMessage={`Handling: ${a.title}`}
                className="text-muted-foreground shrink-0"
              >
                Take action <ArrowRight className="size-3" />
              </ActionButton>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

export function Tips() {
  return (
    <SectionCard
      title="Tips & Advice"
      action={
        <Link
          href="/extranet/boost"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
        >
          Find more advice <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tips.map((t) => (
          <Card size="sm" key={t.id} className="bg-muted/40">
            <CardContent className="space-y-3">
              <span className="bg-background flex size-9 items-center justify-center rounded-lg ring-1 ring-foreground/10">
                <Icon name={t.icon} className="size-4" />
              </span>
              <p className="text-sm leading-snug font-medium">{t.title}</p>
              <ActionButton
                variant="link"
                size="sm"
                toastType="info"
                toastMessage={`Opening guide: ${t.title}`}
                className="text-foreground h-auto gap-1 p-0"
              >
                {t.cta} <ArrowRight className="size-3.5" />
              </ActionButton>
            </CardContent>
          </Card>
        ))}
      </div>
    </SectionCard>
  )
}
