"use client"

import * as React from "react"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { photosApi } from "@/lib/api/endpoints"
import { keys } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { Button } from "@/components/ui/button"

/**
 * A real upload (rule #73).
 *
 * Three steps, and the middle one does not touch this API at all:
 *
 *   1. ask for a presigned URL — the server checks the type and the size
 *      BEFORE handing one out, so a 40MB file is refused in a round trip
 *   2. PUT the bytes straight at storage
 *   3. confirm, which is what creates the row
 *
 * A file that was never confirmed is an abandoned upload and simply is not a
 * photo. And a new photo is born `pending`: it does not appear on the public
 * listing until the platform has looked at it.
 *
 * The button used to invent a placeholder image from the file's NAME and add
 * it to a browser store — so a partner uploaded a photo of their lobby and
 * their listing showed a stock picture of somewhere else.
 */
export function UploadPhotosButton() {
  const ref = React.useRef<HTMLInputElement>(null)
  const { active } = useActiveProperty()
  const client = useQueryClient()
  const [busy, setBusy] = React.useState(false)

  async function uploadOne(propertyId: string, file: File) {
    const signed = await photosApi.uploadUrl(propertyId, {
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    })

    const response = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: file,
    })
    if (!response.ok) {
      throw new Error(`Upload failed for ${file.name}`)
    }

    await photosApi.confirm(propertyId, {
      key: signed.key,
      caption: file.name.replace(/\.[^.]+$/, ""),
    })
  }

  return (
    <>
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        ref={ref}
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ""
          if (!active || files.length === 0) return

          setBusy(true)
          let uploaded = 0
          const failures: string[] = []

          /*
           * One at a time, and a failure does not stop the rest.
           *
           * Ten files in parallel is ten presign calls and ten uploads racing
           * each other into the photo limit; sequential is slower and is what
           * a partner actually wants when three of the ten are rejected.
           */
          for (const file of files) {
            try {
              await uploadOne(active.id, file)
              uploaded += 1
            } catch (error) {
              failures.push(error instanceof Error ? error.message : file.name)
            }
          }

          void client.invalidateQueries({ queryKey: keys.listing(active.id) })
          void client.invalidateQueries({ queryKey: keys.listingScore(active.id) })
          setBusy(false)

          if (uploaded > 0) {
            toast.success(
              `${uploaded} ${uploaded === 1 ? "photo" : "photos"} uploaded`,
              { description: "They go live once the platform has reviewed them." }
            )
          }
          if (failures.length > 0) {
            toast.error(`${failures.length} could not be uploaded`, {
              description: failures[0],
            })
          }
        }}
      />
      <Button size="sm" onClick={() => ref.current?.click()} disabled={!active || busy}>
        <Upload className="size-4" />
        {busy ? "Uploading…" : "Upload Photos"}
      </Button>
    </>
  )
}
