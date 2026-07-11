import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { longStayModules } from "@/data/extranet"
import {
  ActionButton,
  ConfirmDialog,
  PageHeader,
  StatusPill,
  Icon,
} from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function LongStaysPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Long Stays Toolkit"
        subtitle="Attract extended-stay guests — they book 3x more room nights on average"
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

      <div className="grid gap-6 sm:grid-cols-2">
        {longStayModules.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex h-full flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <span className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Icon name={m.icon} className="size-5" />
                </span>
                <StatusPill status={m.status} />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading text-base font-semibold">
                  {m.name}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {m.description}
                </p>
              </div>
              {m.status === "Active" ? (
                <ActionButton
                  variant="outline"
                  size="sm"
                  className="mt-auto w-fit"
                  toastType="info"
                  toastMessage={`Managing ${m.name}`}
                  toastDescription="Adjust this module's settings and rules."
                >
                  Manage
                </ActionButton>
              ) : (
                <ConfirmDialog
                  trigger={
                    <Button size="sm" className="mt-auto w-fit">
                      Activate
                    </Button>
                  }
                  title={`Activate ${m.name}?`}
                  description={m.description}
                  confirmLabel="Activate"
                  toastMessage="Module activated"
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
