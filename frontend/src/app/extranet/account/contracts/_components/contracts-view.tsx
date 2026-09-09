"use client"

import * as React from "react"
import { FileText } from "lucide-react"
import { toast } from "sonner"

import { formatDate } from "@/lib/format"
import { useAcceptContract, useContracts } from "@/lib/api/hooks"
import { SectionCard, StatusPill } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Reading =
  | { kind: "signed"; title: string; body: string; meta: string }
  | { kind: "outstanding"; templateId: string; title: string; body: string; meta: string }

/**
 * What has been agreed, and what has not (rule #98).
 *
 * A signature is final: a database trigger refuses any update that touches the
 * organisation, the version, the text, who signed it or when. So a signed
 * agreement is shown as a RECORD — the exact text as accepted, with the name
 * and the timestamp — and never as a form. There is no re-sign, no edit and no
 * delete, because a contract you can change afterwards is not one.
 *
 * A new VERSION of a template is a new agreement to accept, not a rewrite of
 * the old one. Both stay readable, which is the only way to answer "what did
 * we actually agree to in March".
 */
export function ContractsView() {
  const contracts = useContracts()
  const accept = useAcceptContract()
  const [reading, setReading] = React.useState<Reading | null>(null)

  const signed = contracts.data?.signed ?? []
  const outstanding = contracts.data?.outstanding ?? []

  if (contracts.isPending) {
    return (
      <div className="grid gap-6 sm:grid-cols-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="bg-muted h-40 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (contracts.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {contracts.error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {outstanding.length > 0 ? (
        <SectionCard
          title="Waiting for your agreement"
          description="Read it in full before accepting — this is the version that binds, and it cannot be changed afterwards."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {outstanding.map((template) => (
              <Card key={template.id} className="border-primary/40">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-sm font-semibold">
                        {template.title}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {template.kind} · v{template.version} · effective{" "}
                        {formatDate(template.effectiveFrom)}
                      </p>
                    </div>
                    <Badge>Not accepted</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setReading({
                          kind: "outstanding",
                          templateId: template.id,
                          title: template.title,
                          body: template.body,
                          meta: `v${template.version} · effective ${formatDate(template.effectiveFrom)}`,
                        })
                      }
                    >
                      <FileText className="size-3.5" />
                      Read and accept
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Signed agreements
        </h2>

        <div className="grid gap-6 sm:grid-cols-2">
          {signed.map((contract) => (
            <Card key={contract.id}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-heading text-sm font-semibold">
                      {contract.title}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {contract.kind} · v{contract.version}
                    </p>
                  </div>
                  <StatusPill status={contract.status} />
                </div>

                <dl className="space-y-1 text-sm">
                  {contract.acceptedAt ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Accepted</dt>
                      <dd>{formatDate(contract.acceptedAt)}</dd>
                    </div>
                  ) : null}
                  {contract.acceptedByName ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">By</dt>
                      <dd>{contract.acceptedByName}</dd>
                    </div>
                  ) : null}
                  {contract.expiresAt ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Expires</dt>
                      <dd>{formatDate(contract.expiresAt)}</dd>
                    </div>
                  ) : null}
                  {contract.endedAt ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Ended</dt>
                      <dd>
                        {formatDate(contract.endedAt)}
                        {contract.endedReason ? ` · ${contract.endedReason}` : ""}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setReading({
                      kind: "signed",
                      title: contract.title,
                      body: contract.body,
                      meta: contract.acceptedAt
                        ? `Accepted ${formatDate(contract.acceptedAt)} by ${contract.acceptedByName ?? "—"}`
                        : `v${contract.version}`,
                    })
                  }
                >
                  <FileText className="size-3.5" />
                  Read
                </Button>
              </CardContent>
            </Card>
          ))}

          {signed.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground text-sm">
                Nothing signed yet.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={reading !== null} onOpenChange={(open) => !open && setReading(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {reading ? (
            <>
              <DialogHeader>
                <DialogTitle>{reading.title}</DialogTitle>
                <DialogDescription>{reading.meta}</DialogDescription>
              </DialogHeader>

              {/*
               * The stored text, verbatim.
               *
               * A signed contract carries its OWN copy of the wording rather
               * than pointing at a template that may since have moved on —
               * which is what makes "what did we agree to" answerable years
               * later.
               */}
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {reading.body}
              </div>

              <DialogFooter>
                <DialogClose render={<Button variant="outline">Close</Button>} />
                {reading.kind === "outstanding" ? (
                  <Button
                    disabled={accept.isPending}
                    onClick={() =>
                      accept.mutate(reading.templateId, {
                        onSuccess: () => {
                          toast.success("Accepted", {
                            description: "This is now on record and cannot be changed.",
                          })
                          setReading(null)
                        },
                        onError: (e) => toast.error(e.message),
                      })
                    }
                  >
                    {accept.isPending ? "Accepting…" : "I accept this agreement"}
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
