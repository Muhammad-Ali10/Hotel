"use client"

import * as React from "react"
import { Upload } from "lucide-react"
import { toast } from "sonner"

import type { Photo } from "@/types"
import { useStore } from "@/store"
import { useActiveHotel } from "@/store/selectors"
import { Button } from "@/components/ui/button"

/**
 * Adds the selected files to the property's gallery.
 *
 * There is no upload target in this build, so each file's image is picked
 * deterministically from its name — but it becomes a real gallery entry: it
 * shows on the public listing, can be reordered, and can be made the hero. The
 * button used to toast "N photo(s) uploaded" and add nothing.
 */
export function UploadPhotosButton() {
  const ref = React.useRef<HTMLInputElement>(null)
  const hotel = useActiveHotel()
  const updatePhotos = useStore((s) => s.updatePhotos)

  return (
    <>
      <input
        type="file"
        multiple
        accept="image/*"
        ref={ref}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ""
          if (!hotel || files.length === 0) return

          const added: Photo[] = files.map((file, i) => ({
            id: `${hotel.seed}-upload-${hotel.photos.length + i + 1}`,
            category: "Interior",
            caption: file.name.replace(/\.[^.]+$/, ""),
            seed: `${hotel.seed}-${file.name}-${hotel.photos.length + i}`,
          }))

          updatePhotos(hotel.id, [...hotel.photos, ...added])
          toast.success(
            `${added.length} ${added.length === 1 ? "photo" : "photos"} added to your listing.`
          )
        }}
      />
      <Button size="sm" onClick={() => ref.current?.click()} disabled={!hotel}>
        <Upload className="size-4" />
        Upload Photos
      </Button>
    </>
  )
}
