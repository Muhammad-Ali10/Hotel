"use client"

import * as React from "react"
import { CopyPlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const roomTypes = [
  "Deluxe Ocean Suite",
  "Penthouse Suite",
  "Premium King",
  "Family Suite",
  "Standard Room",
  "Accessible Room",
]

function DateRangeCard({
  title,
  from,
  to,
  onFrom,
  onTo,
}: {
  title: string
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => onFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input
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

export function CopyRatesForm() {
  const [sourceFrom, setSourceFrom] = React.useState("2026-06-01")
  const [sourceTo, setSourceTo] = React.useState("2026-07-02")
  const [targetFrom, setTargetFrom] = React.useState("2026-06-02")
  const [targetTo, setTargetTo] = React.useState("2026-07-02")
  const [selected, setSelected] = React.useState<string[]>([...roomTypes])

  function toggle(room: string) {
    setSelected((prev) =>
      prev.includes(room) ? prev.filter((r) => r !== room) : [...prev, room]
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <DateRangeCard
          title="Source Date Range"
          from={sourceFrom}
          to={sourceTo}
          onFrom={setSourceFrom}
          onTo={setSourceTo}
        />
        <DateRangeCard
          title="Target Date Range"
          from={targetFrom}
          to={targetTo}
          onFrom={setTargetFrom}
          onTo={setTargetTo}
        />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="font-heading text-sm font-semibold">
            Select Room Types
          </h3>
          <div className="flex flex-wrap gap-2">
            {roomTypes.map((room) => {
              const active = selected.includes(room)
              return (
                <button
                  key={room}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(room)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {room}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Button
        disabled={selected.length === 0}
        onClick={() =>
          toast.success(
            `Rates copied to ${targetFrom} – ${targetTo}`,
            { description: `${selected.length} room type(s)` }
          )
        }
      >
        <CopyPlus className="size-4" />
        Copy Rates
      </Button>
    </div>
  )
}
