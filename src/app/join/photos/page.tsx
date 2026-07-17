"use client"

import * as React from "react"
import Image from "next/image"
import { ImagePlus, Camera, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { hotelImage } from "@/lib/images"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { useWizard } from "../_components/wizard-provider"

export default function PropertyPhotosPage() {
  const { data, update } = useWizard()
  const [count, setCount] = React.useState(data.photos)

  // Demo upload — each "Add photo" drops in a themed placeholder shot.
  const add = () => setCount((c) => c + 1)
  const remove = () => setCount((c) => Math.max(0, c - 1))

  const tiles = Array.from({ length: count })

  return (
    <WizardShell
      aside={
        <TipPanel title="Photos sell the stay">
          Properties with at least 8 high-quality photos get 4x more bookings.
          Use natural lighting, shoot in landscape orientation, and capture every
          room type plus the exterior. Avoid filters — guests want to see the
          real thing. Minimum resolution is 1024×768.
        </TipPanel>
      }
    >
      <StepHeading
        title="Property photos"
        description="High-quality photos help guests imagine their stay. Upload at least 4 photos for the best results."
      />

      {count === 0 ? (
        <div className="bg-muted/40 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-14 text-center">
          <span className="bg-background flex size-12 items-center justify-center rounded-full border">
            <Camera className="text-muted-foreground size-6" />
          </span>
          <div>
            <p className="text-sm font-medium">No photos yet</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-xs">
              Add photos of your property exterior, rooms, amenities, and
              surroundings
            </p>
          </div>
          <Button onClick={add} className="mt-1">
            <ImagePlus className="size-4" />
            Add first photo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((_, i) => (
            <div key={i} className="group relative aspect-4/3 overflow-hidden rounded-lg border">
              <Image
                src={hotelImage(`join-photo-${i}`, 400, 300)}
                alt={`Property photo ${i + 1}`}
                fill
                sizes="(max-width: 640px) 50vw, 200px"
                className="object-cover"
              />
              <button
                type="button"
                onClick={remove}
                aria-label="Remove photo"
                className="bg-background/90 absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full border opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={add}
            className="hover:bg-muted/40 text-muted-foreground flex aspect-4/3 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-xs transition-colors"
          >
            <ImagePlus className="size-5" />
            Add photo
          </button>
        </div>
      )}

      <StepNav slug="photos" onContinue={() => update({ photos: count })} />
    </WizardShell>
  )
}
