"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState, ErrorState } from "@/components/shared/states"

import { DataTablePagination } from "./data-table-pagination"
import { DataTableSkeleton } from "./data-table-skeleton"
import { DataTableToolbar } from "./data-table-toolbar"
import type { BulkAction, Column, Facet } from "./types"
import type { DataTableController } from "./use-data-table"

const HIDE_BELOW: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
}

const ALIGN = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const

export type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  total: number
  getRowId: (row: T) => string
  table: DataTableController
  /** Accessible summary of the table's contents. Visually hidden. */
  caption: string
  isLoading?: boolean
  isFetching?: boolean
  error?: { message?: string } | null
  onRetry?: () => void
  facets?: Facet[]
  searchPlaceholder?: string
  bulkActions?: BulkAction<T>[]
  /** Makes rows clickable; keyboard users get the same target via the cell link. */
  rowHref?: (row: T) => string
  emptyTitle?: string
  emptyDescription?: React.ReactNode
  emptyAction?: React.ReactNode
  /** Extra controls rendered on the toolbar's right side. */
  toolbarActions?: React.ReactNode
  /** Rendered above the toolbar — status tabs, stat tiles, callouts. */
  children?: React.ReactNode
  className?: string
}

/**
 * The admin panel's table. Sorting, search, faceted filters, pagination and
 * bulk selection are all driven by `useDataTable` and executed by the API, so
 * the component never holds more than one page of rows.
 *
 * Handles its own loading, empty and error states — screens don't repeat them.
 */
export function DataTable<T>({
  columns,
  rows,
  total,
  getRowId,
  table,
  caption,
  isLoading,
  isFetching,
  error,
  onRetry,
  facets,
  searchPlaceholder,
  bulkActions = [],
  rowHref,
  emptyTitle,
  emptyDescription,
  emptyAction,
  toolbarActions,
  children,
  className,
}: DataTableProps<T>) {
  const router = useRouter()
  const { state, selected, setSelected } = table

  const visibleColumns = columns.filter(
    (c) => !state.hiddenColumns.includes(c.id)
  )
  const selectable = bulkActions.some((a) => !a.hidden)

  const pageIds = rows.map(getRowId)
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.includes(id))
  const someOnPageSelected =
    pageIds.some((id) => selected.includes(id)) && !allOnPageSelected

  const selectedRows = rows.filter((row) => selected.includes(getRowId(row)))

  /**
   * A mutation can shrink the result set out from under the current page —
   * restore the last suspended guest while filtering by Suspended and page 2
   * empties out. `total` still reports the matching rows, so an empty page with
   * a non-zero total means the page number is stale, not that nothing matched.
   * Recovering must return to a valid page, not discard the user's filter.
   */
  const pageCount = Math.max(1, Math.ceil(total / state.pageSize))
  const pageOutOfRange = rows.length === 0 && total > 0 && state.page > 1

  function toggleAllOnPage() {
    setSelected((prev) =>
      allOnPageSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : [...new Set([...prev, ...pageIds])]
    )
  }

  function toggleRow(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const columnCount = visibleColumns.length + (selectable ? 1 : 0)

  return (
    <div className={cn("space-y-4", className)}>
      {children}

      <DataTableToolbar
        table={table}
        facets={facets}
        columns={columns}
        searchPlaceholder={searchPlaceholder}
        bulkActions={bulkActions}
        selectedRows={selectedRows}
      >
        {toolbarActions}
      </DataTableToolbar>

      <div className="bg-card overflow-hidden rounded-xl border">
        {error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : isLoading ? (
          <DataTableSkeleton columns={columnCount} rows={state.pageSize > 10 ? 10 : state.pageSize} />
        ) : pageOutOfRange ? (
          <EmptyState
            title="Nothing on this page"
            description={`${total} ${total === 1 ? "record matches" : "records match"} your filters, but page ${state.page} is now empty.`}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.setPage(pageCount)}
              >
                Go to page {pageCount}
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            filtered={table.hasActiveFilters}
            onClearFilters={table.clearFilters}
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
          />
        ) : (
          <>
            <div
              className={cn(
                "transition-opacity",
                isFetching && "pointer-events-none opacity-60"
              )}
            >
              <Table>
                <TableCaption className="sr-only">{caption}</TableCaption>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    {selectable ? (
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={allOnPageSelected}
                          indeterminate={someOnPageSelected}
                          onCheckedChange={toggleAllOnPage}
                          aria-label={
                            allOnPageSelected
                              ? "Deselect all rows on this page"
                              : "Select all rows on this page"
                          }
                        />
                      </TableHead>
                    ) : null}

                    {visibleColumns.map((column, i) => {
                      const isSorted = state.sortBy === column.id
                      return (
                        <TableHead
                          key={column.id}
                          scope="col"
                          aria-sort={
                            column.sortable
                              ? isSorted
                                ? state.sortDir === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                              : undefined
                          }
                          className={cn(
                            "text-muted-foreground h-10 text-xs font-medium tracking-wide uppercase",
                            i === 0 && !selectable && "pl-4",
                            i === visibleColumns.length - 1 && "pr-4",
                            column.align && ALIGN[column.align],
                            column.hideBelow && HIDE_BELOW[column.hideBelow],
                            column.headerClassName
                          )}
                        >
                          {column.sortable ? (
                            <button
                              type="button"
                              onClick={() => table.toggleSort(column.id)}
                              className={cn(
                                "hover:text-foreground focus-visible:ring-ring/50 -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 outline-none focus-visible:ring-3",
                                isSorted && "text-foreground",
                                column.align === "right" && "flex-row-reverse"
                              )}
                            >
                              {column.header}
                              {isSorted ? (
                                state.sortDir === "asc" ? (
                                  <ArrowUp aria-hidden className="size-3.5" />
                                ) : (
                                  <ArrowDown aria-hidden className="size-3.5" />
                                )
                              ) : (
                                <ChevronsUpDown
                                  aria-hidden
                                  className="size-3.5 opacity-40"
                                />
                              )}
                            </button>
                          ) : (
                            column.header
                          )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rows.map((row) => {
                    const id = getRowId(row)
                    const href = rowHref?.(row)
                    const isSelected = selected.includes(id)
                    return (
                      <TableRow
                        key={id}
                        data-state={isSelected ? "selected" : undefined}
                        className={cn(href && "cursor-pointer")}
                        onClick={
                          href
                            ? (e) => {
                                // Let interactive cell content win the click.
                                if (
                                  (e.target as HTMLElement).closest(
                                    "a,button,input,[role=button]"
                                  )
                                ) {
                                  return
                                }
                                router.push(href)
                              }
                            : undefined
                        }
                      >
                        {selectable ? (
                          <TableCell className="pl-4">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleRow(id)}
                              aria-label={`Select ${id}`}
                            />
                          </TableCell>
                        ) : null}

                        {visibleColumns.map((column, i) => (
                          <TableCell
                            key={column.id}
                            className={cn(
                              "py-3",
                              i === 0 && !selectable && "pl-4",
                              i === visibleColumns.length - 1 && "pr-4",
                              column.align && ALIGN[column.align],
                              column.hideBelow && HIDE_BELOW[column.hideBelow],
                              column.className
                            )}
                          >
                            {column.cell(row)}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <DataTablePagination
              page={state.page}
              pageSize={state.pageSize}
              total={total}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          </>
        )}
      </div>
    </div>
  )
}
