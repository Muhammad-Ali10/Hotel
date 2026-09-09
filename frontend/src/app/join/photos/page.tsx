"use client"

import * as React from "react"
import Image from "next/image"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  useRemoveRegistrationFile,
  useUploadRegistrationFile,
} from "@/lib/api/hooks"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { useWizard } from "../_components/wizard-provider"

/* ============================================================================
 * Step 9 — the listing photographs.
 *
 * This screen used to be a counter. "Add photo" incremented a number and drew
 * a placeholder from a stock service; the file picker was never opened, and
 * `photos: 4` was written into a draft nothing read. A property approved from
 * this application went live with an empty gallery.
 *
 * They are real uploads now, on the same path as everything else: the server
 * checks type and size before handing out a URL, the bytes go straight to
 * storage, and a confirm call is what creates the row. Approval carries them
 * across to the property as its gallery (rule #103).
 *
 * There is no reordering here. Position follows upload order, and the extranet
 * has a proper gallery editor for the day after approval — a drag handle on
 * this screen would be a second, worse one.
 * ========================================================================== */

const RECOMMENDED = 4
const ACCEPT = "image/jpeg,image/png,image/webp"

export default function PhotosPage() {
  const { photos } = useWizard()
  const input = React.useRef<HTMLInputElement>(null)
  const upload = useUploadRegistrationFile()
  const remove = useRemoveRegistrationFile()
  const [busy, setBusy] = React.useState(false)

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (files.length === 0) return

    setBusy(true)
    let uploaded = 0
    const failures: string[] = []

    /*
     * One at a time. Ten files in parallel is ten presign calls racing each
     * other into the same limit, and the partner cannot tell which three of
     * the ten were the ones refused.
     */
    for (const file of files) {
      try {
        await upload.mutateAsync({ file, kind: "photo" })
        uploaded += 1
      } catch (error) {
        failures.push(error instanceof Error ? error.message : file.name)
      }
    }

    setBusy(false)
    if (uploaded > 0) {
      toast.success(`${uploaded} ${uploaded === 1 ? "photo" : "photos"} added`)
    }
    if (failures.length > 0) {
      toast.error(`${failures.length} couldn't be uploaded`, { description: failures[0] })
    }
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="What to photograph">
          The room a guest will sleep in, first — it is the one thing they are
          buying. Then the outside, the bathroom, and wherever breakfast
          happens. Daylight, curtains open, nothing tidied out of frame that
          will be there when they arrive.
        </TipPanel>
      }
    >
      <StepHeading
        title="Property photos"
        description="These become your listing's gallery the moment your application is approved."
      />

      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <ImagePlus className="text-muted-foreground size-8" />
          <div>
            <p className="text-sm font-medium">No photos yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              At least one is needed. {RECOMMENDED} or more is what a guest
              expects to see before booking.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <div key={photo.id} className="group relative aspect-4/3 overflow-hidden rounded-lg border">
              {photo.url ? (
                <Image
                  src={photo.url}
                  alt={photo.fileName}
                  fill
                  sizes="(min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="bg-muted size-full" />
              )}

              {index === 0 && (
                <span className="bg-background/90 absolute top-2 left-2 rounded px-1.5 py-0.5 text-[11px] font-medium">
                  Cover
                </span>
              )}

              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => remove.mutate(photo.id)}
                disabled={remove.isPending}
                aria-label={`Remove ${photo.fileName}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={onPick}
      />

      <div className="mt-4 flex items-center gap-3">
        <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {busy ? "Uploading…" : "Add photos"}
        </Button>
        <p className="text-muted-foreground text-sm">
          {photos.length} added
          {photos.length > 0 && photos.length < RECOMMENDED
            ? ` — ${RECOMMENDED - photos.length} more is the usual minimum`
            : ""}
        </p>
      </div>

      {/*
        No save call. A photo is a row the moment it is confirmed, so there is
        nothing on this screen waiting to be written — Continue only moves on.
      */}
      <StepNav slug="photos" nextDisabled={busy} />
    </WizardShell>
  )
}
