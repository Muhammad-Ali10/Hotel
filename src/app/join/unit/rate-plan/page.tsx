"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import { WizardShell, StepHeading } from "../../_components/wizard-shell"
import { TipPanel } from "../../_components/tip-panel"
import { useWizard } from "../../_components/wizard-provider"
import { href, nextStep, prevStep } from "../../_lib/steps"
import { newUnit } from "../../_lib/types"
import { pkr } from "../../_lib/labels"

export default function RatePlanPage() {
  const router = useRouter()
  const { data, update } = useWizard()
  const [enabled, setEnabled] = React.useState(data.draftUnit.ratePlan.enabled)
  const [discount, setDiscount] = React.useState(data.draftUnit.ratePlan.discount)

  const base = data.draftUnit.price || 14000
  const off = Math.round((base * discount) / 100)
  const nonRefundable = base - off

  function save() {
    const committed = {
      ...data.draftUnit,
      ratePlan: { enabled, discount },
    }
    update({ units: [...data.units, committed], draftUnit: newUnit() })
    toast.success("Unit added")
    const next = nextStep("unit-rate-plan")
    if (next) router.push(href(next.path))
  }

  function cancel() {
    const prev = prevStep("unit-rate-plan")
    if (prev) router.push(href(prev.path))
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Why offer a non-refundable rate?">
          Non-refundable rate plans reduce cancellations by up to 60% and attract
          budget-conscious travelers. Properties offering non-refundable options
          see 28% higher occupancy on average. The discount you offer is offset
          by guaranteed revenue — you keep the money even if the guest doesn&apos;t
          show up.
        </TipPanel>
      }
    >
      <StepHeading
        title="Set up a non-refundable rate plan"
        description="Offer a discounted non-refundable option to attract price-sensitive guests and secure guaranteed bookings."
      />

      <div className="rounded-xl border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Set up a non-refundable rate plan</p>
            <p className="text-muted-foreground text-xs">
              Guests pay less but can&apos;t cancel for a refund
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {enabled && (
        <>
          <div className="mt-6 space-y-2">
            <Label htmlFor="discount">
              Discount for guests that book with this rate plan
            </Label>
            <div className="flex items-stretch gap-2">
              <Input
                id="discount"
                type="number"
                min={0}
                max={100}
                value={discount}
                onChange={(e) =>
                  setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                }
                className="w-24"
              />
              <span className="bg-muted text-muted-foreground flex items-center rounded-lg border px-3 text-sm">
                %
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-xl border p-4">
            <p className="mb-1 text-sm font-semibold">Rate breakdown</p>
            <div className="divide-y text-sm">
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Base price</span>
                <span className="font-medium">{pkr(base)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Discount ({discount}%)</span>
                <span className="font-medium">−{pkr(off)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-medium">Non-refundable price</span>
                <span className="font-semibold">{pkr(nonRefundable)}</span>
              </div>
            </div>
            {discount >= 10 && (
              <p className="mt-2 text-xs font-medium text-green-600 dark:text-green-400">
                Great discount!
              </p>
            )}
          </div>
        </>
      )}

      <div className="mt-8 flex items-center gap-3">
        <Button variant="outline" type="button" onClick={cancel}>
          <ArrowLeft className="size-4" />
          Cancel
        </Button>
        <Button type="button" onClick={save} className="flex-1">
          Save
        </Button>
      </div>
    </WizardShell>
  )
}
