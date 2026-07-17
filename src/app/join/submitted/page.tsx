"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { CircleCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { WizardShell } from "../_components/wizard-shell"
import { SummaryList } from "../_components/summary"
import { useWizard } from "../_components/wizard-provider"
import { href, nextStep } from "../_lib/steps"
import { propertyTypeLabels, pkr } from "../_lib/labels"

export default function SubmittedPage() {
  const router = useRouter()
  const { data } = useWizard()

  const rooms = data.roomTypes.reduce((n, r) => n + r.count, 0)
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
              Setup complete!
            </h1>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              Your partner account and property have been submitted for review.
              You&apos;ll receive a confirmation email at{" "}
              <span className="text-foreground font-medium">
                {data.email || "you@example.com"}
              </span>{" "}
              with next steps.
            </p>
          </div>

          <div className="bg-muted/40 mt-6 rounded-xl border p-4">
            <p className="mb-1 text-sm font-semibold">Registration summary</p>
            <SummaryList
              rows={[
                { label: "Property", value: data.propertyName || "—" },
                {
                  label: "Type",
                  value: data.propertyType ? propertyTypeLabels[data.propertyType] : "—",
                },
                { label: "Location", value: location || "—" },
                { label: "Rooms", value: rooms },
                { label: "Photos", value: data.photos },
                { label: "Base rate", value: pkr(data.baseRate) },
              ]}
            />
          </div>

          <div className="mt-6 space-y-2">
            <Button className="w-full" onClick={continueSetup}>
              Set up your property
            </Button>
            <Button variant="outline" className="w-full" render={<Link href="/extranet">Go to Extranet</Link>} />
          </div>
          <p className="text-muted-foreground mt-4 text-center text-xs">
            Our team typically reviews new listings within 24–48 hours.
          </p>
        </CardContent>
      </Card>
    </WizardShell>
  )
}
