"use client"

import * as React from "react"

import { valueAddCategories, valueAdds } from "@/data/extranet"
import { cn } from "@/lib/utils"
import { StatusPill } from "@/components/extranet/shared"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function ValueAddsGrid() {
  const [filter, setFilter] = React.useState("All")
  const list =
    filter === "All" ? valueAdds : valueAdds.filter((v) => v.category === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {valueAddCategories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              filter === c
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((v) => (
          <Card key={v.id}>
            <CardContent className="flex h-full flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">{v.category}</Badge>
                <StatusPill status={v.status} />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading text-base font-semibold">
                  {v.name}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {v.description}
                </p>
              </div>
              <p className="font-heading mt-auto text-lg font-semibold">
                {v.price}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
