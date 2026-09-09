"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PAGE_SIZES = [10, 25, 50, 100]

/**
 * Keyset paging, said honestly.
 *
 * There is no "of 47" here and no page numbers, because the API does not know
 * either. Counting every matching row to print a total is a second query over
 * the whole table on every keystroke, and the number is stale by the time it
 * renders — somebody makes a booking and "of 47" was never true.
 *
 * What IS true: how many rows are on screen, how deep this session has walked,
 * and whether the server said there are more. That is what it shows.
 */
export function DataTablePagination({
  shown,
  limit,
  depth,
  hasMore,
  onNext,
  onBack,
  onLimitChange,
  className,
}: {
  /** Rows on this page. */
  shown: number
  limit: number
  /** Pages already walked. `0` is the first page. */
  depth: number
  hasMore: boolean
  onNext: () => void
  onBack: () => void
  onLimitChange?: (limit: number) => void
  className?: string
}) {
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p aria-live="polite" className="text-muted-foreground text-sm">
        Showing <span className="text-foreground font-medium">{shown}</span>
        {depth > 0 ? (
          <>
            {" "}
            · page{" "}
            <span className="text-foreground font-medium">{depth + 1}</span>
          </>
        ) : null}
        {hasMore ? " · more available" : null}
      </p>

      <div className="flex items-center gap-3">
        {onLimitChange ? (
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-muted-foreground text-sm">Rows</span>
            <Select
              items={PAGE_SIZES.map((n) => ({ label: String(n), value: String(n) }))}
              value={String(limit)}
              onValueChange={(value) => onLimitChange(Number(value))}
            >
              <SelectTrigger size="sm" className="w-[84px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={depth === 0}
            onClick={onBack}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={onNext}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </nav>
  )
}
