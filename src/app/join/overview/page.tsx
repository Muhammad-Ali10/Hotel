"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { StepNav } from "../_components/step-nav"
import { HubStep } from "../_components/hub-step"
import { UnitRow } from "../_components/unit-row"
import { CompletedBadge } from "../_components/completed-badge"
import { useWizard } from "../_components/wizard-provider"
import { href } from "../_lib/steps"
import { propertyTypeLabels } from "../_lib/labels"

export default function OverviewPage() {
  const router = useRouter()
  const { data } = useWizard()

  const hasPhotos = data.photos > 0
  const unitCount = data.units.length
  const typeLabel = data.propertyType ? propertyTypeLabels[data.propertyType] : "property"

  return (
    <WizardShell>
      <StepHeading
        title="Set up your property"
        description="Looking good! Finish the final steps to complete your listing."
      />

      <div className="space-y-3">
        <HubStep
          index={1}
          done
          title="Step 1 — Property details"
          badge={<CompletedBadge />}
          description={`${data.propertyName || "Your property"} — ${typeLabel} in ${data.city || "your city"}`}
          action={
            <Button variant="outline" size="sm" render={<Link href={href("property-type")}>Edit</Link>} />
          }
        />

        <HubStep
          index={2}
          done={unitCount > 0}
          title="Step 2 — Units"
          badge={<CompletedBadge label={`${unitCount} unit${unitCount === 1 ? "" : "s"} added`} />}
          description="Manage your property's units, beds, amenities, and pricing."
          action={
            <Button variant="outline" size="sm" onClick={() => router.push(href("unit/details"))}>
              Add another unit
            </Button>
          }
        >
          <div className="mt-3 space-y-2">
            {data.units.map((unit, i) => (
              <UnitRow key={i} unit={unit} />
            ))}
          </div>
        </HubStep>

        <HubStep
          index={3}
          done={hasPhotos}
          title="Step 3 — Photos"
          badge={hasPhotos ? <CompletedBadge label={`${data.photos} photo${data.photos > 1 ? "s" : ""}`} /> : undefined}
          description={
            hasPhotos
              ? "Great — you've added property photos."
              : "Share some photos of your property to attract more guests."
          }
          action={
            <Button variant="outline" size="sm" onClick={() => router.push(href("photos"))}>
              {hasPhotos ? "Manage" : "Add photos"}
            </Button>
          }
        />

        <HubStep
          index={4}
          title="Step 4 — Final steps"
          description="Set up payments, invoicing, and cancellation policies."
          action={
            <Button size="sm" onClick={() => router.push(href("payments"))}>
              Add final details
            </Button>
          }
        />
      </div>

      <StepNav slug="overview" nextLabel="Continue to final steps" />
    </WizardShell>
  )
}
