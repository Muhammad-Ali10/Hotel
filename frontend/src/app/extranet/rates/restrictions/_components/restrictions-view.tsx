"use client"

import * as React from "react"
import { toast } from "sonner"

import type { CalendarNight } from "@/lib/api/endpoints"
import { cellPad } from "@/lib/extranet/constants"
import { formatDate } from "@/lib/format"
import { addDays, toISODate } from "@/lib/domain"
import { useCalendar, useSetRates } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { SectionCard } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NotFoundCard } from "@/components/shared/not-found-card"

/** How far ahead the "what is set" table looks. Said out loud on the screen. */
const HORIZON_DAYS = 90

/**
 * What a guest is and is not allowed to book (rules #29–#35).
 *
 * This screen used to invent an entity. It listed "restriction rules" with
 * names and free-text values — "2 nights" — against room types belonging to a
 * hotel that is not this one, and every action toasted and changed nothing.
 *
 * A restriction is not a named rule. It is a set of numbers on a RATE PLAN,
 * for a stretch of nights, which the availability query reads when it decides
 * whether a stay can be sold. So the screen sets exactly that, across a date
 * range, and shows what is currently set.
 *
 * The three states of every field are the point:
 *
 *   - **leave alone** — the field is not sent, and whatever is there stays
 *   - **set** — the value applies to every night in the range
 *   - **clear** — the night goes back to the plan's own default
 *
 * That last one is not a nicety. A minimum stay set by mistake keeps refusing
 * bookings, and until the API told these two apart there was no way back.
 */

type FieldKey =
  | "minStay"
  | "minStayThrough"
  | "maxStay"
  | "minAdvanceHours"
  | "closedToArrival"
  | "closedToDeparture"

type Mode = "keep" | "set" | "clear"

const NUMBER_FIELDS: {
  key: Extract<FieldKey, "minStay" | "minStayThrough" | "maxStay" | "minAdvanceHours">
  label: string
  hint: string
  min: number
  max: number
}[] = [
  {
    key: "minStay",
    label: "Minimum stay",
    hint: "Nights. Read against the arrival night.",
    min: 1,
    max: 365,
  },
  {
    key: "minStayThrough",
    label: "Minimum stay through",
    hint: "Nights, read against EVERY night of the stay — the stricter form.",
    min: 1,
    max: 365,
  },
  { key: "maxStay", label: "Maximum stay", hint: "Nights.", min: 1, max: 365 },
  {
    key: "minAdvanceHours",
    label: "Minimum advance notice",
    hint: "Hours before check-in that a booking must be made.",
    min: 0,
    max: 8760,
  },
]

const FLAG_FIELDS: {
  key: Extract<FieldKey, "closedToArrival" | "closedToDeparture">
  label: string
  hint: string
}[] = [
  {
    key: "closedToArrival",
    label: "Closed to arrival",
    hint: "A stay may cover this night, but may not start on it.",
  },
  {
    key: "closedToDeparture",
    label: "Closed to departure",
    hint: "A stay may cover this night, but may not end on it.",
  },
]

