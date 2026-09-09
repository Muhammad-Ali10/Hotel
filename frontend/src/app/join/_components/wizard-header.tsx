"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Globe, House } from "lucide-react"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

import { stepFromPathname, TOTAL_STEPS } from "../_lib/steps"
import { useWizard } from "./wizard-provider"

function Brand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2">
      <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg font-heading text-sm font-bold">
        S
      </span>
      <span className="font-heading text-lg font-semibold tracking-tight">
        {siteConfig.name}
      </span>
    </Link>
  )
}

export function WizardHeader() {
  const pathname = usePathname()
  const { data } = useWizard()
  const step = stepFromPathname(pathname ?? "")
  const chrome = step?.chrome ?? "wizard"

  const location = [data.city, data.country].filter(Boolean).join(", ")

  return (
    <header className="bg-background sticky top-0 z-40 w-full border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Brand />
          {/* Property chip appears once the property has a name (step 5+). */}
          {chrome !== "account" && data.propertyName && (
            <div className="flex min-w-0 items-center gap-2 border-l pl-3">
              <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                <House className="size-4" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium">{data.propertyName}</p>
                {location && (
                  <p className="text-muted-foreground truncate text-xs">{location}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {chrome === "account" ? (
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <span className="text-muted-foreground hidden items-center gap-1 text-sm sm:flex">
              <Globe className="size-4" /> EN
            </span>
            <Link
              href="/support"
              className="text-muted-foreground hover:text-foreground hidden text-sm sm:inline"
            >
              Help
            </Link>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/login">Sign in</Link>}
            />
          </div>
        ) : (
          step?.step != null && (
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-muted-foreground text-sm whitespace-nowrap">
                Step {step.step} of {TOTAL_STEPS}
              </span>
              <Progress
                value={(step.step / TOTAL_STEPS) * 100}
                className={cn("hidden h-1.5 w-28 sm:block")}
              />
            </div>
          )
        )}
      </div>
    </header>
  )
}
