"use client"

import * as React from "react"
import { toast } from "sonner"

import { REGISTRATION_MINIMUM } from "@stayora/shared"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { useWizard } from "../_components/wizard-provider"

/* ============================================================================
 * Step 7 — the property description.
 *
 * This screen used to collect "room types": a name, a bed type, a guest count
 * and a quantity, repeated. Three problems with that, all fatal:
 *
 *   · The wizard already builds rooms, properly, at steps 14–19 — with beds by
 *     size, bathrooms, amenities, a price and a rate plan. This was a second,
 *     thinner room concept for the same thing.
 *   · Nothing ever read it. `roomTypes` was written here and consumed by no
 *     screen, no endpoint and no table. Approval builds rooms from `units`.
 *   · So a partner who filled it in and stopped had described their property's
 *     rooms and would still be told, at submit, to "add at least one room".
 *
 * What was missing instead is the description — required to submit, and asked
 * for nowhere in thirty-one screens. Every application would have reached the
 * end and been refused for a field the flow never showed. It is also the text
 * guests read on the listing, which is why the minimum exists.
 * ========================================================================== */

const MINIMUM = REGISTRATION_MINIMUM.descriptionChars

const prompts = [
  "What a guest sees when they arrive, and what the place feels like",
  "What is nearby — the beach, the old town, the station",
  "What you are known for: the breakfast, the view, the quiet",
]

export default function PropertyDescriptionPage() {
  const { data, save } = useWizard()
  const [description, setDescription] = React.useState(data.description)

  const length = description.trim().length
  const short = length < MINIMUM

  async function validate() {
    if (short) {
      toast.error(`Write at least ${MINIMUM} characters`, {
        description: `${MINIMUM - length} to go — this is what guests read before they book.`,
      })
      return false
    }
    return save({ description: description.trim() })
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="What to write">
          Guests skim. The first two lines decide whether they read the rest, so
          put what makes the place worth choosing there — not the address, which
          they have already seen. Write it as you would describe it to a friend
          who is coming to stay.
        </TipPanel>
      }
    >
      <StepHeading
        title="Describe your property"
        description="This is the text guests read on your listing, above the photos and the rooms."
      />

      <div className="space-y-2">
        <Label htmlFor="description">
          About your property <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          rows={9}
          placeholder="A restored townhouse a few minutes from the harbour, with eleven rooms around a courtyard…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className={short ? "text-muted-foreground text-xs" : "text-xs text-green-600 dark:text-green-400"}>
          {short
            ? `${length} of ${MINIMUM} characters minimum`
            : `${length} characters — that's enough to publish`}
        </p>
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <p className="text-sm font-medium">Worth mentioning</p>
        <ul className="text-muted-foreground mt-2 space-y-1.5 text-sm">
          {prompts.map((prompt) => (
            <li key={prompt} className="flex gap-2">
              <span aria-hidden>·</span>
              {prompt}
            </li>
          ))}
        </ul>
      </div>

      <StepNav slug="description" onContinue={validate} />
    </WizardShell>
  )
}
