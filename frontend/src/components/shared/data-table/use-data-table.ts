"use client"

import * as React from "react"

import type { DataTableState } from "./types"

const DEFAULT_STATE: DataTableState = {
  search: "",
  limit: 25,
  filters: {},
  hiddenColumns: [],
}

/**
 * Owns table state and derives the query the API expects.
 *
 * **Paging is keyset**, which changes the shape of this hook from what a
 * page-number table needs. The server hands back an opaque `nextCursor`; going
 * forward pushes it onto a stack, going back pops one off. That is the only
 * way "previous page" can exist at all against an endpoint that has no notion
 * of an offset — and it is honest: it walks back exactly the pages this
 * session walked forward through.
 *
 * Any change that alters which rows match — a search, a filter, a page size —
 * empties the stack, because a cursor taken against one result set means
 * nothing against another.
 */
export function useDataTable(initial: Partial<DataTableState> = {}) {
  const [state, setState] = React.useState<DataTableState>({
    ...DEFAULT_STATE,
    ...initial,
  })

  /** Cursors already consumed. `[]` means the first page. */
  const [trail, setTrail] = React.useState<string[]>([])
  const [selected, setSelected] = React.useState<string[]>([])

  /**
   * Selection is dropped whenever the matching set changes.
   *
   * Selected ids are only resolvable to records on the page currently loaded,
   * so carrying them across a search or filter would let a bulk action claim
   * "4 selected" while acting on the one row still in view.
   */
  const reset = React.useCallback((next: Partial<DataTableState>) => {
    setState((prev) => ({ ...prev, ...next }))
    setTrail([])
    setSelected([])
  }, [])

  const setSearch = React.useCallback(
    (search: string) => reset({ search }),
    [reset]
  )

  const setLimit = React.useCallback((limit: number) => reset({ limit }), [reset])

  /**
   * One filter key, one value.
   *
   * The admin list endpoints take a single value per parameter; an empty
   * string clears it. A multi-select here could only ever have sent the first
   * value and dropped the rest without saying so.
   */
  const setFilter = React.useCallback(
    (key: string, value: string) =>
      setState((prev) => {
        const filters = { ...prev.filters }
        if (value === "") delete filters[key]
        else filters[key] = value
        setTrail([])
        setSelected([])
        return { ...prev, filters }
      }),
    []
  )

  const toggleColumn = React.useCallback((columnId: string) => {
    setState((prev) => ({
      ...prev,
      hiddenColumns: prev.hiddenColumns.includes(columnId)
        ? prev.hiddenColumns.filter((c) => c !== columnId)
        : [...prev.hiddenColumns, columnId],
    }))
  }, [])

  const clearFilters = React.useCallback(
    () => reset({ search: "", filters: {} }),
    [reset]
  )

  /** Forward, using the cursor the last response handed back. */
  const next = React.useCallback((cursor: string) => {
    setTrail((prev) => [...prev, cursor])
    setSelected([])
  }, [])

  const back = React.useCallback(() => {
    setTrail((prev) => prev.slice(0, -1))
    setSelected([])
  }, [])

  const hasActiveFilters =
    state.search.trim().length > 0 || Object.keys(state.filters).length > 0

  /**
   * The query, memoised so it can be a react-query key without thrashing.
   *
   * `before` is the LAST cursor on the trail — the bookmark for the page being
   * shown. An empty trail sends nothing, which the API reads as "from the top".
   */
  const query = React.useMemo(
    () => ({
      ...(state.search.trim() ? { q: state.search.trim() } : {}),
      ...state.filters,
      limit: state.limit,
      ...(trail.length > 0 ? { before: trail[trail.length - 1] } : {}),
    }),
    [state.search, state.filters, state.limit, trail]
  )

  return {
    state,
    query,
    /** How many pages deep this session has walked. `0` is the first. */
    depth: trail.length,
    hasActiveFilters,
    selected,
    setSelected,
    clearSelection: React.useCallback(() => setSelected([]), []),
    setSearch,
    setLimit,
    setFilter,
    toggleColumn,
    clearFilters,
    next,
    back,
  }
}

export type DataTableController = ReturnType<typeof useDataTable>
