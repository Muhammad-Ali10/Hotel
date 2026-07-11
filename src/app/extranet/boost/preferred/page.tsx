import Link from "next/link"
import { CheckCircle2, ChevronLeft } from "lucide-react"

import { preferredCriteria, preferredQualifies } from "@/data/extranet"
import { ConfirmDialog, PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function PreferredPartnerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Preferred Partner Program"
        subtitle="Earn the Preferred badge and get 20% more visibility"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/boost" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      {preferredQualifies ? (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-5 shrink-0" />
          <div>
            <p className="font-medium">You qualify! 🎉</p>
            <p className="text-sm opacity-90">
              Your property meets all the requirements for the Preferred Partner
              badge.
            </p>
          </div>
          <ConfirmDialog
            trigger={
              <Button size="sm" className="ml-auto shrink-0">
                Join Program
              </Button>
            }
            title="Join Preferred Partner programme?"
            description="Your property meets every requirement. Joining adds the Preferred badge and boosts your visibility by 20%."
            confirmLabel="Join Program"
            toastMessage="Joined Preferred Partner programme"
          />
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {preferredCriteria.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-sm font-semibold">{c.label}</h3>
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="grid grid-cols-2 gap-2 border-t pt-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Required</p>
                  <p className="font-medium">{c.required}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Your value</p>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">
                    {c.yours}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
