"use client"

import * as React from "react"

import type { ToggleSetting } from "@/lib/extranet/types"
import { Switch } from "@/components/ui/switch"

export function SettingsToggles({ settings }: { settings: ToggleSetting[] }) {
  const [state, setState] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(settings.map((s) => [s.id, s.enabled]))
  )

  return (
    <ul className="divide-y">
      {settings.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{s.label}</p>
            <p className="text-muted-foreground text-xs">{s.description}</p>
          </div>
          <Switch
            checked={state[s.id]}
            onCheckedChange={(checked) =>
              setState((prev) => ({ ...prev, [s.id]: checked }))
            }
          />
        </li>
      ))}
    </ul>
  )
}
