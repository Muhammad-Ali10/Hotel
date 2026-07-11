import { MessageSquare, Sparkles } from "lucide-react"

import type { GuestComm } from "@/lib/extranet/types"
import { guestCommunications } from "@/data/extranet"
import { avatarImage } from "@/lib/images"
import { ActionButton, PageHeader, StatusPill } from "@/components/extranet/shared"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { NewMessageDialog } from "./_components/new-message-dialog"

function stayTone(s: GuestComm["stayStatus"]) {
  return s === "In-Stay" ? "info" : s === "Pre-Arrival" ? "warning" : "neutral"
}

export default function GuestCommunicationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Guest Communications"
        subtitle={`${guestCommunications.length} active guest conversations`}
      >
        <NewMessageDialog />
      </PageHeader>

      <div className="space-y-3">
        {guestCommunications.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-start gap-3">
              <Avatar>
                <AvatarImage src={avatarImage(c.seed)} alt={c.guest} />
                <AvatarFallback>{c.guest[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{c.guest}</p>
                  <StatusPill status={c.stayStatus} tone={stayTone(c.stayStatus)} />
                </div>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {c.message}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {c.property} · {c.room} · {c.channel}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 text-right">
                <p className="text-muted-foreground text-xs">{c.time}</p>
                <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                  <MessageSquare className="size-3" />
                  {c.messages}
                </p>
                <ActionButton
                  variant="outline"
                  size="sm"
                  toastMessage="Reply sent"
                  toastType="success"
                >
                  Reply
                </ActionButton>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/40">
        <CardContent className="flex items-start gap-3">
          <span className="bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Sparkles className="size-4" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">Automated Communications</p>
            <p className="text-muted-foreground text-sm">
              Pre-arrival welcome messages, post-stay thank-you notes, and review
              request emails are sent automatically. Configure templates in
              Settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
