import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/** One row of the "Set up your property" checklist (steps 13, 20, 30). */
export function HubStep({
  index,
  done = false,
  active = false,
  locked = false,
  title,
  badge,
  description,
  action,
  children,
}: {
  index: number
  done?: boolean
  active?: boolean
  locked?: boolean
  title: string
  badge?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        active ? "border-primary ring-primary/15 ring-2" : "bg-card",
        locked && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium",
            done
              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          {done ? <Check className="size-4" /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{title}</p>
            {badge}
          </div>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
          )}
          {children}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
