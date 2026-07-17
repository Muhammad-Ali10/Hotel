"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import { href, nextStep, prevStep } from "../_lib/steps"

/** Back / Continue footer wired to the step registry. `onContinue` runs first;
 *  return false to block navigation (e.g. failed validation). */
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
  onContinue?: () => boolean | void
  nextLabel?: string
  backLabel?: string
  hideBack?: boolean
  nextDisabled?: boolean
  className?: string
}) {
  const router = useRouter()

  function goNext() {
    if (onContinue && onContinue() === false) return
    const next = nextStep(slug)
    if (next) router.push(href(next.path))
  }

  function goBack() {
    const prev = prevStep(slug)
    if (prev) router.push(href(prev.path))
    else router.back()
  }

  return (
    <div className={cn("mt-8 flex items-center gap-3", className)}>
      {!hideBack && (
        <Button variant="outline" type="button" onClick={goBack}>
          <ArrowLeft className="size-4" />
          {backLabel}
        </Button>
      )}
      <Button
        type="button"
        onClick={goNext}
        disabled={nextDisabled}
        className="flex-1"
      >
        {nextLabel}
      </Button>
    </div>
  )
}
