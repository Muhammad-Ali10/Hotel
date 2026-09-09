import { Star } from "lucide-react"

import { cn } from "@/lib/utils"

export function StarRating({
  rating,
  className,
  size = "size-4",
}: {
  rating: number
  className?: string
  size?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            size,
            i < Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </span>
  )
}
