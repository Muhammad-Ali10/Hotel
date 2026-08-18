"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

import { WizardShell, StepHeading } from "../../_components/wizard-shell"
import { TipPanel } from "../../_components/tip-panel"
import { StepNav } from "../../_components/step-nav"
import { PARTNER_ORG } from "@/data/config"

import { useWizard } from "../../_components/wizard-provider"
import { money } from "../../_lib/labels"

/**
 * USD nightly rates, sized against the live catalogue (base rates run
 * $383–$1,500). These were rupee figures — 3,500–30,000 — which, once the flow
 * started formatting in USD, would have offered a luxury property a $3,500
 * floor. The commission is the platform rate the extranet and admin quote.
 */
const MIN = 120
const MAX = 3000
const MEDIAN = 550
const COMMISSION = PARTNER_ORG.commissionRate / 100

const perks = [
  "24/7 guest support included",
  "Fraud protection and secure payments",
  "Listed on the platform and partner sites",
]

export default function RoomPricePage() {
  const { data, update } = useWizard()
  const [price, setPrice] = React.useState(data.draftUnit.price || MEDIAN)

  const commission = Math.round(price * COMMISSION)
  const earnings = price - commission

  function validate() {
    if (price <= 0) {
      toast.error("Please set a nightly price")
      return false
    }
    update({ draftUnit: { ...data.draftUnit, price } })
    return true
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Pricing guidance">
          Start near the median for your area — you can always adjust later.
          Properties priced within 15% of the median get 3x more clicks.
          Commission covers guest support, payment processing, and marketing.
          Higher prices reduce bookings but increase per-stay revenue.
        </TipPanel>
      }
    >
      <StepHeading
        title="Set the price per night for this room"
        description="Price competitively to attract bookings while maximizing your earnings."
      />

      <div className="rounded-xl border p-4">
        <p className="text-sm font-medium">Make your price competitive</p>
        <div className="mt-4">
          <Slider
            value={[price]}
            min={MIN}
            max={MAX}
            step={100}
            onValueChange={(v) => setPrice(Array.isArray(v) ? v[0] : (v as number))}
          />
          <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
            <span>Low · {money(MIN)}</span>
            <span>High · {money(MAX)}</span>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          Median: <span className="text-foreground font-medium">{money(MEDIAN)}</span> — Yours:{" "}
          <span className="text-foreground font-medium">{money(price)}</span>
        </p>
      </div>

      <div className="mt-6 space-y-2">
        <Label htmlFor="price">
          How much do you want to charge per night?{" "}
          <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-stretch gap-2">
          <span className="bg-muted text-muted-foreground flex items-center rounded-lg border px-3 text-sm font-medium">
            Rs
          </span>
          <Input
            id="price"
            type="number"
            value={price}
            onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
            className="flex-1"
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Price guests pay — including taxes, commission, and fees
        </p>
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <p className="mb-1 text-sm font-semibold">Earnings breakdown</p>
        <div className="divide-y text-sm">
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Price guests pay</span>
            <span className="font-medium">{money(price)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Platform commission (12%)</span>
            <span className="font-medium">−{money(commission)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-medium">Your earnings (including taxes)</span>
            <span className="font-semibold">{money(earnings)}</span>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {perks.map((perk) => (
          <li key={perk} className="text-muted-foreground flex items-center gap-2 text-sm">
            <Check className="size-4 shrink-0 text-green-600 dark:text-green-400" />
            {perk}
          </li>
        ))}
      </ul>

      <StepNav slug="unit-price" onContinue={validate} />
    </WizardShell>
  )
}
