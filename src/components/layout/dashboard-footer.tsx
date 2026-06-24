import Link from "next/link"
import { Hotel } from "lucide-react"

import { siteConfig } from "@/config/site"

export function DashboardFooter() {
  return (
    <footer className="bg-muted/40 border-t">
      <div className="mx-auto max-w-[1700px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
              <Hotel className="size-4" />
            </span>
            <span className="font-heading font-semibold">{siteConfig.name}</span>
          </Link>
          <p className="text-muted-foreground text-sm">
            © 2026 {siteConfig.name}. All rights reserved.
          </p>
          <p className="text-muted-foreground text-sm">Made with luxury in mind</p>
        </div>
      </div>
    </footer>
  )
}
