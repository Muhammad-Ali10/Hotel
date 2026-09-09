import Link from "next/link"
import { SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Shown when a route resolves an id that no longer exists in the store. */
export function NotFoundCard({
  title,
  description,
  href,
  cta,
}: {
  title: string
  description: string
  href: string
  cta: string
}) {
  return (
    <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <SearchX className="text-muted-foreground size-8" />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Button size="sm" render={<Link href={href}>{cta}</Link>} />
    </div>
  )
}
