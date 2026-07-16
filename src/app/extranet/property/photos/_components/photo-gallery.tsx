"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ArrowRight, ExternalLink, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { hotelImage } from "@/lib/images"
import { cn } from "@/lib/utils"
import { useStore } from "@/store"
import { useActiveHotel } from "@/store/selectors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NotFoundCard } from "@/components/shared/not-found-card"

/**
 * The property's gallery. Reordering here changes the order guests see on the
 * listing, and the first photo becomes the hero — the screen used to manage a
 * photo list that fed nothing (the public gallery was generated from a seed).
 */
export function PhotoGallery() {
  const hotel = useActiveHotel()
  const updatePhotos = useStore((s) => s.updatePhotos)
  const [filter, setFilter] = React.useState("All")

  if (!hotel) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to manage its photos."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const { photos } = hotel
  const categories = ["All", ...new Set(photos.map((p) => p.category))]
  const list = filter === "All" ? photos : photos.filter((p) => p.category === filter)
  const countFor = (c: string) =>
    c === "All" ? photos.length : photos.filter((p) => p.category === c).length

  function move(id: string, delta: number) {
    const index = photos.findIndex((p) => p.id === id)
    const next = index + delta
    if (index < 0 || next < 0 || next >= photos.length) return
    const reordered = [...photos]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(next, 0, moved)
    updatePhotos(hotel!.id, reordered)
    toast.success(next === 0 ? "Set as the hero photo." : "Photo order updated.")
  }

  function remove(id: string) {
    if (photos.length <= 1) {
      toast.error("Keep at least one photo on your listing.")
      return
    }
    updatePhotos(
      hotel!.id,
      photos.filter((p) => p.id !== id)
    )
    toast.success("Photo removed from your listing.")
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        The first photo is the hero on your listing.{" "}
        <Link
          href={`/hotels/${hotel.id}`}
          target="_blank"
          className="text-foreground inline-flex items-center gap-1 hover:underline"
        >
          View gallery <ExternalLink className="size-3" />
        </Link>
      </p>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              filter === c
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {c}
            <span className="ml-1.5 opacity-70">{countFor(c)}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((photo) => {
          const index = photos.findIndex((p) => p.id === photo.id)
          return (
            <div key={photo.id} className="group space-y-2">
              <div className="bg-muted relative aspect-[4/3] overflow-hidden rounded-lg">
                <Image
                  src={hotelImage(photo.seed, 600, 450)}
                  alt={photo.caption}
                  fill
                  sizes="(max-width: 1024px) 50vw, 300px"
                  className="object-cover"
                />
                {index === 0 ? (
                  <Badge className="absolute top-2 left-2 gap-1">
                    <Star className="size-3" />
                    Hero
                  </Badge>
                ) : null}
                <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="secondary"
                      aria-label="Move earlier"
                      disabled={index === 0}
                      onClick={() => move(photo.id, -1)}
                      className="bg-background/85 backdrop-blur"
                    >
                      <ArrowLeft className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="secondary"
                      aria-label="Move later"
                      disabled={index === photos.length - 1}
                      onClick={() => move(photo.id, 1)}
                      className="bg-background/85 backdrop-blur"
                    >
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    aria-label="Remove photo"
                    onClick={() => remove(photo.id)}
                    className="bg-background/85 text-destructive backdrop-blur"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm">{photo.caption}</p>
                <Badge variant="outline">{photo.category}</Badge>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
