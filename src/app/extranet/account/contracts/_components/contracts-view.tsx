"use client"

import * as React from "react"
import { FileText } from "lucide-react"

import type { Contract } from "@/lib/extranet/types"
import { contracts } from "@/data/extranet"
import { StatusPill } from "@/components/extranet/shared"
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

export function ContractsView() {
  const [selected, setSelected] = React.useState<Contract | null>(null)

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        {contracts.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <FileText className="size-4" />
                  </span>
                  <div>
                    <h3 className="font-heading text-sm font-semibold">
                      {c.name}
                    </h3>
                    <p className="text-muted-foreground text-xs">{c.type}</p>
                  </div>
                </div>
                <StatusPill status={c.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Signed</p>
                  <p className="font-medium">{c.signed}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Expires</p>
                  <p className="font-medium">{c.expires}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setSelected(c)}
              >
                View Contract
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <DialogTitle>{selected.name}</DialogTitle>
                  <StatusPill status={selected.status} />
                </div>
                <DialogDescription>
                  {selected.type} · Signed {selected.signed} · Expires{" "}
                  {selected.expires}
                </DialogDescription>
              </DialogHeader>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {selected.body}
              </p>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Close
                </DialogClose>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
