import { BedDouble } from "lucide-react"

import type { UnitDraft } from "../_lib/types"
import { pkr } from "../_lib/labels"

/** Compact summary of an added unit — name + capacity + bath + price. */
export function UnitRow({ unit }: { unit: UnitDraft }) {
  const beds = unit.beds.twin + unit.beds.full + unit.beds.queen + unit.beds.king
  const bath =
    unit.bathroomPrivate === true
      ? "Private bath"
      : unit.bathroomPrivate === false
        ? "Shared bath"
        : "Bath"

  const meta = [
    `${unit.guests} guests`,
    `${beds} bed${beds === 1 ? "" : "s"}`,
    bath,
    `${pkr(unit.price)}/night`,
  ].join("  ·  ")

  return (
    <div className="bg-muted/40 flex items-center gap-3 rounded-lg border p-3">
      <span className="bg-background flex size-9 shrink-0 items-center justify-center rounded-lg border">
        <BedDouble className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{unit.name || "New unit"}</p>
        <p className="text-muted-foreground truncate text-xs">{meta}</p>
      </div>
    </div>
  )
}
