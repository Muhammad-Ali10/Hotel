"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import type { PromotionDto } from "@/lib/api/endpoints"
import { formatCurrency, formatDate } from "@/lib/format"
import { addDays, toISODate } from "@/lib/domain"
import {
  usePartnerProperties,
  usePromotionActions,
  usePromotions,
} from "@/lib/api/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * One board, several screens.
 *
 * Mobile rates, Genius, long stays and the promotions list were four separate
 * screens over four separate blocks of invented data, each inventing its own
 * vocabulary for the same row. They are not four things: a mobile rate is a
 * promotion on the `mobile` channel, a Genius deal is one on the `genius`
 * channel, a long-stay deal is one with a minimum stay. Pricing reads the
 * channel and the minimum; `kind` is a label saying which screen groups it
 * (rule #16) and nothing in the discount ever consults it.
 *
 * So there is one board, and each screen passes the lens it looks through.
 */

export type PromotionLens = {
  /** Only promotions matching this are shown, and new ones are created with it. */
  channel?: PromotionDto["channel"]
  kind?: PromotionDto["kind"]
  /** A minimum stay this lens implies — the long-stay screen sets it. */
  minStayAtLeast?: number
  /** Wording for the empty state and the create button. */
  noun: string
  /** Said under the header when the lens has a caveat worth naming. */
  caveat?: string
}

const STATUS_TONE: Record<PromotionDto["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-primary/10 text-primary",
  active: "bg-primary text-primary-foreground",
  paused: "bg-muted text-muted-foreground",
  ended: "bg-muted text-muted-foreground",
}

/** What the guest actually saves. */
function discountLabel(p: PromotionDto): string {
  if (p.discountType === "percent") return `${p.discountValue}% off`
  if (p.discountType === "amount") return `${formatCurrency(p.discountValue)} off`
  return `${p.discountValue} free ${p.discountValue === 1 ? "night" : "nights"}`
}

function matches(p: PromotionDto, lens: PromotionLens) {
  if (lens.channel && p.channel !== lens.channel) return false
  if (lens.kind && p.kind !== lens.kind) return false
  if (lens.minStayAtLeast && (p.minStay ?? 0) < lens.minStayAtLeast) return false
  return true
}

export function PromotionsBoard({ lens }: { lens: PromotionLens }) {
  const promotions = usePromotions()
  const { update } = usePromotionActions()
  const [editing, setEditing] = React.useState<PromotionDto | null>(null)
  const [creating, setCreating] = React.useState(false)

  const list = React.useMemo(
    () => (promotions.data ?? []).filter((p) => matches(p, lens)),
    [promotions.data, lens]
  )

  if (promotions.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="bg-muted h-44 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (promotions.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {promotions.error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {lens.caveat ??
            "A promotion lowers the price a guest is quoted. Only one applies to a stay — the best one."}
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New {lens.noun}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="font-heading text-sm font-semibold">{p.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge className={STATUS_TONE[p.status]}>{p.status}</Badge>
                    <Badge variant="outline">{p.channel}</Badge>
                    {p.minStay ? (
                      <Badge variant="secondary">{p.minStay}+ nights</Badge>
                    ) : null}
                  </div>
                </div>
                <p className="font-heading shrink-0 text-right text-base font-semibold">
                  {discountLabel(p)}
                </p>
              </div>

              <p className="text-muted-foreground text-sm">
                {formatDate(p.startDate)} – {formatDate(p.endDate)} ·{" "}
                {p.propertyIds.length}{" "}
                {p.propertyIds.length === 1 ? "property" : "properties"} ·{" "}
                {p.roomIds.length === 0 ? "every room" : `${p.roomIds.length} rooms`}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="xs" onClick={() => setEditing(p)}>
                  Edit
                </Button>
                {p.status === "active" || p.status === "scheduled" ? (
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate(
                        { id: p.id, patch: { status: "paused" } },
                        {
                          onSuccess: () => toast.success(`${p.name} paused.`),
                          onError: (e) => toast.error(e.message),
                        }
                      )
                    }
                  >
                    Pause
                  </Button>
                ) : null}
                {p.status === "draft" || p.status === "paused" ? (
                  <Button
                    size="xs"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate(
                        { id: p.id, patch: { status: "active" } },
                        {
                          onSuccess: () => toast.success(`${p.name} is live.`),
                          onError: (e) => toast.error(e.message),
                        }
                      )
                    }
                  >
                    Activate
                  </Button>
                ) : null}
                {p.status !== "ended" ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate(
                        { id: p.id, patch: { status: "ended" } },
                        {
                          onSuccess: () =>
                            toast.success(`${p.name} ended.`, {
                              description:
                                "Bookings it already discounted keep their price.",
                            }),
                          onError: (e) => toast.error(e.message),
                        }
                      )
                    }
                  >
                    End
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground text-sm">
            No {lens.noun} yet. A new one starts as a draft — nothing goes live by
            accident.
          </CardContent>
        </Card>
      ) : null}

      {creating ? (
        <PromotionDialog lens={lens} onClose={() => setCreating(false)} />
      ) : null}
      {editing ? (
        <PromotionDialog
          lens={lens}
          promotion={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

function PromotionDialog({
  lens,
  promotion,
  onClose,
}: {
  lens: PromotionLens
  promotion?: PromotionDto
  onClose: () => void
}) {
  const properties = usePartnerProperties()
  const { create, update } = usePromotionActions()
  const busy = create.isPending || update.isPending

  const today = toISODate(new Date())
  const [form, setForm] = React.useState({
    name: promotion?.name ?? "",
    discountType: promotion?.discountType ?? ("percent" as PromotionDto["discountType"]),
    // Percent and free-nights are counts; `amount` is cents shown as dollars.
    discountValue: String(
      promotion
        ? promotion.discountType === "amount"
          ? promotion.discountValue / 100
          : promotion.discountValue
        : 10
    ),
    startDate: promotion?.startDate ?? today,
    endDate: promotion?.endDate ?? addDays(today, 30),
    minStay: String(promotion?.minStay ?? lens.minStayAtLeast ?? ""),
  })
  const [picked, setPicked] = React.useState<string[] | null>(
    promotion?.propertyIds ?? null
  )
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const all = properties.data ?? []
  const propertyIds = picked ?? all.map((p) => p.id)

  function save() {
    const value = Number(form.discountValue)
    if (!form.name.trim()) {
      toast.error("Give it a name.")
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("The discount must be above zero.")
      return
    }
    if (form.discountType === "percent" && value > 100) {
      // Above 100 the room is not merely free — it pays the guest.
      toast.error("A percentage discount cannot exceed 100.")
      return
    }
    if (form.endDate < form.startDate) {
      toast.error("It cannot end before it starts.")
      return
    }
    if (propertyIds.length === 0) {
      toast.error("Pick at least one property.")
      return
    }

    const minStay = form.minStay.trim() === "" ? null : Number(form.minStay)
    if (minStay !== null && (!Number.isInteger(minStay) || minStay < 1)) {
      toast.error("A minimum stay is a whole number of nights.")
      return
    }

    const body = {
      name: form.name.trim(),
      kind: lens.kind ?? ("seasonal_deal" as PromotionDto["kind"]),
      discountType: form.discountType,
      discountValue:
        form.discountType === "amount" ? Math.round(value * 100) : Math.round(value),
      startDate: form.startDate,
      endDate: form.endDate,
      minStay,
      channel: lens.channel ?? ("all" as PromotionDto["channel"]),
      propertyIds,
      roomIds: promotion?.roomIds ?? [],
    }

    const failed = (e: Error) => toast.error(e.message)

    if (promotion) {
      update.mutate(
        { id: promotion.id, patch: body },
        {
          onSuccess: () => {
            toast.success(`${body.name} updated.`)
            onClose()
          },
          onError: failed,
        }
      )
    } else {
      create.mutate(
        { ...body, status: "draft" },
        {
          onSuccess: () => {
            toast.success(`${body.name} created as a draft.`, {
              description: "Activate it when you want guests to see it.",
            })
            onClose()
          },
          onError: failed,
        }
      )
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {promotion ? `Edit ${promotion.name}` : `New ${lens.noun}`}
          </DialogTitle>
          <DialogDescription>
            {lens.channel === "mobile"
              ? "Shown only to guests booking from a phone."
              : lens.channel === "genius"
                ? "Shown only to guests whose account carries that tier."
                : "Shown to every guest whose stay matches."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="promo-name">Name</Label>
            <Input
              id="promo-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Spring escape"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="promo-type">Discount</Label>
              <select
                id="promo-type"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={form.discountType}
                onChange={(e) =>
                  set({ discountType: e.target.value as PromotionDto["discountType"] })
                }
              >
                <option value="percent">Percentage</option>
                <option value="amount">Fixed amount</option>
                <option value="free_night">Free nights</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-value">
                {form.discountType === "percent"
                  ? "Percent"
                  : form.discountType === "amount"
                    ? "USD"
                    : "Nights"}
              </Label>
              <Input
                id="promo-value"
                type="number"
                min={1}
                max={form.discountType === "percent" ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) => set({ discountValue: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="promo-start">From</Label>
              <Input
                id="promo-start"
                type="date"
                value={form.startDate}
                onChange={(e) => set({ startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-end">To</Label>
              <Input
                id="promo-end"
                type="date"
                value={form.endDate}
                onChange={(e) => set({ endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="promo-minstay">Minimum stay (optional)</Label>
            <Input
              id="promo-minstay"
              type="number"
              min={1}
              value={form.minStay}
              onChange={(e) => set({ minStay: e.target.value })}
              placeholder="Any length"
            />
          </div>

          <div className="space-y-2">
            <Label>Properties</Label>
            {properties.isPending ? (
              <div className="bg-muted h-8 animate-pulse rounded-md" />
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {all.map((property) => (
                  <label key={property.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={propertyIds.includes(property.id)}
                      onCheckedChange={(v) =>
                        setPicked(
                          v === true
                            ? [...propertyIds, property.id]
                            : propertyIds.filter((id) => id !== property.id)
                        )
                      }
                    />
                    {property.name}
                  </label>
                ))}
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              {/*
               * Empty rooms means every room, which is the useful default and
               * not the same as "no rooms" (rule #21).
               */}
              Applies to every room of the properties you pick.
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : promotion ? "Save" : "Create draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
