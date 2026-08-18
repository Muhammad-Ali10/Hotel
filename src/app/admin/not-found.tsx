import Link from "next/link"
import { FileQuestion } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <span
        aria-hidden
        className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full"
      >
        <FileQuestion className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="font-heading text-base font-semibold">
          We couldn&rsquo;t find that record
        </p>
        <p className="text-muted-foreground mx-auto max-w-md text-sm">
          It may have been removed, or the link may be out of date.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/admin">Back to dashboard</Link>}
      />
    </div>
  )
}
