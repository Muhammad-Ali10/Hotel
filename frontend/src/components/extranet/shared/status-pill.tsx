import { cn } from "@/lib/utils"

type Tone = "success" | "warning" | "danger" | "info" | "neutral"

const toneClasses: Record<Tone, string> = {
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  neutral: "bg-muted text-muted-foreground",
}

/** Maps the many status strings used across the extranet to a colour tone. */
const statusTone: Record<string, Tone> = {
  active: "success",
  confirmed: "info",
  "checked in": "success",
  "checked out": "neutral",
  cancelled: "danger",
  pending: "warning",
  approved: "success",
  flagged: "danger",
  rejected: "danger",
  paused: "warning",
  draft: "neutral",
  paid: "success",
  processed: "success",
  "full refund": "success",
  partial: "warning",
  "no refund": "neutral",
  invited: "warning",
  open: "info",
  resolved: "success",
  overdue: "danger",
  failed: "danger",
  completed: "success",
  inactive: "neutral",
  refunded: "neutral",
  outstanding: "warning",
  compliant: "success",
  connected: "success",
  "in progress": "warning",
  available: "info",
}

export function StatusPill({
  status,
  tone,
  className,
}: {
  status: string
  tone?: Tone
  className?: string
}) {
  const resolved = tone ?? statusTone[status.toLowerCase()] ?? "neutral"
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[resolved],
        className
      )}
    >
      {status}
    </span>
  )
}
