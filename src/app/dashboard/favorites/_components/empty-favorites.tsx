import Link from "next/link"
import { HeartOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function EmptyFavorites() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full">
          <HeartOff className="size-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="font-heading text-xl font-semibold">
            No saved hotels yet
          </h2>
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            Start exploring our curated collection of luxury stays and tap the
            heart to save your favorites here.
          </p>
        </div>
        <Button render={<Link href="/hotels">Browse Hotels</Link>} />
      </CardContent>
    </Card>
  )
}
