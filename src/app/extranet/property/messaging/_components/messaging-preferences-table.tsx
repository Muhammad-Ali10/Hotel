"use client"

import * as React from "react"

import type { MessagingChannel, MessagingPreference } from "@/lib/extranet/types"
import { messagingChannels } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type PrefState = Record<string, Record<MessagingChannel, boolean>>

export function MessagingPreferencesTable({
  preferences,
}: {
  preferences: MessagingPreference[]
}) {
  const [state, setState] = React.useState<PrefState>(() =>
    Object.fromEntries(preferences.map((p) => [p.id, { ...p.channels }]))
  )

  function toggle(id: string, channel: MessagingChannel, checked: boolean) {
    setState((prev) => ({
      ...prev,
      [id]: { ...prev[id], [channel]: checked },
    }))
  }

  return (
    <Card className="py-0">
      <Table className={cellPad}>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Notification
            </TableHead>
            {messagingChannels.map((c) => (
              <TableHead
                key={c.id}
                className="text-muted-foreground w-24 text-center text-xs font-medium tracking-wide uppercase"
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {preferences.map((p) => (
            <TableRow key={p.id} className="[&>td]:py-4">
              <TableCell className="whitespace-normal">
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-muted-foreground text-xs">{p.description}</p>
              </TableCell>
              {messagingChannels.map((c) => (
                <TableCell key={c.id} className="text-center">
                  <Switch
                    checked={state[p.id][c.id]}
                    onCheckedChange={(checked) => toggle(p.id, c.id, checked)}
                    aria-label={`${p.label} — ${c.label}`}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
