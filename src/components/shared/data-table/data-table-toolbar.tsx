"use client"

import * as React from "react"
import { Check, Search, Settings2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

import type { BulkAction, Column, Facet } from "./types"
import type { DataTableController } from "./use-data-table"

/**
 * Search field, faceted filters, column-visibility menu and the bulk-action
 * bar. Rendered by `DataTable`, but exported so screens can slot extra
 * controls (tab filters, "Export", "Invite…") alongside.
 */
export function DataTableToolbar<T>({
  table,
  facets = [],
  columns,
  searchPlaceholder = "Search…",
  bulkActions = [],
  selectedRows,
  children,
  className,
}: {
  table: DataTableController
  facets?: Facet[]
  columns: Column<T>[]
  searchPlaceholder?: string
  bulkActions?: BulkAction<T>[]
  selectedRows: T[]
  children?: React.ReactNode
  className?: string
}) {
  const { state, selected, clearSelection } = table
  const visibleBulkActions = bulkActions.filter((a) => !a.hidden)
  const hideableColumns = columns.filter((c) => c.hideable !== false)

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full min-w-56 sm:w-72">
            <Search
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            />
            <Input
              type="search"
              value={state.search}
              onChange={(e) => table.setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="pl-8"
            />
          </div>

          {facets.map((facet) => (
            <FacetFilter
              key={facet.id}
              facet={facet}
              selected={state.filters[facet.id] ?? []}
              onChange={(values) => table.setFilter(facet.id, values)}
            />
          ))}

          {table.hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={table.clearFilters}>
              Reset
              <X className="size-4" />
            </Button>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
          {hideableColumns.length > 0 ? (
            <ColumnVisibilityMenu
              columns={hideableColumns}
              hidden={state.hiddenColumns}
              onToggle={table.toggleColumn}
            />
          ) : null}
        </div>
      </div>

      {visibleBulkActions.length > 0 && selected.length > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="bg-accent flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
        >
          <span aria-live="polite" className="text-sm font-medium">
            {selected.length} selected
          </span>
          <Separator orientation="vertical" className="mx-1 h-4" />
          {visibleBulkActions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant={action.destructive ? "destructive" : "outline"}
              onClick={() => action.onRun(selected, selectedRows)}
            >
              {action.icon ? <action.icon className="size-4" /> : null}
              {action.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={clearSelection}
          >
            Clear
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function FacetFilter({
  facet,
  selected,
  onChange,
}: {
  facet: Facet
  selected: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="border-dashed">
            {facet.label}
            {selected.length > 0 ? (
              <>
                <Separator orientation="vertical" className="mx-1 h-4" />
                <Badge variant="secondary" className="rounded-sm px-1 text-xs">
                  {selected.length}
                </Badge>
              </>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-56 p-1">
        <div role="group" aria-label={facet.label}>
          {facet.options.map((option) => {
            const isOn = selected.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isOn}
                onClick={() =>
                  onChange(
                    isOn
                      ? selected.filter((v) => v !== option.value)
                      : [...selected, option.value]
                  )
                }
                className="hover:bg-accent focus-visible:ring-ring/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-3"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 items-center justify-center rounded-[4px] border",
                    isOn
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input"
                  )}
                >
                  {isOn ? <Check className="size-3" /> : null}
                </span>
                <span className="flex-1">{option.label}</span>
                {typeof option.count === "number" ? (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {option.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        {selected.length > 0 ? (
          <>
            <Separator className="my-1" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange([])}
            >
              Clear {facet.label.toLowerCase()}
            </Button>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function ColumnVisibilityMenu<T>({
  columns,
  hidden,
  onToggle,
}: {
  columns: Column<T>[]
  hidden: string[]
  onToggle: (id: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Settings2 className="size-4" />
            Columns
          </Button>
        }
      />
      <PopoverContent align="end" className="w-52 p-2">
        <p className="text-muted-foreground px-1 pb-1.5 text-xs font-medium">
          Toggle columns
        </p>
        <div className="space-y-0.5">
          {columns.map((column) => {
            const id = `col-${column.id}`
            return (
              <div
                key={column.id}
                className="hover:bg-accent flex items-center gap-2 rounded-md px-1 py-1"
              >
                <Checkbox
                  id={id}
                  checked={!hidden.includes(column.id)}
                  onCheckedChange={() => onToggle(column.id)}
                />
                <Label htmlFor={id} className="flex-1 text-sm font-normal">
                  {typeof column.header === "string" ? column.header : column.id}
                </Label>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
