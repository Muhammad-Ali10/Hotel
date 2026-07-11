import { cn } from "@/lib/utils"
import { Breadcrumbs } from "./breadcrumbs"

/**
 * Standard page heading used at the top of every extranet screen:
 * a Figma-style "Dashboard / Section / Page" breadcrumb, then the
 * title + subtitle on the left with action buttons (children) on the right.
 */
export function PageHeader({
  title,
  subtitle,
  children,
  className,
  showBreadcrumbs = true,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
  className?: string
  showBreadcrumbs?: boolean
}) {
  return (
    <div className="space-y-3">
      {showBreadcrumbs ? <Breadcrumbs /> : null}
      <div
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
          className
        )}
      >
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          ) : null}
        </div>
        {children ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}
