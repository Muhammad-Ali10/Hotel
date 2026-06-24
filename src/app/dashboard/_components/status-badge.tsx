import type { BookingStatus } from "@/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusStyles: Record<BookingStatus, string> = {
  confirmed:
    "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  completed: "border-transparent bg-muted text-muted-foreground",
  pending:
    "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
  cancelled: "border-transparent bg-destructive/10 text-destructive",
}

const statusLabel: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  completed: "Completed",
  pending: "Pending",
  cancelled: "Cancelled",
}

export function StatusBadge({
  status,
  className,
}: {
  status: BookingStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", statusStyles[status], className)}
    >
      {statusLabel[status]}
    </Badge>
  )
}
