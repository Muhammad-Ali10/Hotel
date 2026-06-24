import Link from "next/link"
import { Hotel } from "lucide-react"

import { siteConfig } from "@/config/site"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-muted/30 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
          <Hotel className="size-5" />
        </span>
        <span className="font-heading text-xl font-semibold tracking-tight">
          {siteConfig.name}
        </span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="text-muted-foreground mt-8 text-center text-xs">
        © 2026 {siteConfig.name}. All rights reserved.
      </p>
    </div>
  )
}
