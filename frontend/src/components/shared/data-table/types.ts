import type * as React from "react"

export type ColumnAlign = "left" | "center" | "right"

export type Column<T> = {
  /** Stable key, used for column visibility. */
  id: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
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

/**
 * A filter the SERVER can apply.
 *
 * Single-select, not multi: these map to one query parameter each, and the
 * admin list endpoints take one value. A multi-select control over a
 * single-value parameter can only have sent the first one and silently
 * dropped the rest.
 */
export type Facet = {
  /** Query parameter name sent to the API. */
  id: string
  label: string
  options: FacetOption[]
}

/**
 * Table state, as the API can actually serve it.
 *
 * There is no page number and no sort key, and both absences are deliberate:
 *
 *   - **paging is keyset.** `cursor` is an opaque bookmark the server hands
 *     back. "Page 7" would mean counting six pages of rows nobody looked at,
 *     and the answer would shift under anybody making a booking meanwhile.
 *   - **the admin list endpoints do not sort.** They return newest first,
 *     which is what these screens are for. A sortable header that reorders
 *     only the fifty rows already loaded is a lie the moment there are more
 *     than fifty.
 */
export type DataTableState = {
  search: string
  limit: number
  filters: Record<string, string>
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
