import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { photos } from "@/data/extranet"
import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { PhotoGallery } from "./_components/photo-gallery"
import { UploadPhotosButton } from "./_components/upload-photos-button"

export default function PhotosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Photos"
        subtitle={`Photo gallery and media assets · ${photos.length} photos`}
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/property" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <UploadPhotosButton />
      </PageHeader>

      <PhotoGallery />
    </div>
  )
}
