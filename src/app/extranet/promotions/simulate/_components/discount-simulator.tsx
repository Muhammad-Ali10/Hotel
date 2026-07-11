"use client"

import * as React from "react"

import { SectionCard } from "@/components/extranet/shared"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const roomTypes = [
  "Deluxe Ocean Suite",
  "Penthouse Suite",
  "Premium King",
  "Family Suite",
  "Standard Room",
  "Accessible Room",
]

const num = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : v)
const fmt = (n: number) => `$${n.toFixed(2)}`

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string
  value: string
  tone?: "muted" | "danger"
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span
        className={[
          strong ? "font-heading text-lg font-semibold" : "text-sm font-medium",
          tone === "danger" ? "text-destructive" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  )
}

export function DiscountSimulator() {
  const [roomType, setRoomType] = React.useState(roomTypes[0])
  const [baseRate, setBaseRate] = React.useState(200)
  const [discount, setDiscount] = React.useState(0)
  const [commission, setCommission] = React.useState(15)

  const afterDiscount = baseRate * (1 - discount / 100)
  const commissionAmt = afterDiscount * (commission / 100)
  const net = afterDiscount - commissionAmt
  const margin = baseRate > 0 ? (net / baseRate) * 100 : 0

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Scenario Settings">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Room Type</Label>
            <Select
              value={roomType}
              onValueChange={(v) => setRoomType(String(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roomTypes.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="base-rate">Base Rate (per night)</Label>
            <Input
              id="base-rate"
              type="number"
              value={baseRate}
              min={0}
              onChange={(e) => setBaseRate(Number(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Discount</Label>
              <span className="text-sm font-medium">{discount}%</span>
            </div>
            <Slider
              value={discount}
              onValueChange={(v) => setDiscount(num(v))}
              min={0}
              max={50}
              step={5}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Commission</Label>
              <span className="text-sm font-medium">{commission}%</span>
            </div>
            <Slider
              value={commission}
              onValueChange={(v) => setCommission(num(v))}
              min={10}
              max={25}
              step={1}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Revenue Breakdown" description={roomType}>
        <div className="divide-y">
          <Row label="Base Rate" value={fmt(baseRate)} />
          <Row label={`After ${discount}% Discount`} value={fmt(afterDiscount)} />
          <Row
            label={`Commission (${commission}%)`}
            value={`−${fmt(commissionAmt)}`}
            tone="danger"
          />
          <Row label="Net Revenue" value={fmt(net)} strong />
        </div>
        <div className="bg-muted/50 mt-4 flex items-center justify-between rounded-lg p-3">
          <span className="text-sm font-medium">Effective Margin</span>
          <span className="font-heading text-xl font-semibold">
            {margin.toFixed(1)}%
          </span>
        </div>
      </SectionCard>
    </div>
  )
}
