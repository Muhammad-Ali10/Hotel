"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import { href, nextStep, prevStep } from "../_lib/steps"

/**
 * Back / Continue, wired to the step registry.
 *
 * `onContinue` may be async, and usually is: a screen saves to the server and
 * only then moves on. Returning `false` — or a promise of it — keeps the
 * partner where they are, which is what a failed save has to do. Navigating
 * anyway would march them through the rest of the wizard with a hole in the
 * middle they would not find until submit refused it.
 *
 * The button is disabled while the save is in flight, so a double click cannot
 * send two patches for the same screen.
 */
export function StepNav({
  slug,
  onContinue,
  nextLabel = "Continue",
  backLabel = "Back",
  hideBack = false,
  nextDisabled = false,
  className,
}: {
  slug: string
  onContinue?: () => boolean | void | Promise<boolean | void>
  nextLabel?: string
  backLabel?: string
  hideBack?: boolean
  nextDisabled?: boolean
  className?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  async function goNext() {
    if (busy) return
    setBusy(true)
    try {
      if (onContinue && (await onContinue()) === false) return
      const next = nextStep(slug)
      if (next) router.push(href(next.path))
    } finally {
      setBusy(false)
    }
  }

  function goBack() {
    const prev = prevStep(slug)
    if (prev) router.push(href(prev.path))
    else router.back()
  }

  return (
    <div className={cn("mt-8 flex items-center gap-3", className)}>
      {!hideBack && (
        <Button variant="outline" type="button" onClick={goBack} disabled={busy}>
          <ArrowLeft className="size-4" />
          {backLabel}
        </Button>
      )}
      <Button
        type="button"
        onClick={goNext}
        disabled={nextDisabled || busy}
        className="flex-1"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {nextLabel}
      </Button>
    </div>
  )
}
