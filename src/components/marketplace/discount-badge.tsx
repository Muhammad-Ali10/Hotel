import { Sparkles } from "lucide-react"

import type { Discount } from "@/types"
import { formatDiscount } from "@/lib/domain"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

/**
 * Renders any discount the partner can create — percent off, an amount off, or
 * a free night. The label used to be a hand-written string that cards parsed
 * with a regex, so anything other than "15% OFF" rendered nonsense.
 */
export function DiscountBadge({
  discount,
  className,
}: {
  discount: Discount
  className?: string
}) {
  return (
    <Badge className={cn("gap-1", className)}>
      <Sparkles className="size-3" />
      {formatDiscount(discount)}
    </Badge>
  )
}
