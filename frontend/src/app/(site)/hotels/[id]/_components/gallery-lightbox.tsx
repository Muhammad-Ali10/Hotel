"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"

import type { Photo } from "@/types"
import { hotelImage } from "@/lib/images"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Full-screen photo viewer. The gallery's "Show all photos" button used to fire
 * a toast that counted the photos and opened nothing — this is what it now
 * opens, and it shows every photo rather than the five the grid has room for.
 *
 * `index` doubles as the open state: a number opens the viewer at that photo,
 * `null` closes it.
 */
export function GalleryLightbox({
  name,
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  name: string
  photos: Photo[]
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const total = photos.length
  const open = index !== null
  const current = open ? photos[index] : undefined

  const go = React.useCallback(
    (delta: number) => {
      if (index === null || total === 0) return
      onIndexChange((index + delta + total) % total)
    },
    [index, total, onIndexChange]
  )

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault()
      go(1)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      go(-1)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent
        onKeyDown={handleKeyDown}
        className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] flex-col gap-0 p-0 sm:max-w-5xl"
      >
        <DialogTitle className="sr-only">
          {name} — photo {(index ?? 0) + 1} of {total}
        </DialogTitle>

        {current ? (
          <>
            {/* STAGE */}
            <div className="bg-muted relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-t-xl">
              <Image
                key={current.id}
                src={hotelImage(current.seed, 1600, 1000)}
                alt={`${name} — ${current.caption}`}
                fill
                priority
                sizes="(max-width: 640px) 100vw, 1024px"
                className="object-cover"
              />

              {total > 1 ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Previous photo"
                    onClick={() => go(-1)}
                    className="bg-background/85 hover:bg-background absolute top-1/2 left-3 size-11 -translate-y-1/2 rounded-full shadow-sm backdrop-blur"
                  >
                    <ChevronLeft className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Next photo"
                    onClick={() => go(1)}
                    className="bg-background/85 hover:bg-background absolute top-1/2 right-3 size-11 -translate-y-1/2 rounded-full shadow-sm backdrop-blur"
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                </>
              ) : null}

              <span className="bg-background/85 absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs font-medium tabular-nums backdrop-blur">
                {(index ?? 0) + 1} / {total}
              </span>
            </div>

            {/* CAPTION + THUMBNAILS */}
            <div className="flex min-h-0 flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{current.category}</Badge>
                <p className="text-muted-foreground text-sm">{current.caption}</p>
              </div>

              {total > 1 ? (
                <div
                  className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
                  aria-label="Photo thumbnails"
                >
                  {photos.map((photo, i) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => onIndexChange(i)}
                      aria-label={`View photo ${i + 1}: ${photo.caption}`}
                      aria-current={i === index}
                      className={cn(
                        "relative aspect-[4/3] h-14 shrink-0 overflow-hidden rounded-md transition-opacity",
                        i === index
                          ? "ring-foreground ring-2"
                          : "opacity-60 hover:opacity-100"
                      )}
                    >
                      <Image
                        src={hotelImage(photo.seed, 160, 120)}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
