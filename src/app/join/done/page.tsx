"use client"

import Link from "next/link"
import { CircleCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { WizardShell } from "../_components/wizard-shell"
import { SummaryList } from "../_components/summary"
import { useWizard } from "../_components/wizard-provider"
import { propertyTypeLabels, money } from "../_lib/labels"

export default function DonePage() {
  const { data } = useWizard()

  const units = data.units.length
  const location = [data.city, data.country].filter(Boolean).join(", ")
  const contract = data.contractType
    ? data.contractType[0].toUpperCase() + data.contractType.slice(1)
    : "Individual"

  return (
    <WizardShell>
      <Card>
        <CardContent className="px-6 py-8">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
              <CircleCheck className="size-8" />
            </span>
            <h1 className="font-heading mt-4 text-2xl font-semibold tracking-tight">
              You&apos;re all set!
            </h1>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              Your property has been successfully registered on the platform.
              Your listing will be reviewed and go live within 24–48 hours.
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
                { label: "Units", value: units },
                { label: "Photos", value: data.photos },
                { label: "Base rate", value: money(data.baseRate) },
                { label: "Contract type", value: contract },
              ]}
            />
          </div>

          <Button className="mt-6 w-full" render={<Link href="/extranet">Go to Extranet dashboard</Link>} />
          <p className="text-muted-foreground mt-4 text-center text-xs">
            You can update any of your property details from the dashboard at any
            time.
          </p>
        </CardContent>
      </Card>
    </WizardShell>
  )
}
