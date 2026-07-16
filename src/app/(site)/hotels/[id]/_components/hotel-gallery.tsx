"use client"

import * as React from "react"
import Image from "next/image"
import { Images, Share2 } from "lucide-react"
import { toast } from "sonner"

import type { Photo } from "@/types"
import { hotelImage } from "@/lib/images"
import { Button } from "@/components/ui/button"
import { FavoriteButton } from "@/components/marketplace/favorite-button"

/** Renders the partner's photo list, in the order they arranged it. */
export function HotelGallery({
  hotelId,
  name,
  photos,
}: {
  hotelId: string
  name: string
  photos: Photo[]
}) {
  const images = React.useMemo(
    () => photos.slice(0, 5).map((p) => ({ ...p, src: hotelImage(p.seed, 1280, 720) })),
    [photos]
  )

  return (
    <div className="relative">
      <div className="grid h-[300px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl sm:h-[460px]">
        {/* Main image */}
        <div className="bg-muted relative col-span-4 row-span-2 sm:col-span-2">
          {images[0] ? (
            <Image
              src={images[0].src}
              alt={`${name} — ${images[0].caption}`}
              fill
              priority
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover"
            />
          ) : null}
        </div>

        {/* Secondary images (desktop only) */}
        {images.slice(1, 5).map((photo) => (
          <div key={photo.id} className="bg-muted relative hidden sm:block">
            <Image
              src={photo.src}
              alt={`${name} — ${photo.caption}`}
              fill
              sizes="25vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {/* Top-right actions */}
      <div className="absolute top-3 right-3 flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Share"
          onClick={() => toast("Share link copied to clipboard")}
          className="bg-background/80 hover:bg-background size-9 rounded-full shadow-sm backdrop-blur"
        >
          <Share2 className="size-4" />
        </Button>
        <FavoriteButton
          hotelId={hotelId}
          hotelName={name}
          className="bg-background/80 hover:bg-background"
        />
      </div>

      {/* Show all photos */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => toast(`${photos.length} photos in this gallery`)}
        className="bg-background/85 hover:bg-background absolute right-3 bottom-3 gap-2 shadow-sm backdrop-blur"
      >
        <Images className="size-4" />
        Show all photos
      </Button>
    </div>
  )
}
