"use client"

import * as React from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const options = [
  { value: "recommended", label: "Recommended" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
  { value: "reviews", label: "Most Reviewed" },
]

export function SortSelect() {
  const [value, setValue] = React.useState("recommended")

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm whitespace-nowrap">
        Sort by:
      </span>
      <Select value={value} onValueChange={(v) => setValue(v as string)}>
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
