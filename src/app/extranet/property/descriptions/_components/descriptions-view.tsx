"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLink, Pencil } from "lucide-react"
import { toast } from "sonner"

import type { Hotel } from "@/types"
import { useStore } from "@/store"
import { usePartnerHotels } from "@/store/selectors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

const languages = ["EN", "FR", "DE", "JA"]

/** Scores the description on length and specificity — a rough proxy for how much
 *  a guest learns from it. */
function scoreDescription(text: string) {
  const words = text.trim().split(/\s+/).length
  return Math.max(10, Math.min(100, Math.round((words / 70) * 100)))
}

/**
 * One description per property — the one the public listing renders. This
 * screen used to hold its own set of descriptions, so the same hotel had three
 * different write-ups across the extranet (one of them describing a beachfront
 * resort as a city-centre hotel) and the public page showed none of them.
 */
export function DescriptionsView() {
  const hotels = usePartnerHotels()
  const [editing, setEditing] = React.useState<Hotel | null>(null)

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Each property has one description. It is what guests read under “About This
        Property”.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {hotels.map((hotel) => {
          const score = scoreDescription(hotel.description)
          return (
            <Card key={hotel.id}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="font-heading text-sm font-semibold">{hotel.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{hotel.type}</Badge>
                      <Badge variant="outline">{hotel.city}</Badge>
                      {languages.map((l) => (
                        <Badge key={l} variant="secondary">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-lg font-semibold">
                      {score}
                      <span className="text-muted-foreground text-xs">/100</span>
                    </p>
                    <p className="text-muted-foreground text-xs">quality</p>
                  </div>
                </div>

                <p className="text-muted-foreground text-sm text-pretty">
                  {hotel.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(hotel)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    render={
                      <Link href={`/hotels/${hotel.id}`} target="_blank">
                        <ExternalLink className="size-3.5" />
                        View live
                      </Link>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {editing ? (
        <EditDescriptionDialog hotel={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  )
}

function EditDescriptionDialog({ hotel, onClose }: { hotel: Hotel; onClose: () => void }) {
  const updateHotel = useStore((s) => s.updateHotel)
  const [text, setText] = React.useState(hotel.description)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{hotel.name} description</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="description-text">Description</Label>
          <Textarea
            id="description-text"
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>Quality score: {scoreDescription(text)}/100</span>
            <span>{text.trim().split(/\s+/).length} words</span>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button
            onClick={() => {
              if (!text.trim()) {
                toast.error("A description can't be empty.")
                return
              }
              updateHotel(hotel.id, { description: text.trim() })
              toast.success(`${hotel.name} description updated — live on your listing.`)
              onClose()
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
