"use client"

import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

/** The −/value/+ stepper used for room counts, guests, and bed counts. */
export function Counter({
  value,
  onChange,
  min = 0,
  max = 99,
  className,
  suffix,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  className?: string
  suffix?: string
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)))

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={value <= min}
        aria-label="Decrease"
        className="hover:bg-muted flex size-9 items-center justify-center rounded-full border transition-colors disabled:opacity-40"
      >
        <Minus className="size-4" />
      </button>
      <span className="min-w-[2ch] text-center text-sm font-medium tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        aria-label="Increase"
        className="hover:bg-muted flex size-9 items-center justify-center rounded-full border transition-colors disabled:opacity-40"
      >
        <Plus className="size-4" />
      </button>
      {suffix && <span className="text-muted-foreground text-sm">{suffix}</span>}
    </div>
  )
}