export function RestrictionsView() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const [choice, setChoice] = React.useState<{ roomId: string; planId: string } | null>(null)

  const today = toISODate(new Date())
  const [from, setFrom] = React.useState(today)
  const [to, setTo] = React.useState(addDays(today, 30))

  const [modes, setModes] = React.useState<Record<FieldKey, Mode>>({
    minStay: "keep",
    minStayThrough: "keep",
    maxStay: "keep",
    minAdvanceHours: "keep",
    closedToArrival: "keep",
    closedToDeparture: "keep",
  })
  const [values, setValues] = React.useState<Record<FieldKey, string>>({
    minStay: "2",
    minStayThrough: "2",
    maxStay: "14",
    minAdvanceHours: "24",
    closedToArrival: "true",
    closedToDeparture: "true",
  })

  const calendar = useCalendar(active?.id ?? "", {
    from: today,
    to: addDays(today, HORIZON_DAYS),
  })
  const setRates = useSetRates(active?.id ?? "")

  const rooms = React.useMemo(() => calendar.data?.rooms ?? [], [calendar.data])

  const selected = React.useMemo(() => {
    if (rooms.length === 0) return null
    const room =
      rooms.find((r) => r.id === choice?.roomId) ??
      rooms.find((r) => r.ratePlans.some((p) => p.status === "active")) ??
      rooms[0]!
    const plans = room.ratePlans.filter((p) => p.status === "active")
    const plan = plans.find((p) => p.id === choice?.planId) ?? plans[0] ?? room.ratePlans[0]
    return plan ? { room, plan } : null
  }, [rooms, choice])

  if (loadingProperties || calendar.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="bg-muted h-72 animate-pulse rounded-xl" />
        <div className="bg-muted h-64 animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!active) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to manage its restrictions."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  if (calendar.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {calendar.error.message}
      </div>
    )
  }

  if (!selected) {
    return (
      <NotFoundCard
        title="Nothing to restrict yet"
        description="A restriction belongs to a rate plan. This property needs one first."
        href="/extranet/property/room-types"
        cta="Room types"
      />
    )
  }

  const plan = selected.plan
  const room = selected.room

  /*
   * Nights that say something the plan does not.
   *
   * Every night arrives already resolved against the plan's defaults, so the
   * resolved value alone cannot answer "did somebody set this here". Comparing
   * against the plan's own numbers is what separates "two nights was set on
   * this date" from "two nights is simply what this plan sells".
   */
  const set = plan.nights.filter(
    (n) =>
      n.minStayThrough !== null ||
      n.minAdvanceHours !== null ||
      n.closedToArrival ||
      n.closedToDeparture ||
      n.minStay !== plan.defaultMinStay ||
      n.maxStay !== plan.defaultMaxStay
  )

  function apply() {
    if (!active) return
    if (to < from) {
      toast.error("The range ends before it starts.")
      return
    }

    const body: Record<string, unknown> = {
      ratePlanId: plan.id,
      from,
      to,
    }

    for (const key of Object.keys(modes) as FieldKey[]) {
      const mode = modes[key]
      // `keep` sends nothing at all — that is what leaves the night alone.
      if (mode === "keep") continue
      if (mode === "clear") {
        body[key] = null
        continue
      }
      if (key === "closedToArrival" || key === "closedToDeparture") {
        body[key] = values[key] === "true"
        continue
      }
      const n = Number(values[key])
      if (!Number.isInteger(n)) {
        toast.error(`Enter a whole number for ${key}.`)
        return
      }
      body[key] = n
    }

    const touched = Object.keys(body).length - 3
    if (touched === 0) {
      toast.error("Nothing to apply.", {
        description: "Switch at least one restriction to Set or Clear.",
      })
      return
    }

    setRates.mutate(body, {
      onSuccess: ({ datesAffected }) =>
        toast.success(
          `${touched} ${touched === 1 ? "restriction" : "restrictions"} applied to ${datesAffected} ${
            datesAffected === 1 ? "night" : "nights"
          }`,
          { description: `${room.name} · ${plan.name}` }
        ),
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="res-room" className="text-xs">
            Room
          </Label>
          <select
            id="res-room"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={room.id}
            onChange={(e) => {
              const next = rooms.find((r) => r.id === e.target.value)
              const p = next?.ratePlans.find((x) => x.status === "active") ?? next?.ratePlans[0]
              setChoice({ roomId: e.target.value, planId: p?.id ?? "" })
            }}
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="res-plan" className="text-xs">
            Rate plan
          </Label>
          <select
            id="res-plan"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={plan.id}
            onChange={(e) => setChoice({ roomId: room.id, planId: e.target.value })}
          >
            {room.ratePlans
              .filter((p) => p.status === "active")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        <p className="text-muted-foreground flex-1 text-sm">
          A restriction belongs to one rate plan. The same room sold on another plan
          keeps its own.
        </p>
      </Card>

      <SectionCard
        title="Apply to a date range"
        description="Leave a field alone, set it, or clear it back to the plan's own value."
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-from">From</Label>
              <Input
                id="res-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-to">To</Label>
              <Input
                id="res-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {NUMBER_FIELDS.map((field) => (
              <FieldRow
                key={field.key}
                label={field.label}
                hint={field.hint}
                mode={modes[field.key]}
                onMode={(m) => setModes((s) => ({ ...s, [field.key]: m }))}
              >
                <Input
                  type="number"
                  min={field.min}
                  max={field.max}
                  className="h-9 w-28"
                  aria-label={field.label}
                  disabled={modes[field.key] !== "set"}
                  value={values[field.key]}
                  onChange={(e) =>
                    setValues((s) => ({ ...s, [field.key]: e.target.value }))
                  }
                />
              </FieldRow>
            ))}

            {FLAG_FIELDS.map((field) => (
              <FieldRow
                key={field.key}
                label={field.label}
                hint={field.hint}
                mode={modes[field.key]}
                onMode={(m) => setModes((s) => ({ ...s, [field.key]: m }))}
              >
                <select
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm disabled:opacity-50"
                  aria-label={field.label}
                  disabled={modes[field.key] !== "set"}
                  value={values[field.key]}
                  onChange={(e) =>
                    setValues((s) => ({ ...s, [field.key]: e.target.value }))
                  }
                >
                  <option value="true">Closed</option>
                  <option value="false">Open</option>
                </select>
              </FieldRow>
            ))}
          </div>

          <div className="flex items-center gap-3 border-t pt-4">
            <Button disabled={setRates.isPending} onClick={apply}>
              {setRates.isPending ? "Applying…" : "Apply to range"}
            </Button>
            <p className="text-muted-foreground text-sm">
              {room.name} · {plan.name}
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Nights with a restriction ({set.length})
          </h2>
          <p className="text-muted-foreground text-sm">
            Next {HORIZON_DAYS} days · plan default is {plan.name}
          </p>
        </div>
        <Card className="py-0">
          <div className="overflow-x-auto">
            <Table className={cellPad}>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Restrictions</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {set.map((night) => (
                  <TableRow key={night.date}>
                    <TableCell className="font-medium">{formatDate(night.date)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {describe(night, plan).map((text) => (
                          <Badge key={text} variant="secondary">
                            {text}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={setRates.isPending}
                        onClick={() =>
                          setRates.mutate(
                            {
                              ratePlanId: plan.id,
                              from: night.date,
                              to: night.date,
                              minStay: null,
                              minStayThrough: null,
                              maxStay: null,
                              minAdvanceHours: null,
                              closedToArrival: null,
                              closedToDeparture: null,
                            },
                            {
                              onSuccess: () =>
                                toast.success(
                                  `${formatDate(night.date)} back to the plan's defaults`
                                ),
                              onError: (e) => toast.error(e.message),
                            }
                          )
                        }
                      >
                        Clear
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {set.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground py-8 text-center">
                      No night in the next {HORIZON_DAYS} days restricts anything beyond
                      what {plan.name} already says.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  )
}

/** One field, with its three states. */
function FieldRow({
  label,
  hint,
  mode,
  onMode,
  children,
}: {
  label: string
  hint: string
  mode: Mode
  onMode: (mode: Mode) => void
  children: React.ReactNode
}) {
  const modeLabel: Record<Mode, string> = {
    keep: "Leave",
    set: "Set",
    clear: "Clear",
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
        {children}
      </div>
      <div className="flex gap-1">
        {(["keep", "set", "clear"] as Mode[]).map((m) => (
          <Button
            key={m}
            size="xs"
            variant={mode === m ? "default" : "outline"}
            onClick={() => onMode(m)}
          >
            {modeLabel[m]}
          </Button>
        ))}
      </div>
    </div>
  )
}

/**
 * Plain words for what a night restricts, beyond what the plan already says.
 *
 * A night matching the plan is not mentioned: repeating the plan's own minimum
 * on every row is noise that hides the two dates somebody actually changed.
 */
function describe(night: CalendarNight, plan: { defaultMinStay: number; defaultMaxStay: number | null }): string[] {
  const out: string[] = []
  if (night.minStay !== plan.defaultMinStay) out.push(`Min ${night.minStay} nights`)
  if (night.minStayThrough !== null) out.push(`Min ${night.minStayThrough} through`)
  if (night.maxStay !== null && night.maxStay !== plan.defaultMaxStay) {
    out.push(`Max ${night.maxStay} nights`)
  }
  if (night.minAdvanceHours !== null) out.push(`${night.minAdvanceHours}h notice`)
  if (night.closedToArrival) out.push("No arrival")
  if (night.closedToDeparture) out.push("No departure")
  return out
}
