"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { useWizard } from "../_components/wizard-provider"
import { money } from "../_lib/labels"

type Season = { id: string; name: string; adjustment: number }

export default function PricingPage() {
  const { data, update } = useWizard()
  const [baseRate, setBaseRate] = React.useState(data.baseRate ? String(data.baseRate) : "")
  const [weekend, setWeekend] = React.useState(data.weekendPricing)
  const [seasons, setSeasons] = React.useState<Season[]>([])

  const rate = Number(baseRate) || 0
  const weekendRate = Math.round(rate * (1 + data.weekendMarkup / 100))

  function validate() {
    if (rate <= 0) {
      toast.error("Please enter a base nightly rate")
      return false
    }
    update({ baseRate: rate, weekendPricing: weekend })
    return true
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Pricing strategy tips">
          Start with a competitive base rate that covers costs and market
          positioning. Weekend markups of 15–25% are industry standard. Use
          seasonal rates to capture peak demand or fill low-occupancy periods.
          You can fine-tune everything later with per-room and per-date pricing
          in the Extranet.
        </TipPanel>
      }
    >
      <StepHeading
        title="Set your pricing"
        description="Define your base nightly rate and optional seasonal adjustments. All prices in PKR."
      />

      <div className="space-y-2">
        <Label htmlFor="baseRate">
          Base nightly rate <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-stretch gap-2">
          <span className="bg-muted text-muted-foreground flex items-center rounded-lg border px-3 text-sm font-medium">
            $
          </span>
          <Input
            id="baseRate"
            type="number"
            inputMode="numeric"
            placeholder="e.g. 550"
            value={baseRate}
            onChange={(e) => setBaseRate(e.target.value)}
            className="flex-1"
          />
        </div>
        <p className="text-muted-foreground text-xs">
          This is your standard rate per night for a base room. You can set
          different rates per room type later in the Extranet.
        </p>
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Weekend pricing</p>
            <p className="text-muted-foreground text-xs">
              Charge more on Friday &amp; Saturday nights
            </p>
          </div>
          <Switch checked={weekend} onCheckedChange={setWeekend} />
        </div>
        {weekend && (
          <div className="mt-3 border-t pt-3">
            <p className="text-sm font-medium">Weekend rate: {money(weekendRate)}</p>
            <p className="text-muted-foreground text-xs">
              {data.weekendMarkup}% markup · applied Friday &amp; Saturday
            </p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium">Seasonal rates</p>
        <p className="text-muted-foreground text-xs">
          Optional rate adjustments for peak or off-peak seasons
        </p>
        <div className="mt-3 space-y-2">
          {seasons.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <Input
                placeholder="Season name (e.g. Eid)"
                value={s.name}
                onChange={(e) =>
                  setSeasons((list) =>
                    list.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)),
                  )
                }
                className="flex-1"
              />
              <div className="flex items-stretch">
                <Input
                  type="number"
                  value={s.adjustment}
                  onChange={(e) =>
                    setSeasons((list) =>
                      list.map((x) =>
                        x.id === s.id ? { ...x, adjustment: Number(e.target.value) } : x,
                      ),
                    )
                  }
                  className="w-20 rounded-r-none"
                />
                <span className="bg-muted text-muted-foreground flex items-center rounded-r-lg border border-l-0 px-2.5 text-sm">
                  %
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSeasons((list) => list.filter((x) => x.id !== s.id))}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove season"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setSeasons((list) => [
                ...list,
                { id: `s-${list.length}-${list.length + 1}`, name: "", adjustment: 15 },
              ])
            }
            className="hover:bg-muted/40 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2.5 text-sm font-medium transition-colors"
          >
            <Plus className="size-4" />
            Add season
          </button>
        </div>
      </div>

      <StepNav slug="pricing" onContinue={validate} />
    </WizardShell>
  )
}
