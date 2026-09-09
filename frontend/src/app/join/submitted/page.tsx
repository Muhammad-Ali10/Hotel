"use client"

import { useRouter } from "next/navigation"
import { CircleCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { WizardShell } from "../_components/wizard-shell"
import { SummaryList } from "../_components/summary"
import { useWizard } from "../_components/wizard-provider"
import { href, nextStep } from "../_lib/steps"
import { propertyTypeLabels, money } from "../_lib/labels"

/* ============================================================================
 * The pause between the property and the rooms.
 *
 * It used to say "Setup complete!", that the account and property "have been
 * submitted for review", and that a confirmation email was on its way. None of
 * the three was true: this screen sits at step 12 of 31, nothing has been sent
 * to anybody, no email is triggered here, and the partner has eighteen screens
 * still ahead of them — starting with the rooms, without which the application
 * cannot be submitted at all.
 *
 * A partner who believed it would have closed the tab and waited for a decision
 * on an application that was half-written and had never left their browser.
 * ========================================================================== */

export default function SubmittedPage() {
  const router = useRouter()
  const { data, photos } = useWizard()

  const location = [data.city, data.country].filter(Boolean).join(", ")

  function continueSetup() {
    const next = nextStep("submitted")
    if (next) router.push(href(next.path))
  }

  return (
    <WizardShell>
      <Card>
        <CardContent className="px-6 py-8">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
              <CircleCheck className="size-8" />
            </span>
            <h1 className="font-heading mt-4 text-2xl font-semibold tracking-tight">
              Your property is saved
            </h1>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              Everything so far is stored against your account, so you can stop
              here and pick it up on any device. Next come the rooms — your
              application needs at least one before it can be sent.
            </p>
          </div>

          <div className="bg-muted/40 mt-6 rounded-xl border p-4">
            <p className="mb-1 text-sm font-semibold">What you&apos;ve told us</p>
            <SummaryList
              rows={[
                { label: "Property", value: data.propertyName || "—" },
                {
                  label: "Type",
                  value: data.propertyType ? propertyTypeLabels[data.propertyType] : "—",
                },
                { label: "Location", value: location || "—" },
                { label: "Photos", value: photos.length },
                {
                  label: "Nightly rate",
                  value: data.baseRate ? money(data.baseRate) : "—",
                },
              ]}
            />
          </div>

          <Button className="mt-6 w-full" onClick={continueSetup}>
            Add your rooms
          </Button>
        </CardContent>
      </Card>
    </WizardShell>
  )
}
