"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type SortKey = "recommended" | "price-asc" | "price-desc" | "rating"

const options: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
]

/** Controlled by the browser above — the old select held its own state and
 *  sorted nothing. */
export function SortSelect({
  value,
  onChange,
}: {
  value: SortKey
  onChange: (value: SortKey) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm whitespace-nowrap">Sort by:</span>
      {/* `items` is required for the closed trigger to render the label rather
          than the raw value (Base UI Select). */}
      <Select items={options} value={value} onValueChange={(v) => onChange(v as SortKey)}>
        <SelectTrigger className="min-w-44" size="default">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
