"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/** A selectable card/tile with a ring + check when active. Used anywhere the
 *  wizard asks the partner to pick one (or several) options. */
export function SelectCard({
  selected,
  onSelect,
  children,
  className,
  showCheck = false,
}: {
  selected: boolean
  onSelect: () => void
  children: React.ReactNode
  className?: string
  showCheck?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-primary ring-primary/20 bg-primary/[0.03] ring-2"
          : "hover:border-foreground/30 hover:bg-muted/40",
        className,
      )}
    >
      {showCheck && selected && (
        <span className="bg-primary text-primary-foreground absolute top-3 right-3 flex size-5 items-center justify-center rounded-full">
          <Check className="size-3" />
        </span>
      )}
      {children}
    </button>
  )
}
