"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { useAmenities } from "@/lib/api/hooks"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { useWizard } from "../_components/wizard-provider"

/* ============================================================================
 * Step 8 — amenities, from the platform's own vocabulary (rule #74).
 *
 * This screen used to render forty English phrases written into the file:
 * "Free WiFi", "24-hour room service", "Sea view". A draft stores amenity
 * SLUGS, and approval re-checks every one against the vocabulary and silently
 * drops the ones it does not recognise — so a partner could tick twenty
 * amenities here and have a listing published with none of them, having been
 * shown no error at any point.
 *
 * The list is now `GET /amenities`: the same controlled vocabulary the search
 * filters use, so an amenity a guest can filter by is an amenity a partner can
 * offer, and neither list can drift from the other.
 * ========================================================================== */

export default function AmenitiesPage() {
  const { data, save } = useWizard()
  const amenities = useAmenities()
  const [selected, setSelected] = React.useState<string[]>(data.amenities)

  const groups = React.useMemo(() => {
    const byCategory = new Map<string, { slug: string; label: string }[]>()
    for (const amenity of amenities.data ?? []) {
      const list = byCategory.get(amenity.category) ?? []
      list.push({ slug: amenity.slug, label: amenity.label })
      byCategory.set(amenity.category, list)
    }
    return [...byCategory.entries()].map(([category, items]) => ({ category, items }))
  }, [amenities.data])

  function toggle(slug: string) {
    setSelected((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug]
    )
  }

  async function validate() {
    /*
     * Not required to submit — `submissionGaps` does not ask for amenities, and
     * refusing to save an empty list here would be a rule this screen invented.
     * A property with none is unusual, not invalid.
     */
    if (amenities.isError) {
      toast.error("The amenity list didn't load", {
        description: "Reload the page — saving now would clear what you picked.",
      })
      return false
    }
    return save({ amenities: selected })
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Pick what you actually offer">
          These are what guests filter by, so every one you tick is a search a
          guest could find you through — and one they will expect on arrival.
          Ticking a facility you do not have is the fastest route to a one-star
          review.
        </TipPanel>
      }
    >
      <StepHeading
        title="What does your property offer?"
        description="Guests filter by these, so pick everything that genuinely applies."
      />

      {amenities.isPending ? (
        <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading the amenity list…
        </div>
      ) : amenities.isError ? (
        <p className="text-destructive py-10 text-sm">
          The amenity list didn&apos;t load. Reload the page to try again.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.category}>
              <p className="text-sm font-medium capitalize">{group.category}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {group.items.map((item) => {
                  const checked = selected.includes(item.slug)
                  return (
                    <label
                      key={item.slug}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                        checked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(item.slug)} />
                      {item.label}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-muted-foreground mt-6 text-sm">
        {selected.length} selected
      </p>

      <StepNav slug="amenities" onContinue={validate} />
    </WizardShell>
  )
}
