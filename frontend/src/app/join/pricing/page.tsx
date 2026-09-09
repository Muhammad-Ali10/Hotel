"use client"

import * as React from "react"
import { toast } from "sonner"

import { toCents, toDollars } from "@stayora/shared"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { useWizard } from "../_components/wizard-provider"

/* ============================================================================
 * Step 10 — the starting nightly rate.
 *
 * Three things used to be on this screen and two of them went nowhere:
 *
 *   · A weekend-pricing switch and a markup. There is no day-of-week pricing
 *     anywhere in this system — not in the rate plans, not in the calendar, not
 *     in the quote. A partner who turned it on was told "20% markup · applied
 *     Friday & Saturday" by a control that set a field nothing reads, and every
 *     Friday would have been charged at the ordinary rate.
 *   · Seasonal rates. Named periods with a percentage, held in local state and
 *     never even written to the draft — they were gone on Continue, let alone
 *     at approval.
 *
 * Per-date pricing is real, and it lives in the extranet calendar once the
 * property is live. That is where a Friday rate or an Eid rate is actually set,
 * per date, and it is the same number the quote reads.
 *
 * What remains is the base rate, and it now does something: it seeds the price
 * of each room in the unit sub-flow. Before, it was stored and never read —
 * the property's `basePrice` comes from the cheapest room — so a partner set a
 * rate here, set nothing at step 18, and their listing priced itself at zero.
 * ========================================================================== */

export default function PricingPage() {
  const { data, save } = useWizard()
  const [baseRate, setBaseRate] = React.useState(
    data.baseRate ? String(toDollars(data.baseRate)) : ""
  )

  const dollars = Number(baseRate) || 0

  async function validate() {
    if (dollars <= 0) {
      toast.error("Please enter a base nightly rate")
      return false
    }
    // Cents, like every price in the system. This screen used to store whole
    // dollars into a field the contract types as cents.
    return save({ baseRate: toCents(dollars) })
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Where this number goes">
          It is the starting point for each room you add next — you can change
          any of them individually. Once you are live, the extranet calendar
          lets you price a single date or a whole month differently, which is
          how a busy weekend or a festival week is handled.
        </TipPanel>
      }
    >
      <StepHeading
        title="Set your nightly rate"
        description="What a room at your property typically costs for one night. You'll set each room's own price next."
      />

      <div className="space-y-2">
        <Label htmlFor="baseRate">
          Base nightly rate <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-stretch gap-2">
          <span className="bg-muted text-muted-foreground flex items-center rounded-lg border px-3 text-sm font-medium">
            USD $
          </span>
          <Input
            id="baseRate"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="e.g. 550"
            value={baseRate}
            onChange={(e) => setBaseRate(e.target.value)}
            className="flex-1"
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {/* It said "All prices in PKR" above a field prefixed with a dollar
              sign. Every other surface in this product prices in USD. */}
          The whole platform prices in US dollars — guests see this rate in
          their own currency at checkout.
        </p>
      </div>

      <StepNav slug="pricing" onContinue={validate} />
    </WizardShell>
  )
}
