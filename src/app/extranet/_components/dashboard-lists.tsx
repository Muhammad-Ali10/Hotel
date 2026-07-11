import Link from "next/link"
import { ArrowRight } from "lucide-react"

import {
  pendingActions,
  reservations,
  tips,
  upcomingCheckIns,
} from "@/data/extranet"
import { formatDate } from "@/lib/format"
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
                <div className="font-medium">{r.guest}</div>
                <div className="text-muted-foreground text-xs">{r.source}</div>
              </TableCell>
              <TableCell>
                <div>{r.room}</div>
                <div className="text-muted-foreground text-xs">
                  Room {r.roomNo}
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
        </TableBody>
      </Table>
    </SectionCard>
  )
}

export function UpcomingCheckIns() {
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
        {upcomingCheckIns.map((c) => (
          <li
            key={c.guest}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.guest}</p>
              <p className="text-muted-foreground truncate text-xs">
                #{c.roomNo} · {c.room}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {c.inDays}d
            </Badge>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

export function PendingActions() {
  return (
    <SectionCard title="Pending Actions">
      <ul className="space-y-3">
        {pendingActions.map((a) => (
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
