"use client"

import * as React from "react"
import Image from "next/image"
import { Heart, Images, Share2 } from "lucide-react"
import { toast } from "sonner"

import { hotelImage } from "@/lib/images"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function PropertyGallery({ seed, name }: { seed: string; name: string }) {
  const [saved, setSaved] = React.useState(false)
  const images = React.useMemo(
    () => Array.from({ length: 5 }, (_, i) => hotelImage(`${seed}-${i}`, 1280, 720)),
    [seed]
  )

  return (
    <div className="relative">
      <div className="grid h-[300px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl sm:h-[460px]">
        {/* Main image */}
        <div className="bg-muted relative col-span-4 row-span-2 sm:col-span-2">
          <Image
            src={images[0]}
            alt={`${name} — main photo`}
            fill
            priority
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover"
          />
        </div>

        {/* Secondary images (desktop only) */}
        {images.slice(1, 5).map((src, i) => (
          <div key={i} className="bg-muted relative hidden sm:block">
            <Image
              src={src}
              alt={`${name} — photo ${i + 2}`}
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
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-pressed={saved}
          aria-label="Save"
          onClick={() => {
            setSaved((s) => !s)
            toast(saved ? "Removed from favorites" : "Saved to favorites")
          }}
          className="bg-background/80 hover:bg-background size-9 rounded-full shadow-sm backdrop-blur"
        >
          <Heart
            className={cn("size-4", saved && "fill-rose-500 text-rose-500")}
          />
        </Button>
      </div>

      {/* Show all photos */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => toast("Opening full photo gallery…")}
        className="bg-background/85 hover:bg-background absolute right-3 bottom-3 gap-2 shadow-sm backdrop-blur"
      >
        <Images className="size-4" />
        Show all photos
      </Button>
    </div>
  )
}
