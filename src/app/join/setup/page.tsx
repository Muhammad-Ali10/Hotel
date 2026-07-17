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

export default function SetupHubPage() {
  const router = useRouter()
  const { data } = useWizard()

  const hasUnit = data.units.length > 0
  const hasPhotos = data.photos > 0
  const typeLabel = data.propertyType ? propertyTypeLabels[data.propertyType] : "property"

  const goUnit = () => router.push(href("unit/details"))
  const goPhotos = () => router.push(href("photos"))
  const goFinal = () => router.push(href("payments"))

  return (
    <WizardShell>
      <StepHeading
        title="Set up your property"
        description="Complete the steps below to get your property ready for guests. You can always come back and make changes later."
      />

      <div className="space-y-3">
        <HubStep
          index={1}
          done
          title="Step 1 — Property details"
          badge={<CompletedBadge />}
          description={`${data.propertyName || "Your property"} — ${typeLabel} in ${data.city || "your city"}`}
          action={
            <Button
              variant="outline"
              size="sm"
              render={<Link href={href("property-type")}>Edit</Link>}
            />
          }
        />

        <HubStep
          index={2}
          done={hasUnit}
          active={!hasUnit}
          title="Step 2 — Units"
          badge={hasUnit ? <CompletedBadge label="1 unit added" /> : undefined}
          description={
            hasUnit
              ? "Manage your property's units, beds, amenities, and pricing."
              : "Tell us about your first unit so guests know what to expect."
          }
          action={
            <Button size={hasUnit ? "sm" : "default"} variant={hasUnit ? "outline" : "default"} onClick={goUnit}>
              {hasUnit ? "Add another unit" : "Add unit"}
            </Button>
          }
        >
          {hasUnit && (
            <div className="mt-3">
              <UnitRow unit={data.units[0]} />
            </div>
          )}
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
            <Button variant="outline" size="sm" onClick={goPhotos}>
              {hasPhotos ? "Manage" : "Add photos"}
            </Button>
          }
        />

        <HubStep
          index={4}
          locked={!hasUnit}
          title="Step 4 — Final steps"
          description={
            hasUnit
              ? "Set up payments, invoicing, and cancellation policies."
              : "Set up payments and invoicing. Add a unit first to unlock this step."
          }
          action={
            <Button variant="outline" size="sm" onClick={goFinal} disabled={!hasUnit}>
              Add final details
            </Button>
          }
        />
      </div>

      <StepNav
        slug="setup"
        onContinue={() => {
          if (!hasUnit) {
            goUnit()
            return false
          }
        }}
      />
    </WizardShell>
  )
}
