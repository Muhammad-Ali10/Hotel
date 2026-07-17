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
  const { data } = useWizard()
  const unitCount = data.units.length
  const typeLabel = data.propertyType ? propertyTypeLabels[data.propertyType] : "property"

  return (
    <WizardShell>
      <StepHeading
        title="Setup overview"
        description="All steps are complete. Review your setup or proceed to finalize your registration."
      />

      <div className="space-y-3">
        <HubStep
          index={1}
          done
          title="Property details"
          description={`${data.propertyName || "Your property"} — ${typeLabel}, ${data.city || "your city"}`}
          action={<EditLink path="property-type" />}
        />

        <HubStep
          index={2}
          done
          title="Units"
          description={`${unitCount} unit${unitCount === 1 ? "" : "s"} added`}
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
          done
          title="Photos"
          description={`${data.photos} photo${data.photos === 1 ? "" : "s"} uploaded`}
          action={<EditLink path="photos" />}
        />

        <HubStep
          index={4}
          done
          title="Final steps"
          description="Payments, invoicing & cancellation policies set up"
          action={<EditLink path="payments" />}
        />
      </div>

      <StepNav slug="setup-overview" nextLabel="Complete registration" />
    </WizardShell>
  )
}
