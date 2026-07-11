"use client"

import * as React from "react"

import type { AmenityGroup, Stat } from "@/lib/extranet/types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { StatGrid } from "./stat-card"
import { Icon } from "./icon"

/**
 * Generic collapsible toggle-list manager used by Amenities and Facilities:
 * a summary row + one card per category with per-item switches and
 * "All Yes / All No" controls. Live counts.
 */
export function ToggleGroupsManager({
  groups: initial,
  noun,
}: {
  groups: AmenityGroup[]
  noun: string
}) {
  const [groups, setGroups] = React.useState(() =>
    initial.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) }))
  )

  const setGroupAll = (category: string, value: boolean) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.category === category
          ? { ...g, items: g.items.map((it) => ({ ...it, enabled: value })) }
          : g
      )
    )

  const toggleItem = (category: string, name: string, value: boolean) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.category === category
          ? {
              ...g,
              items: g.items.map((it) =>
                it.name === name ? { ...it, enabled: value } : it
              ),
            }
          : g
      )
    )

  const allItems = groups.flatMap((g) => g.items)
  const enabledCount = allItems.filter((i) => i.enabled).length
  const label = noun.charAt(0).toUpperCase() + noun.slice(1)

  const stats: Stat[] = [
    { label: `Total ${label}`, value: String(allItems.length) },
    { label: "Enabled", value: String(enabledCount) },
    { label: "Categories", value: String(groups.length) },
  ]

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} className="lg:grid-cols-3" />

      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => {
          const on = g.items.filter((i) => i.enabled).length
          return (
            <Card key={g.category}>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
                      <Icon name={g.icon} className="size-4" />
                    </span>
                    <h3 className="font-heading text-sm font-semibold">
                      {g.category}
                    </h3>
                    <Badge variant="secondary">
                      {on}/{g.items.length}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setGroupAll(g.category, true)}
                    >
                      All Yes
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setGroupAll(g.category, false)}
                    >
                      All No
                    </Button>
                  </div>
                </div>
                <ul className="divide-y">
                  {g.items.map((it) => (
                    <li
                      key={it.name}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <span className="text-sm">{it.name}</span>
                      <Switch
                        checked={it.enabled}
                        onCheckedChange={(v) =>
                          toggleItem(g.category, it.name, v)
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
