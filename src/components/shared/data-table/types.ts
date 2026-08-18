import type * as React from "react"
import type { SortDirection } from "@/lib/admin/api/transport"

export type { SortDirection }

export type ColumnAlign = "left" | "center" | "right"

export type Column<T> = {
  /** Stable key; also the sort key sent to the API. */
  id: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  sortable?: boolean
  align?: ColumnAlign
  className?: string
  headerClassName?: string
  /**
   * Hide the column below this breakpoint. Admin is desktop-first, so wide
   * tables shed low-value columns on tablets rather than scrolling forever.
   */
  hideBelow?: "sm" | "md" | "lg" | "xl"
  /** Excluded from the column-visibility menu when false. */
  hideable?: boolean
}

export type FacetOption = {
  label: string
  value: string
  count?: number
}

export type Facet = {
  /** Filter key sent to the API. */
  id: string
  label: string
  options: FacetOption[]
}

export type DataTableState = {
  search: string
  page: number
  pageSize: number
  sortBy?: string
  sortDir: SortDirection
  filters: Record<string, string[]>
  hiddenColumns: string[]
}

export type BulkAction<T> = {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  destructive?: boolean
  /** Receives the selected row ids; the caller resolves them to records. */
  onRun: (ids: string[], rows: T[]) => void
  /** Hide the action entirely when the current role can't perform it. */
  hidden?: boolean
}
