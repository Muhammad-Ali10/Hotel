"use client"

import * as React from "react"
import { CopyPlus } from "lucide-react"
import { toast } from "sonner"

import { inventoryApi } from "@/lib/api/endpoints"
import { keys, usePropertyRatePlans } from "@/lib/api/hooks"
import { useQueryClient } from "@tanstack/react-query"
import { useActiveProperty } from "@/components/extranet/active-property"
import { addDays, toISODate } from "@/lib/domain"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NotFoundCard } from "@/components/shared/not-found-card"
import { cn } from "@/lib/utils"

function DateRangeCard({
  title,
  description,
  from,
  to,
  onFrom,
  onTo,
  idPrefix,
}: {
  title: string
  description: string
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
  idPrefix: string
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-heading text-sm font-semibold">{title}</h3>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-from`}>From</Label>
            <Input
              id={`${idPrefix}-from`}
              type="date"
              value={from}
              onChange={(e) => onFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-to`}>To</Label>
            <Input
              id={`${idPrefix}-to`}
              type="date"
              value={to}
              onChange={(e) => onTo(e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Copying one stretch of calendar onto another (rule #100).
 *
 * The old form copied "room types" — chips naming rooms from a different hotel
 * — and the button toasted. Neither half was real: rates do not live on a
 * room, they live on a RATE PLAN, and one room usually has several selling at
 * different prices. Copying "the Deluxe" would be ambiguous even if the rooms
 * had been this property's.
 *
 * So the source is one plan, and the targets are plans. Two things the server
 * does that are worth saying on the screen, because they surprise people:
 *
 *   - **a short source repeats over a longer target.** Copying a typical week
 *     across a season is the whole reason this screen exists.
 *   - **a source night with no rate CLEARS nothing** — the matching target
 *     night is left exactly as it was. A sparse calendar means "fall back to
 *     the plan", and copying a gap would replace that fallback with an
 *     explicit nothing.
 */
export function CopyRatesForm() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const plans = usePropertyRatePlans(active?.id ?? "")
  const client = useQueryClient()

  const today = toISODate(new Date())
  const [sourceFrom, setSourceFrom] = React.useState(today)
  const [sourceTo, setSourceTo] = React.useState(addDays(today, 6))
  const [targetFrom, setTargetFrom] = React.useState(addDays(today, 7))
  const [targetTo, setTargetTo] = React.useState(addDays(today, 90))

  const [sourceId, setSourceId] = React.useState<string | null>(null)
  const [targetIds, setTargetIds] = React.useState<string[] | null>(null)
  const [busy, setBusy] = React.useState(false)

  const live = React.useMemo(
    () => (plans.data ?? []).filter((p) => p.status === "active"),
    [plans.data]
  )

  const source = live.find((p) => p.id === sourceId) ?? live[0] ?? null

  /** Defaults to the source alone — copying a plan onto itself, forward. */
  const targets = React.useMemo(() => {
    if (!source) return []
    if (targetIds === null) return [source.id]
    return targetIds.filter((id) => live.some((p) => p.id === id))
  }, [targetIds, live, source])

  if (loadingProperties || plans.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="bg-muted h-48 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (!active) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to copy its rates."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  if (!source) {
    return (
      <NotFoundCard
        title="No rate plan to copy"
        description="A rate belongs to a rate plan. This property needs one first."
        href="/extranet/property/room-types"
        cta="Room types"
      />
    )
  }

  async function copy() {
    if (!active || !source) return
    if (sourceTo < sourceFrom || targetTo < targetFrom) {
      toast.error("A range ends before it starts.")
      return
    }
    if (targets.length === 0) {
      toast.error("Pick at least one plan to copy into.")
      return
    }

    setBusy(true)
    let affected = 0
    const failures: string[] = []

    /*
     * One plan at a time.
     *
     * The API copies into a single target, and firing them together would race
     * several writes into the same calendar rows. Sequential is slower and is
     * what a partner wants when the third of five is refused.
     */
    for (const targetRatePlanId of targets) {
      try {
        const result = await inventoryApi.copyRates({
          sourceRatePlanId: source.id,
          targetRatePlanId,
          sourceFrom,
          sourceTo,
          targetFrom,
          targetTo,
        })
        affected += result.datesAffected
      } catch (error) {
        const name = live.find((p) => p.id === targetRatePlanId)
        failures.push(
          `${name ? `${name.roomName} · ${name.name}` : targetRatePlanId}: ${
            error instanceof Error ? error.message : "failed"
          }`
        )
      }
    }

    void client.invalidateQueries({
      queryKey: ["stayora", "partner", "calendar", active.id],
    })
    void client.invalidateQueries({ queryKey: keys.rooms(active.id) })
    setBusy(false)

    if (affected > 0) {
      toast.success(
        `${affected} ${affected === 1 ? "night" : "nights"} updated`,
        {
          description:
            "Target nights whose source had no rate were left exactly as they were.",
        }
      )
    } else if (failures.length === 0) {
      toast.info("Nothing changed", {
        description: "No night in the source range carries a rate of its own.",
      })
    }

    if (failures.length > 0) {
      toast.error(
        `${failures.length} ${failures.length === 1 ? "plan" : "plans"} could not be copied`,
        { description: failures[0] }
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <DateRangeCard
          idPrefix="source"
          title="Source dates"
          description="The nights to read. A short range repeats across a longer target."
          from={sourceFrom}
          to={sourceTo}
          onFrom={setSourceFrom}
          onTo={setSourceTo}
        />
        <DateRangeCard
          idPrefix="target"
          title="Target dates"
          description="The nights to write."
          from={targetFrom}
          to={targetTo}
          onFrom={setTargetFrom}
          onTo={setTargetTo}
        />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="copy-source">Copy from</Label>
            <select
              id="copy-source"
              className="border-input bg-background h-9 w-full max-w-md rounded-md border px-3 text-sm"
              value={source.id}
              onChange={(e) => setSourceId(e.target.value)}
            >
              {live.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.roomName} · {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Copy into</Label>
              <Button
                variant="ghost"
                size="xs"
                onClick={() =>
                  setTargetIds(
                    targets.length === live.length ? [] : live.map((p) => p.id)
                  )
                }
              >
                {targets.length === live.length ? "Clear all" : "Select all"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {live.map((plan) => {
                const on = targets.includes(plan.id)
                return (
                  <button
                    key={plan.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setTargetIds(
                        on ? targets.filter((id) => id !== plan.id) : [...targets, plan.id]
                      )
                    }
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                      on
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {plan.roomName} · {plan.name}
                  </button>
                )
              })}
            </div>
            <p className="text-muted-foreground text-xs">
              {/*
               * Copying between plans is legitimate and worth flagging.
               *
               * A non-refundable rate is usually priced BELOW the flexible one;
               * copying flexible prices into it silently removes the discount.
               */}
              {targets.length === 1 && targets[0] === source.id
                ? "Copying this plan onto its own future dates."
                : `Prices from “${source.name}” will overwrite ${targets.length} ${
                    targets.length === 1 ? "plan" : "plans"
                  }. A plan priced differently on purpose will lose that difference.`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Button disabled={busy || targets.length === 0} onClick={copy}>
        <CopyPlus className="size-4" />
        {busy ? "Copying…" : "Copy rates"}
      </Button>
    </div>
  )
}
