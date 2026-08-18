"use client"

import * as React from "react"

import type { ListParams } from "@/lib/admin/api/transport"
import type { DataTableState } from "./types"

const DEFAULT_STATE: DataTableState = {
  search: "",
  page: 1,
  pageSize: 10,
  sortDir: "asc",
  filters: {},
  hiddenColumns: [],
}

/**
 * Owns table state and derives the `ListParams` the API expects.
 *
 * Any change that alters which rows match (search, filter, sort, page size)
 * resets to page 1, so the user is never stranded on an out-of-range page.
 */
export function useDataTable(initial: Partial<DataTableState> = {}) {
  const [state, setState] = React.useState<DataTableState>({
    ...DEFAULT_STATE,
    ...initial,
  })
  const [selected, setSelected] = React.useState<string[]>([])

  const patch = React.useCallback(
    (next: Partial<DataTableState>, resetPage = true) => {
      setState((prev) => ({ ...prev, ...next, ...(resetPage ? { page: 1 } : {}) }))
    },
    []
  )

  /**
   * Selection is dropped whenever the matching set changes.
   *
   * Selected ids are only resolvable to records on the page currently loaded,
   * so carrying them across a search, filter or sort would let a bulk action
   * claim "4 selected" while acting on the one row still in view. Clearing is
   * the honest behaviour — the alternative is fetching every matching row just
   * to keep a selection alive.
   */
  const patchAndClearSelection = React.useCallback(
    (next: Partial<DataTableState>) => {
      patch(next)
      setSelected([])
    },
    [patch]
  )

  const setSearch = React.useCallback(
    (search: string) => patchAndClearSelection({ search }),
    [patchAndClearSelection]
  )

  /** Paging keeps the page's own selection semantics: leaving a page clears it. */
  const setPage = React.useCallback(
    (page: number) => {
      patch({ page }, false)
      setSelected([])
    },
    [patch]
  )

  const setPageSize = React.useCallback(
    (pageSize: number) => patchAndClearSelection({ pageSize }),
    [patchAndClearSelection]
  )

  /** Click a sortable header: asc → desc → asc on the same column. */
  const toggleSort = React.useCallback((columnId: string) => {
    setState((prev) => ({
      ...prev,
      page: 1,
      sortBy: columnId,
      sortDir:
        prev.sortBy === columnId && prev.sortDir === "asc" ? "desc" : "asc",
    }))
    setSelected([])
  }, [])

  const setFilter = React.useCallback((key: string, values: string[]) => {
    setState((prev) => ({
      ...prev,
      page: 1,
      filters: { ...prev.filters, [key]: values },
    }))
    setSelected([])
  }, [])

  const toggleColumn = React.useCallback((columnId: string) => {
    setState((prev) => ({
      ...prev,
      hiddenColumns: prev.hiddenColumns.includes(columnId)
        ? prev.hiddenColumns.filter((c) => c !== columnId)
        : [...prev.hiddenColumns, columnId],
    }))
  }, [])

  const clearFilters = React.useCallback(() => {
    setState((prev) => ({ ...prev, page: 1, search: "", filters: {} }))
    setSelected([])
  }, [])

  const hasActiveFilters =
    state.search.trim().length > 0 ||
    Object.values(state.filters).some((v) => v.length > 0)

  /** Memoised so it can be a react-query key without thrashing the cache. */
  const params = React.useMemo<ListParams>(
    () => ({
      search: state.search,
      page: state.page,
      pageSize: state.pageSize,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
      filters: state.filters,
    }),
    [
      state.search,
      state.page,
      state.pageSize,
      state.sortBy,
      state.sortDir,
      state.filters,
    ]
  )

  return {
    state,
    params,
    hasActiveFilters,
    selected,
    setSelected,
    clearSelection: React.useCallback(() => setSelected([]), []),
    setSearch,
    setPage,
    setPageSize,
    toggleSort,
    setFilter,
    toggleColumn,
    clearFilters,
  }
}

export type DataTableController = ReturnType<typeof useDataTable>
