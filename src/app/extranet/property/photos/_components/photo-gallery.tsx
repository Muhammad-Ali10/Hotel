"use client"

import * as React from "react"
import Image from "next/image"

import { photos } from "@/data/extranet"
import { hotelImage } from "@/lib/images"
import { cn } from "@/lib/utils"

const categories = ["All", ...Array.from(new Set(photos.map((p) => p.category)))]
const countFor = (c: string) =>
  c === "All" ? photos.length : photos.filter((p) => p.category === c).length

export function PhotoGallery() {
  const [filter, setFilter] = React.useState("All")
  const list = filter === "All" ? photos : photos.filter((p) => p.category === filter)

  return (
    <div className="space-y-4">
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
            {c} ({countFor(c)})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => (
          <div
            key={p.id}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-foreground/10"
          >
            <Image
              src={hotelImage(p.seed, 480, 360)}
              alt={p.caption}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <p className="text-xs font-medium text-white">{p.caption}</p>
              <p className="text-[11px] text-white/70">{p.category}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
