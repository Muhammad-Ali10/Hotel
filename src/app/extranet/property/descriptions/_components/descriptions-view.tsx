"use client"

import * as React from "react"
import { Eye, Pencil } from "lucide-react"
import { toast } from "sonner"

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
  DialogTrigger,
} from "@/components/ui/dialog"

type Description = {
  id: string
  name: string
  category: string
  languages: string[]
  score: number
  text: string
  pending?: boolean
}

const descriptions: Description[] = [
  {
    id: "d1",
    name: "Grand Horizon",
    category: "Luxury City Hotel",
    languages: ["EN", "FR", "DE", "JA"],
    score: 88,
    text: "Experience urban elegance at our 5-star city-center hotel with panoramic skyline views, world-class dining, and a rooftop infinity pool.",
    pending: true,
  },
  {
    id: "d2",
    name: "The Metropolitan",
    category: "Boutique Business Hotel",
    languages: ["EN", "ES"],
    score: 82,
    text: "A sophisticated retreat for the modern traveler, featuring curated art collections, a speakeasy bar, and direct metro access.",
  },
  {
    id: "d3",
    name: "Alpine Lodge Zermatt",
    category: "Mountain Chalet",
    languages: ["EN", "DE", "FR", "IT"],
    score: 91,
    text: "Authentic Swiss chalet at the foot of the Matterhorn, offering ski-in/ski-out access, a stone fireplace lounge, and gourmet fondue evenings.",
  },
  {
    id: "d4",
    name: "Casa del Mar",
    category: "Beachfront Resort",
    languages: ["EN", "ES", "IT"],
    score: 85,
    text: "Your Mediterranean sanctuary — whitewashed terraces cascading toward turquoise waters, with private beach access and fresh seafood dining.",
  },
  {
    id: "d5",
    name: "Sakura Ryokan",
    category: "Traditional Japanese Inn",
    languages: ["EN", "JA", "ZH"],
    score: 94,
    text: "Immerse in centuries-old Japanese hospitality with tatami floors, private onsen baths, kaiseki cuisine, and a serene Zen garden.",
  },
]

function EditDescriptionDialog({ item }: { item: Description }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" />
            Edit Description
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Description — {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`desc-${item.id}`}>Property description</Label>
          <Textarea
            id={`desc-${item.id}`}
            defaultValue={item.text}
            rows={5}
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
              toast.success(`Description updated for ${item.name}`)
              setOpen(false)
            }}
          >
            Save Description
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DescriptionsList() {
  return (
    <div className="space-y-4">
      {descriptions.map((d) => (
        <Card key={d.id}>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-base font-semibold">
                    {d.name}
                  </h3>
                  {d.pending ? (
                    <Badge variant="secondary">Pending From EBooking</Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-sm">{d.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {d.languages.map((l) => (
                    <span
                      key={l}
                      className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs font-medium"
                    >
                      {l}
                    </span>
                  ))}
                </div>
                <span className="text-sm font-medium">Score: {d.score}</span>
              </div>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {d.text}
            </p>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <EditDescriptionDialog item={d} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info(`Opening guest preview for ${d.name}…`)}
              >
                <Eye className="size-3.5" />
                Preview as Guest
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
