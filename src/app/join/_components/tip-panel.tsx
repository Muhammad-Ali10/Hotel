"use client"

import * as React from "react"
import { Lightbulb, X } from "lucide-react"

import { cn } from "@/lib/utils"

/** The dismissible advisory card shown beside most wizard steps. */
export function TipPanel({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = React.useState(true)
  if (!open) return null

  return (
    <div
      className={cn(
        "bg-muted/40 relative rounded-xl border p-4 sm:p-5",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss tip"
        className="text-muted-foreground hover:text-foreground absolute top-3 right-3 transition-colors"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className="bg-background flex size-8 shrink-0 items-center justify-center rounded-full border">
          <Lightbulb className="size-4" />
        </span>
        <div className="min-w-0 pr-4">
          <h3 className="font-heading text-sm font-semibold">{title}</h3>
          <div className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
