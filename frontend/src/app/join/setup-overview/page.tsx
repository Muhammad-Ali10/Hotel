"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { StepNav } from "../_components/step-nav"
import { HubStep } from "../_components/hub-step"
import { UnitRow } from "../_components/unit-row"
import { useWizard } from "../_components/wizard-provider"
import { href } from "../_lib/steps"
import { propertyTypeLabels } from "../_lib/labels"

function EditLink({ path }: { path: string }) {
  return <Button variant="outline" size="sm" render={<Link href={href(path)}>Edit</Link>} />
}

export default function SetupOverviewPage() {
  const { data, photos, view } = useWizard()
  const unitCount = data.units.length
  const typeLabel = data.propertyType ? propertyTypeLabels[data.propertyType] : "property"

  /*
   * Ticks that mean something.
   *
   * All four were hardcoded `done`, under a heading that read "All steps are
   * complete" whatever the draft actually held — so a partner with no rooms
   * and no photographs was shown four green ticks and sent to the last screen,
   * where submit refused them.
   *
   * `gaps` is the server's own list, so this screen and the refusal cannot
   * disagree.
   */
  const gaps = view?.gaps ?? []
  const detailsDone = !gaps.some((gap) =>
    ["Name the property", "Choose what kind of place it is", "Give the full address"].includes(
      gap
    )
  )
  const unitsDone = unitCount > 0 && !gaps.some((gap) => gap.startsWith("Set a nightly price"))
  const photosDone = photos.length > 0
  const finalDone = Boolean(data.paymentMethod) && Boolean(data.cancellationPolicy)
  const everythingDone = detailsDone && unitsDone && photosDone && finalDone

  return (
    <WizardShell>
      <StepHeading
        title="Setup overview"
        description={
          everythingDone
            ? "Everything is filled in. Have a last look, then send your application."
            : "Nearly there — the steps below without a tick still need something."
        }
      />

      <div className="space-y-3">
        <HubStep
          index={1}
          done={detailsDone}
          title="Property details"
          description={`${data.propertyName || "Your property"} — ${typeLabel}, ${data.city || "your city"}`}
          action={<EditLink path="property-type" />}
        />

        <HubStep
          index={2}
          done={unitsDone}
          title="Rooms"
          description={
            unitCount === 0
              ? "No rooms yet — at least one is needed"
              : `${unitCount} room${unitCount === 1 ? "" : "s"} added`
          }
          action={<EditLink path="unit/details" />}
        >
          <div className="mt-3 space-y-2">
            {data.units.map((unit, i) => (
              <UnitRow key={i} unit={unit} />
            ))}
          </div>
        </HubStep>

        <HubStep
          index={3}
          done={photosDone}
          title="Photos"
          description={
            photos.length === 0
              ? "No photos yet — at least one is needed"
              : `${photos.length} photo${photos.length === 1 ? "" : "s"} uploaded`
          }
          action={<EditLink path="photos" />}
        />

        <HubStep
          index={4}
          done={finalDone}
          title="Final steps"
          description={
            finalDone
              ? "How guests pay, invoicing, and your cancellation policy"
              : "Still to choose: how guests pay, and your cancellation policy"
          }
          action={<EditLink path="payments" />}
        />
      </div>

      <StepNav slug="setup-overview" nextLabel="Complete registration" />
    </WizardShell>
  )
}
