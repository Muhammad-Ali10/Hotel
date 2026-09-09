import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { PhotoGallery } from "./_components/photo-gallery"
import { UploadPhotosButton } from "./_components/upload-photos-button"

export default function PhotosPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Photos" subtitle="The gallery guests see on your listing">
        <Button variant="outline" size="sm" render={<Link href="/extranet/property" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <UploadPhotosButton />
      </PageHeader>

      <PhotoGallery />
    </div>
  )
}
