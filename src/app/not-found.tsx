import Link from "next/link"
import { Hotel } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
        <Hotel className="size-6" />
      </span>
      <div>
        <p className="font-heading text-5xl font-semibold">404</p>
        <h1 className="font-heading mt-2 text-xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground mt-2 max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Button render={<Link href="/">Back home</Link>} />
        <Button variant="outline" render={<Link href="/hotels">Browse hotels</Link>} />
      </div>
    </div>
  )
}
