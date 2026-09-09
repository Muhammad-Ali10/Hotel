"use client"

import * as React from "react"
import { toast } from "sonner"

import type { NotificationPreferenceRow } from "@/lib/api/endpoints"
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
} from "@/lib/api/hooks"
import { cellPad } from "@/lib/extranet/constants"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Which messages reach this person, and how (rule #105).
 *
 * The switches used to move a `useState` and nothing else — flipped, saved
 * nothing, and came back on at the next page load. Three other things about
 * the old table were wrong in a way worth naming:
 *
 *   - it had an **SMS column**. SMS is not a channel this product has, so
 *     every switch in it was decoration.
 *   - it rendered **every channel for every row**, including ones a given
 *     message never uses — the API refuses those, so half the grid could only
 *     ever fail.
 *   - the list was **the same for everyone**. The API returns the messages
 *     this ACCOUNT can receive; a partner has no business switching a guest's
 *     booking confirmation off.
 *
 * Essential messages are not listed at all. A refund notice is a record of
 * something that happened to somebody's money, not a preference — the API
 * refuses a switch for one rather than accepting it and ignoring it.
 */

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  in_app: "In-app",
}

export function MessagingPreferencesTable() {
  const prefs = useNotificationPreferences()
  const save = useSaveNotificationPreferences()

  /** Only the channels something on this list actually uses. */
  const channels = React.useMemo(() => {
    const seen = new Set<string>()
    for (const item of prefs.data?.items ?? []) {
      for (const c of item.channels) seen.add(c.channel)
    }
    // A stable order, whatever the catalogue happens to list first.
    return ["email", "in_app"].filter((c) => seen.has(c))
  }, [prefs.data])

  if (prefs.isPending) {
    return <div className="bg-muted h-64 animate-pulse rounded-xl" aria-busy="true" />
  }

  if (prefs.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {prefs.error.message}
      </div>
    )
  }

  const items = prefs.data?.items ?? []

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground text-sm">
          Nothing to switch. Every message this account receives is essential — a
          payout notice or a booking record — and those are always sent.
        </CardContent>
      </Card>
    )
  }

  function set(rows: NotificationPreferenceRow[]) {
    save.mutate(rows, { onError: (e) => toast.error(e.message) })
  }

  return (
    <div className="space-y-3">
      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Notification
              </TableHead>
              {channels.map((c) => (
                <TableHead
                  key={c}
                  className="text-muted-foreground w-24 text-center text-xs font-medium tracking-wide uppercase"
                >
                  {CHANNEL_LABEL[c] ?? c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.template} className="[&>td]:py-4">
                <TableCell className="whitespace-normal">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {item.label}
                    {item.klass === "marketing" ? (
                      <Badge variant="secondary">Marketing</Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-xs">{item.description}</p>
                </TableCell>
                {channels.map((channel) => {
                  const row = item.channels.find((c) => c.channel === channel)
                  return (
                    <TableCell key={channel} className="text-center">
                      {/*
                       * An em dash, not an off switch.
                       *
                       * A message that has no such route is not "switched off"
                       * — there is nothing there to switch, and a grey toggle
                       * would invite somebody to turn on delivery that will
                       * never happen.
                       */}
                      {row === undefined ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : (
                        <Switch
                          checked={row.enabled}
                          disabled={save.isPending}
                          aria-label={`${item.label} — ${CHANNEL_LABEL[channel] ?? channel}`}
                          onCheckedChange={(checked) =>
                            set([
                              {
                                template: item.template,
                                channel,
                                enabled: checked === true,
                              } as NotificationPreferenceRow,
                            ])
                          }
                        />
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-muted-foreground text-xs">
        Messages that record something — a payout, a booking, a refund — are not
        listed. Those are sent whatever is set here.
      </p>
    </div>
  )
}
