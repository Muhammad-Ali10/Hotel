import { properties } from "@/data/extranet"
import { formatCurrency } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"

/** Per-property occupancy + revenue strip on the dashboard. */
export function PropertyStrip() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {properties.map((p) => (
        <Card size="sm" key={p.id}>
          <CardContent className="space-y-3">
            <div>
              <p className="font-heading truncate text-sm font-medium">
                {p.name}
              </p>
              <p className="text-muted-foreground truncate text-xs">{p.city}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold">{p.occupancy}%</span>
                <span className="text-muted-foreground text-xs">occupancy</span>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-foreground h-full rounded-full"
                  style={{ width: `${p.occupancy}%` }}
                />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Revenue Today{" "}
              <span className="text-foreground font-medium">
                {formatCurrency(p.revenueToday)}
              </span>
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
