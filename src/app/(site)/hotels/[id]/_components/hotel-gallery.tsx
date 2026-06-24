"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Heart, Share2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { hotelImage } from "@/lib/images"
import { Button } from "@/components/ui/button"

export function HotelGallery({
  seed,
  name,
  count = 4,
}: {
  seed: string
  name: string
  count?: number
}) {
  const [index, setIndex] = React.useState(0)
  const images = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        full: hotelImage(`${seed}-${i}`, 1280, 720),
        thumb: hotelImage(`${seed}-${i}`, 320, 220),
      })),
    [seed, count]
  )
  const go = (delta: number) =>
    setIndex((i) => (i + delta + count) % count)

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="bg-muted relative aspect-[16/9] w-full overflow-hidden rounded-2xl">
        <Image
          key={index}
          src={images[index].full}
          alt={`${name} photo ${index + 1}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="object-cover"
        />

        {/* top-right actions */}
        <div className="absolute top-3 right-3 flex gap-2">
          <IconCircle label="Share">
            <Share2 className="size-4" />
          </IconCircle>
          <IconCircle label="Save">
            <Heart className="size-4" />
          </IconCircle>
        </div>

        {/* prev / next */}
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous photo"
          className="bg-background/80 hover:bg-background text-foreground absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full shadow-sm backdrop-blur transition"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next photo"
          className="bg-background/80 hover:bg-background text-foreground absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full shadow-sm backdrop-blur transition"
        >
          <ChevronRight className="size-5" />
        </button>

        {/* counter */}
        <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
          {index + 1} / {count}
        </span>
      </div>

      {/* Thumbnails */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`View photo ${i + 1}`}
            className={cn(
              "relative aspect-[4/3] overflow-hidden rounded-lg ring-2 transition",
              i === index
                ? "ring-primary"
                : "ring-transparent opacity-80 hover:opacity-100"
            )}
          >
            <Image
              src={img.thumb}
              alt={`${name} thumbnail ${i + 1}`}
              fill
              sizes="(max-width: 1024px) 25vw, 16vw"
              className="object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  )
}

function IconCircle({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-label={label}
      className="bg-background/80 hover:bg-background size-9 rounded-full shadow-sm backdrop-blur"
    >
      {children}
    </Button>
  )
}
