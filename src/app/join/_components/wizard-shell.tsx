import * as React from "react"

import { cn } from "@/lib/utils"

/** Outer layout for a wizard step: a centered content column with an optional
 *  advisory panel to its right (stacks below on small screens). */
export function WizardShell({
  children,
  aside,
  className,
}: {
  children: React.ReactNode
  aside?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 md:py-12 lg:flex-row lg:items-start lg:justify-center lg:gap-8",
        className,
      )}
    >
      <div className="w-full max-w-xl">{children}</div>
      {aside && <aside className="w-full lg:max-w-xs">{aside}</aside>}
    </div>
  )
}

export function StepHeading({
  title,
  description,
}: {
  title: string
  description?: React.ReactNode
}) {
  return (
    <div className="mb-6 space-y-1.5">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      )}
    </div>
  )
}
