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
 * "Showing 1–10 of 14" plus page controls. Page numbers are windowed so a
 * 400-row table never renders 40 buttons.
 */
export function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  className?: string
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p aria-live="polite" className="text-muted-foreground text-sm">
        Showing <span className="text-foreground font-medium">{first}</span>–
        <span className="text-foreground font-medium">{last}</span> of{" "}
        <span className="text-foreground font-medium">{total}</span>
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange ? (
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-muted-foreground text-sm">Rows</span>
            <Select
              items={PAGE_SIZES.map((n) => ({ label: String(n), value: String(n) }))}
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger size="sm" aria-label="Rows per page">
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
            size="icon-sm"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>

          {pageWindow(page, pageCount).map((entry, i) =>
            entry === "…" ? (
              <span
                key={`gap-${i}`}
                aria-hidden
                className="text-muted-foreground px-1 text-sm"
              >
                …
              </span>
            ) : (
              <Button
                key={entry}
                variant={entry === page ? "default" : "ghost"}
                size="icon-sm"
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? "page" : undefined}
                onClick={() => onPageChange(entry)}
              >
                {entry}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </nav>
  )
}

/** Up to 7 slots: first, last, the current neighbourhood, and ellipses. */
function pageWindow(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)

  const out: (number | "…")[] = []
  let previous = 0
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push("…")
    out.push(p)
    previous = p
  }
  return out
}
