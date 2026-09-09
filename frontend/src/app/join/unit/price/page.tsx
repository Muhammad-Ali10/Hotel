"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { toast } from "sonner"

import { toCents, toDollars } from "@stayora/shared"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

import { WizardShell, StepHeading } from "../../_components/wizard-shell"
import { TipPanel } from "../../_components/tip-panel"
import { StepNav } from "../../_components/step-nav"

import { useWizard } from "../../_components/wizard-provider"
import { money } from "../../_lib/labels"

/**
 * USD nightly rates, sized against the live catalogue (base rates run
 * $320–$1,504). These were rupee figures — 3,500–30,000 — which, once the flow
 * started formatting in USD, would have offered a luxury property a $3,500
 * floor.
 *
 * The commission is no longer a constant. It comes from the applicant's own
 * registration draft, which reads it from the platform's settings — so the
 * figure quoted here is the one their first invoice will use. A number written
 * into this page drifts the first time the platform changes its default rate,
 * and the person who finds out is the partner reading that invoice.
 */
const MIN = 120
const MAX = 3000
const MEDIAN = 550

/** The slider and the field work in whole dollars; the draft stores cents. */
const STEP = 10

/**
 * What the commission actually pays for.
 *
 * Three claims used to sit here and two of them were not true: "24/7 guest
 * support" is a staffing commitment nothing backs, and "listed on partner
 * sites" describes channel distribution this product does not have — there is
 * no channel-manager connection at all.
 */
const perks = [
  "Card payments handled end to end — you never hold card details",
  "Your listing on the marketplace, and in search",
  "Support for you and for your guests, through the platform",
]

export default function RoomPricePage() {
  const { data, view, save } = useWizard()

  /*
   * Seeded from the property's base rate when this room has no price yet.
   *
   * Step 10 asks what a night typically costs and, until now, that answer was
   * stored and never read again — every room started at the same hardcoded
   * median regardless of what the partner had just said. The fallback below it
   * is only for a draft that skipped step 10 entirely.
   */
  const [price, setPrice] = React.useState(
    toDollars(data.draftUnit.price || data.baseRate) || MEDIAN
  )

  /*
   * Basis points, so a negotiated 12.5% is exactly `1250`.
   *
   * Until the draft loads there is no rate to quote, and quoting a guessed one
   * is worse than showing nothing — so the breakdown says it is loading rather
   * than doing arithmetic with a placeholder.
   */
  const rateBps = view?.commissionRateBps ?? null
  const cents = toCents(price)
  const commission = rateBps === null ? null : Math.round((cents * rateBps) / 10_000)
  const earnings = commission === null ? null : cents - commission

  async function validate() {
    if (price <= 0) {
      toast.error("Please set a nightly price")
      return false
    }
    // Cents. This screen stored whole dollars into a field the contract types
    // as cents, so a $550 room reached the database as $5.50.
    return save({ draftUnit: { ...data.draftUnit, price: cents } })
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
            step={STEP}
            onValueChange={(v) => setPrice(Array.isArray(v) ? v[0] : (v as number))}
          />
          <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
            <span>Low · {money(toCents(MIN))}</span>
            <span>High · {money(toCents(MAX))}</span>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          Median: <span className="text-foreground font-medium">{money(toCents(MEDIAN))}</span>{" "}
          — Yours: <span className="text-foreground font-medium">{money(cents)}</span>
        </p>
      </div>

      <div className="mt-6 space-y-2">
        <Label htmlFor="price">
          How much do you want to charge per night?{" "}
          <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-stretch gap-2">
          {/* "Rs" over a USD platform — the last of the rupee flow. */}
          <span className="bg-muted text-muted-foreground flex items-center rounded-lg border px-3 text-sm font-medium">
            USD $
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
          {/* Nothing is added on top of a rate (rule #11), so "including taxes
              and fees" described a breakdown that does not exist. */}
          What a guest pays for one night in this room.
        </p>
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <p className="mb-1 text-sm font-semibold">Earnings breakdown</p>
        <div className="divide-y text-sm">
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Price guests pay</span>
            <span className="font-medium">{money(cents)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">
              {/* The real rate, not a number typed into this page. */}
              Platform commission
              {rateBps === null ? "" : ` (${(rateBps / 100).toFixed(2)}%)`}
            </span>
            <span className="font-medium">
              {commission === null ? "—" : `−${money(commission)}`}
            </span>
          </div>
          <div className="flex justify-between py-2">
            {/* Nothing is added on top of a rate (rule #11), so there is no
                tax line to be "including" — the guest pays exactly this. */}
            <span className="font-medium">You keep</span>
            <span className="font-semibold">
              {earnings === null ? "—" : money(earnings)}
            </span>
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
