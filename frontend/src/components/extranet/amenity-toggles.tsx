"use client"

import * as React from "react"
import { toast } from "sonner"

import type { Stat } from "@/lib/extranet/types"
import { useAmenities, useListing, useUpdateListing } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { Icon, StatGrid } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { NotFoundCard } from "@/components/shared/not-found-card"

/**
 * The property's amenities, from the platform's own vocabulary (rule #74).
 *
 * The list of what CAN be ticked is the platform's — a partner cannot invent
 * "Bathrobe", because a free-text amenity is how "WiFi" and "Free Wi-Fi"
 * become two filters that each miss half the catalogue. Both screens that used
 * this had an "Add Amenity" button; it is gone.
 *
 * **The save sends the whole set, always.** These two screens each show a SLICE
 * of the amenities (room-facing ones here, everything else there) and the API
 * replaces the entire list. Sending only what this screen knows about would
 * clear the other screen's answers every time somebody flipped one switch.
 */
export function AmenityToggles({
  scope,
  noun,
}: {
  /** `room` for in-room amenities, `facilities` for everything else. */
  scope: "room" | "facilities"
  noun: string
}) {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const listing = useListing(active?.id ?? "")
  const vocabulary = useAmenities()
  const update = useUpdateListing(active?.id ?? "")

  const selected = React.useMemo(
    () => new Set(listing.data?.amenities ?? []),
    [listing.data?.amenities]
  )

  if (loadingProperties || listing.isPending || vocabulary.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="bg-muted h-64 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (!active || !listing.data) {
    return (
      <NotFoundCard
        title="No active property"
        description={`Choose a property to manage its ${noun}.`}
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const all = vocabulary.data ?? []
  const mine = all.filter((a) =>
    scope === "room" ? a.category === "room" : a.category !== "room"
  )

  const groups = Object.values(
    mine.reduce<Record<string, { category: string; icon: string; items: typeof mine }>>(
      (acc, amenity) => {
        acc[amenity.category] ??= {
          category: amenity.category,
          icon: amenity.icon,
          items: [],
        }
        acc[amenity.category].items.push(amenity)
        return acc
      },
      {}
    )
  )

  /** Applies a change to the FULL set, then sends all of it. */
  function save(changes: { slug: string; enabled: boolean }[]) {
    const next = new Set(selected)
    for (const change of changes) {
      if (change.enabled) next.add(change.slug)
      else next.delete(change.slug)
    }

    update.mutate(
      { amenities: [...next] },
      { onError: (e) => toast.error(e.message) }
    )
  }

  const enabledHere = mine.filter((a) => selected.has(a.slug)).length
  const label = noun.charAt(0).toUpperCase() + noun.slice(1)

  const stats: Stat[] = [
    { label: `Total ${label}`, value: String(mine.length) },
    { label: "Enabled", value: String(enabledHere) },
    { label: "Categories", value: String(groups.length) },
  ]

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} className="lg:grid-cols-3" />

      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((group) => {
          const on = group.items.filter((a) => selected.has(a.slug)).length
          return (
            <Card key={group.category}>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
                      <Icon name={group.icon} className="size-4" />
                    </span>
                    <h3 className="font-heading text-sm font-semibold capitalize">
                      {group.category}
                    </h3>
                    <Badge variant="secondary">
                      {on}/{group.items.length}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={update.isPending}
                      onClick={() =>
                        save(group.items.map((a) => ({ slug: a.slug, enabled: true })))
                      }
                    >
                      All Yes
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={update.isPending}
                      onClick={() =>
                        save(group.items.map((a) => ({ slug: a.slug, enabled: false })))
                      }
                    >
                      All No
                    </Button>
                  </div>
                </div>
                <ul className="divide-y">
                  {group.items.map((amenity) => (
                    <li
                      key={amenity.slug}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <span className="text-sm">{amenity.label}</span>
                      <Switch
                        checked={selected.has(amenity.slug)}
                        disabled={update.isPending}
                        aria-label={amenity.label}
                        onCheckedChange={(v) =>
                          save([{ slug: amenity.slug, enabled: v === true }])
                        }
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
