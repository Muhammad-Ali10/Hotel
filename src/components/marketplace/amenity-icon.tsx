import {
  Dumbbell,
  Flower2,
  Croissant,
  Martini,
  Sparkles,
  SquareParking,
  TreePalm,
  UtensilsCrossed,
  WavesLadder,
  Wifi,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * One icon per amenity for the whole marketplace. The result card used to draw
 * these as emoji (📶 🏊 💆) while the detail page drew the same amenities as
 * lucide glyphs, so the two screens disagreed about what a pool looks like.
 */
export const amenityIcons: Record<string, LucideIcon> = {
  WiFi: Wifi,
  Pool: WavesLadder,
  Spa: Flower2,
  Gym: Dumbbell,
  Parking: SquareParking,
  Restaurant: UtensilsCrossed,
  Bar: Martini,
  Breakfast: Croissant,
  Beach: TreePalm,
}

export function AmenityIcon({
  amenity,
  className,
}: {
  amenity: string
  className?: string
}) {
  // Read straight from the map — resolving it through a helper call trips the
  // compiler's "component created during render" rule.
  const Icon = amenityIcons[amenity] ?? Sparkles
  return <Icon aria-hidden className={cn("size-3.5 shrink-0", className)} />
}
