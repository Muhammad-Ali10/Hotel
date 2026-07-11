"use client"

import * as React from "react"
import { Pencil } from "lucide-react"

import type { Policy } from "@/lib/extranet/types"
import { policies } from "@/data/extranet"
import { Icon } from "@/components/extranet/shared"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function PoliciesView() {
  const [selected, setSelected] = React.useState<Policy | null>(null)

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {policies.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon name={p.icon} className="size-4" />
                  </span>
                  <h3 className="font-heading text-sm font-semibold">
                    {p.title}
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(p)}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {p.body}
              </p>
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
            <div key={selected.id} className="contents">
              <DialogHeader>
                <DialogTitle>Edit: {selected.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="policy-title">Policy Title</Label>
                  <Input id="policy-title" defaultValue={selected.title} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="policy-body">Description</Label>
                  <Textarea
                    id="policy-body"
                    defaultValue={selected.body}
                    className="min-h-32"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <DialogClose render={<Button />}>Save Changes</DialogClose>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
