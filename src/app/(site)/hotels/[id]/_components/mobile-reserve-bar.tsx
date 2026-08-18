"use client"

import type { Room } from "@/types"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"

/**
 * Mobile-only booking bar. `ReserveCard` is `lg:sticky`, so on a phone it sits
 * below About, Rooms, Amenities, House Rules, Reviews and Location — the guest
 * had to scroll the entire page to find any way to book.
 */
export function MobileReserveBar({ room }: { room: Room | undefined }) {
  if (!room) return null

  function scrollToReserve() {
    document
      .getElementById("reserve")
      ?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/85 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{room.name}</p>
          <p>
            <span className="font-heading text-lg font-semibold">
              {formatCurrency(room.pricePerNight)}
            </span>
            <span className="text-muted-foreground text-sm"> / night</span>
          </p>
        </div>
        <Button size="lg" className="h-11 shrink-0" onClick={scrollToReserve}>
          Reserve
        </Button>
      </div>
    </div>
  )
}
