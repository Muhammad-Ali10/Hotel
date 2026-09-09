"use client"

import * as React from "react"
import { toast } from "sonner"

import { cancellationPresets, type CancellationPreset } from "@stayora/shared"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { SelectCard } from "../_components/select-card"
import { useWizard } from "../_components/wizard-provider"

/*
 * The four presets, described by the platform rather than by this file.
 *
 * The descriptions written here were wrong, and wrong in the partner's favour
 * in a way they would only discover from a refund:
 *
 *   · "Moderate — free cancellation up to 5 days before". It is 48 HOURS.
 *   · "Strict — 50% refund up to 1 week before". There is no 50% anywhere in
 *     this system; strict charges the FULL stay after the window closes.
 *   · "Flexible — free cancellation up to 24h". True, but silent about what
 *     happens after: the first night is charged.
 *
 * `cancellationPresets()` returns the label and the blurb beside the structured
 * policy a rate plan actually stores (rule #102), so the sentence on this card
 * and the refund a guest is quoted are computed from the same shape.
 */
const policies = cancellationPresets()

const rules = [
  "No smoking indoors",
  "Pets allowed",
  "No parties or events",
  "Quiet hours 10pm – 7am",
  "Age restriction (18+)",
  "No shoes indoors",
  "Self check-in available",
  "No unregistered visitors",
]

export default function PoliciesPage() {
  const { data, save } = useWizard()
  const [checkIn, setCheckIn] = React.useState(data.checkInFrom)
  const [checkOut, setCheckOut] = React.useState(data.checkOutBy)
  const [policy, setPolicy] = React.useState<CancellationPreset | null>(
    data.cancellationPolicy
  )
  const [houseRules, setHouseRules] = React.useState<string[]>(data.houseRules)

  const toggleRule = (r: string) =>
    setHouseRules((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]))

  async function validate() {
    if (!policy) {
      toast.error("Please choose a cancellation policy")
      return false
    }
    return save({
      checkInFrom: checkIn,
      checkOutBy: checkOut,
      cancellationPolicy: policy,
      houseRules,
    })
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Why policies matter">
          Clear policies reduce friction and prevent guest disputes. A flexible
          cancellation policy can increase bookings by up to 20%. Set house rules
          that match your property style — being upfront about expectations leads
          to better reviews and fewer issues.
        </TipPanel>
      }
    >
      <StepHeading
        title="Property policies"
        description="Set your check-in times, cancellation terms, and house rules for guests."
      />

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold">Check-in &amp; checkout times</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="checkin">Check-in from</Label>
              <Input
                id="checkin"
                type="time"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout">Check-out by</Label>
              <Input
                id="checkout"
                type="time"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold">
            Cancellation policy <span className="text-destructive">*</span>
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {policies.map((p) => (
              <SelectCard
                key={p.key}
                selected={policy === p.key}
                onSelect={() => setPolicy(p.key)}
              >
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-muted-foreground text-xs">{p.blurb}</p>
              </SelectCard>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold">House rules</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {rules.map((r) => {
              const on = houseRules.includes(r)
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRule(r)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted/60",
                  )}
                >
                  {r}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <StepNav slug="policies" onContinue={validate} />
    </WizardShell>
  )
}
