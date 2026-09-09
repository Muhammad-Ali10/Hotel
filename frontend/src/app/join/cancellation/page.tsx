"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { cancellationPresets, type CancellationPreset } from "@stayora/shared"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { SelectCard } from "../_components/select-card"
import { useWizard } from "../_components/wizard-provider"
import { href, nextStep, prevStep } from "../_lib/steps"

/* ============================================================================
 * Step 23 — confirming the cancellation policy.
 *
 * This screen used to ask the same question as step 11 in a second vocabulary:
 * a "free until" dropdown of five windows and a "charge" choice of two, stored
 * as `cancelFreeUntil` and `cancelCharge`. Neither field existed anywhere else
 * — not in the contract, not at approval, not on a rate plan — so a partner
 * could set "free until 14 days, charge the full stay" here and have the
 * preset they chose twelve screens earlier applied instead.
 *
 * Worse, the two could not agree. "Free until 6pm on the day of arrival" is not
 * one of the four presets, so picking it silently meant nothing at all.
 *
 * It is one field now, shown twice: chosen at step 11, confirmed here, with
 * what each preset MEANS spelled out from `cancellationPresets()` rather than
 * from a sentence typed into a page.
 *
 * The "protection against accidental bookings" switch is gone with them. It
 * defaulted to on, was never stored, and promised a 24-hour grace period no
 * refund calculation in this system has ever applied.
 * ========================================================================== */

const presets = cancellationPresets()

export default function CancellationPage() {
  const router = useRouter()
  const { data, save, saving } = useWizard()
  const [policy, setPolicy] = React.useState<CancellationPreset | null>(
    data.cancellationPolicy
  )

  async function commit() {
    if (!policy) {
      toast.error("Choose a cancellation policy")
      return
    }
    if (!(await save({ cancellationPolicy: policy }))) return

    const next = nextStep("cancellation")
    if (next) router.push(href(next.path))
  }

  function back() {
    const prev = prevStep("cancellation")
    if (prev) router.push(href(prev.path))
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Balancing bookings and protection">
          A shorter free window fills more rooms and cancels more of them; a
          longer one protects the nights you have sold. Most properties start
          moderate and tighten it once they can see how often they are cancelled
          on. You can change this per rate plan in the extranet at any time.
        </TipPanel>
      }
    >
      <StepHeading
        title="Cancellation policy"
        description="What you chose earlier, and exactly what it means for a guest. Change it here if you want to."
      />

      <div className="space-y-2">
        <Label>
          When can guests cancel for free, and what do they pay after that?{" "}
          <span className="text-destructive">*</span>
        </Label>
        <div className="space-y-2">
          {presets.map((preset) => (
            <SelectCard
              key={preset.key}
              selected={policy === preset.key}
              onSelect={() => setPolicy(preset.key)}
            >
              <p className="text-sm font-medium">{preset.label}</p>
              <p className="text-muted-foreground text-xs">{preset.blurb}</p>
            </SelectCard>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground mt-4 text-sm">
        This becomes the policy on your rooms&apos; standard rate plan. A
        non-refundable plan, if you added one, keeps its own terms.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Button variant="outline" type="button" onClick={back} disabled={saving}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="button" onClick={commit} disabled={saving} className="flex-1">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save and continue
        </Button>
      </div>
    </WizardShell>
  )
}
