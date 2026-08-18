"use client"

import * as React from "react"
import Image from "next/image"
import { Images, Share2 } from "lucide-react"
import { toast } from "sonner"

import type { Photo } from "@/types"
import { hotelImage } from "@/lib/images"
import { Button } from "@/components/ui/button"
import { FavoriteButton } from "@/components/marketplace/favorite-button"
import { GalleryLightbox } from "./gallery-lightbox"

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
  // The grid has room for five; the viewer shows the whole set.
  const tiles = React.useMemo(() => photos.slice(0, 5), [photos])
  const [openAt, setOpenAt] = React.useState<number | null>(null)
  const [slide, setSlide] = React.useState(0)
  const stripRef = React.useRef<HTMLDivElement>(null)

  /** Actually copies. The button used to toast "copied to clipboard" having
   *  copied nothing at all. */
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Link copied to clipboard")
    } catch {
      toast.error("Couldn't copy the link", {
        description: "Your browser blocked clipboard access.",
      })
    }
  }

  function handleStripScroll() {
    const el = stripRef.current
    if (!el) return
    setSlide(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <div className="relative">
      {/* MOBILE — a swipeable strip of every photo. This used to render the
          first image and hide the rest behind `sm:block`, so a phone could see
          exactly one picture of the property. */}
      <div
        ref={stripRef}
        onScroll={handleStripScroll}
        className="flex h-[300px] snap-x snap-mandatory overflow-x-auto rounded-2xl sm:hidden"
      >
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenAt(i)}
            aria-label={`View photo ${i + 1} of ${photos.length}: ${photo.caption}`}
            className="bg-muted relative h-full w-full shrink-0 snap-center"
          >
            <Image
              src={hotelImage(photo.seed, 900, 700)}
              alt={`${name} — ${photo.caption}`}
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {/* DESKTOP — the five-tile mosaic, every tile opening the viewer */}
      <div className="hidden h-[300px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl sm:grid sm:h-[460px]">
        {tiles.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenAt(i)}
            aria-label={`View photo ${i + 1} of ${photos.length}: ${photo.caption}`}
            className={
              i === 0
                ? "bg-muted group relative col-span-2 row-span-2"
                : "bg-muted group relative"
            }
          >
            <Image
              src={hotelImage(photo.seed, i === 0 ? 1280 : 640, i === 0 ? 960 : 480)}
              alt={`${name} — ${photo.caption}`}
              fill
              priority={i === 0}
              sizes={i === 0 ? "50vw" : "25vw"}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      {/* Top-right actions */}
      <div className="absolute top-3 right-3 flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Copy link to this property"
          onClick={share}
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

      {/* Photo counter (mobile) / show-all trigger (desktop) */}
      <span className="bg-background/85 absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs font-medium tabular-nums backdrop-blur sm:hidden">
        {Math.min(slide + 1, photos.length)} / {photos.length}
      </span>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpenAt(0)}
        className="bg-background/85 hover:bg-background absolute right-3 bottom-3 gap-2 shadow-sm backdrop-blur"
      >
        <Images className="size-4" />
        Show all {photos.length} photos
      </Button>

      <GalleryLightbox
        name={name}
        photos={photos}
        index={openAt}
        onIndexChange={setOpenAt}
        onClose={() => setOpenAt(null)}
      />
    </div>
  )
}
