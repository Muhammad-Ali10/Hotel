"use client"

import { Heart } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { useStore } from "@/store"
import { useIsFavorite } from "@/store/selectors"
import { Button } from "@/components/ui/button"

/**
 * The only way a hotel gets into Favorites. The dashboard has had a Favorites
 * screen from the start, but nothing on the public site could put anything in
 * it — this button closes that loop.
 */
export function FavoriteButton({
  hotelId,
  hotelName,
  className,
  variant = "secondary",
}: {
  hotelId: string
  hotelName: string
  className?: string
  variant?: "secondary" | "outline" | "ghost"
}) {
  const saved = useIsFavorite(hotelId)
  const toggleFavorite = useStore((s) => s.toggleFavorite)

  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${hotelName} from favourites` : `Save ${hotelName} to favourites`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite(hotelId)
        toast.success(saved ? "Removed from favourites" : "Saved to favourites")
      }}
      className={cn("size-9 rounded-full shadow-sm backdrop-blur", className)}
    >
      <Heart className={cn("size-4 transition-colors", saved && "fill-rose-500 text-rose-500")} />
    </Button>
  )
}
