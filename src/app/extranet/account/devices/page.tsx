import Link from "next/link"
import {
  ChevronLeft,
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  type LucideIcon,
} from "lucide-react"

import type { Device } from "@/lib/extranet/types"
import { devices } from "@/data/extranet"
import { ConfirmDialog, PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

const deviceIcons: Record<Device["type"], LucideIcon> = {
  laptop: Laptop,
  phone: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
}

export default function DevicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Devices"
        subtitle="Manage devices signed into your account"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/account" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <div className="space-y-3">
        {devices.map((d) => {
          const Icon = deviceIcons[d.type]
          return (
            <Card key={d.id}>
              <CardContent className="flex items-center gap-4">
                <span className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{d.name}</p>
                    {d.current ? (
                      <Badge variant="secondary">Current</Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {d.browser} · {d.location}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Last active: {d.lastActive}
                  </p>
                </div>
                {!d.current ? (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm">
                        Sign Out
                      </Button>
                    }
                    title={`Sign out ${d.name}?`}
                    description="This device will be signed out of your account and will need to log in again."
                    confirmLabel="Sign Out"
                    destructive
                    toastMessage={`Signed out ${d.name}`}
                  />
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
