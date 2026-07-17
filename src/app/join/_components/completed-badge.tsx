import { Check } from "lucide-react"

/** Small green "Completed" pill used across the setup checklist. Green here is
 *  a status accent (permitted by the palette rules). */
export function CompletedBadge({ label = "Completed" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
      <Check className="size-3" />
      {label}
    </span>
  )
}
