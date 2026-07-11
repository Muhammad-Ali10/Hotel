"use client"

import * as React from "react"
import { Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function UploadPhotosButton() {
  const ref = React.useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        type="file"
        multiple
        accept="image/*"
        ref={ref}
        className="hidden"
        onChange={(e) => {
          const n = e.target.files?.length ?? 0
          if (n) toast.success(`${n} photo(s) uploaded`)
          e.target.value = ""
        }}
      />
      <Button size="sm" onClick={() => ref.current?.click()}>
        <Upload className="size-4" />
        Upload Photos
      </Button>
    </>
  )
}
