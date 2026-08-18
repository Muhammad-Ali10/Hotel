import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

/** A pulsing block; the primitive behind every skeleton in the admin panel. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("bg-muted animate-pulse rounded-md", className)}
    />
  )
}

/**
 * Table loading state. Mirrors the real column count so the layout doesn't
 * jump when data arrives.
 */
export function DataTableSkeleton({
  columns = 6,
  rows = 8,
  className,
}: {
  columns?: number
  rows?: number
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("w-full", className)}
    >
      <span className="sr-only">Loading results…</span>
      <div className="border-b px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b px-4 py-3.5 last:border-0">
          <div className="flex items-center gap-4">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn("h-4 flex-1", c === 0 && "max-w-[22%]")}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
    >
      <span className="sr-only">Loading statistics…</span>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} size="sm">
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="border-b pb-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-2 h-3 w-64" />
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-3/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
