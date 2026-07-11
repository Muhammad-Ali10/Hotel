import Link from "next/link"
import { ChevronLeft, Globe, RefreshCw } from "lucide-react"

import { connectivityProvider } from "@/data/extranet"
import {
  ActionButton,
  ConfirmDialog,
  PageHeader,
  StatusPill,
} from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

const details = [
  { label: "Connected Since", value: connectivityProvider.since },
  { label: "Last Sync", value: connectivityProvider.lastSync },
  { label: "Sync Frequency", value: connectivityProvider.frequency },
]

export default function ConnectivityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectivity Provider"
        subtitle="Manage your channel manager connection"
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

      <Card className="max-w-2xl">
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bg-muted text-foreground flex size-11 items-center justify-center rounded-xl">
                <Globe className="size-5" />
              </span>
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  {connectivityProvider.name}
                </h2>
                <StatusPill status={connectivityProvider.status} />
              </div>
            </div>
            <div className="flex gap-2">
              <ActionButton
                size="sm"
                toastMessage="Channel synced"
                toastDescription="Syncing…"
              >
                <RefreshCw className="size-4" />
                Sync Now
              </ActionButton>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm">
                    Disconnect
                  </Button>
                }
                title={`Disconnect ${connectivityProvider.name}?`}
                description="Your channels will stop syncing until you reconnect."
                confirmLabel="Disconnect"
                destructive
                toastMessage="Channel disconnected"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-3">
            {details.map((d) => (
              <div key={d.label} className="space-y-0.5">
                <p className="text-muted-foreground text-xs">{d.label}</p>
                <p className="text-sm font-medium">{d.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t pt-5">
            <p className="text-muted-foreground text-xs">Connected Channels</p>
            <div className="flex flex-wrap gap-2">
              {connectivityProvider.channels.map((c) => (
                <Badge key={c} variant="secondary">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
