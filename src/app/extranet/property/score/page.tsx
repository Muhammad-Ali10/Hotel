import Link from "next/link"
import { ChevronLeft, Lightbulb } from "lucide-react"

import { propertyScore } from "@/data/extranet"
import { PageHeader, StatusPill } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Tone = "success" | "warning" | "danger"

function tone(status: string): Tone {
  if (status === "Excellent" || status === "Great") return "success"
  if (status === "Good") return "warning"
  return "danger"
}

const overallStatus =
  propertyScore.overall >= 85
    ? "Excellent"
    : propertyScore.overall >= 75
      ? "Good"
      : "Needs Work"

export default function PropertyScorePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Property Page Score"
        subtitle="See how your property page performs and where to improve"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/property" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-2 sm:flex-row sm:items-center">
          <div className="text-center sm:text-left">
            <p className="font-heading text-5xl font-semibold">
              {propertyScore.overall}
              <span className="text-muted-foreground text-2xl">/100</span>
            </p>
            <div className="mt-2 flex items-center justify-center gap-2 sm:justify-start">
              <span className="text-sm">Overall Score:</span>
              <StatusPill status={overallStatus} tone={tone(overallStatus)} />
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-foreground h-full rounded-full"
                style={{ width: `${propertyScore.overall}%` }}
              />
            </div>
            <p className="text-muted-foreground text-sm">{propertyScore.note}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {propertyScore.categories.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-heading text-sm font-semibold">{c.name}</h3>
                <span className="font-heading text-2xl font-semibold">
                  {c.score}
                </span>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-foreground h-full rounded-full"
                  style={{ width: `${c.score}%` }}
                />
              </div>
              <StatusPill status={c.status} tone={tone(c.status)} />
              <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
                {c.tip}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
