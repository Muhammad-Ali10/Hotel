"use client"

import * as React from "react"
import {
  Accessibility,
  Car,
  ConciergeBell,
  Droplets,
  ShieldCheck,
  Trees,
  Tv,
  UtensilsCrossed,
  Wifi,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { useWizard } from "../_components/wizard-provider"

const groups: { label: string; icon: React.ElementType; items: string[] }[] = [
  {
    label: "Internet & Connectivity",
    icon: Wifi,
    items: ["Free WiFi", "Premium high-speed internet", "Dedicated workspace"],
  },
  {
    label: "Parking & Transport",
    icon: Car,
    items: ["Free parking on premises", "Paid parking", "Valet parking", "Airport shuttle", "EV charger"],
  },
  {
    label: "Food & Dining",
    icon: UtensilsCrossed,
    items: ["Breakfast included", "On-site restaurant", "24-hour room service", "Minibar", "Guest kitchen"],
  },
  {
    label: "Pools & Wellness",
    icon: Droplets,
    items: ["Outdoor pool", "Indoor pool", "Spa & wellness centre", "Sauna", "Hot tub"],
  },
  {
    label: "Guest Services",
    icon: ConciergeBell,
    items: ["24-hour front desk", "Concierge service", "Daily housekeeping", "Laundry service", "Room service", "Luggage storage"],
  },
  {
    label: "Family & Accessibility",
    icon: Accessibility,
    items: ["Family rooms", "Kids' play area", "Cribs available", "Wheelchair accessible", "Accessible bathroom"],
  },
  {
    label: "Outdoor & Views",
    icon: Trees,
    items: ["Garden", "Terrace", "Balcony", "Sea view", "Mountain view", "BBQ facilities"],
  },
  {
    label: "Entertainment & Media",
    icon: Tv,
    items: ["Flat-screen TV", "Streaming services", "Games room", "Live entertainment"],
  },
  {
    label: "Safety & Security",
    icon: ShieldCheck,
    items: ["Smoke alarms", "24-hour security", "CCTV in common areas", "Fire extinguishers", "In-room safe"],
  },
]

export default function AmenitiesPage() {
  const { data, update } = useWizard()
  const [selected, setSelected] = React.useState<string[]>(data.amenities)

  const toggle = (item: string) =>
    setSelected((s) => (s.includes(item) ? s.filter((x) => x !== item) : [...s, item]))

  return (
    <WizardShell
      aside={
        <TipPanel title="Amenities boost bookings">
          Properties with complete amenity listings get up to 40% more bookings.
          Guests filter by amenities they care about most — WiFi, parking, pools,
          and pet policies. Be thorough and honest; inaccurate listings lead to
          negative reviews. You can update these anytime from the Extranet.
        </TipPanel>
      }
    >
      <StepHeading
        title="What amenities do you offer?"
        description="Select all the facilities and services available at your property. These help guests decide where to book."
      />
      <div className="space-y-5">
        {groups.map((group) => {
          const count = group.items.filter((i) => selected.includes(i)).length
          return (
            <div key={group.label}>
              <div className="mb-2.5 flex items-center gap-2">
                <group.icon className="text-muted-foreground size-4" />
                <h3 className="text-sm font-semibold">{group.label}</h3>
                <span className="text-muted-foreground text-xs">
                  · {count > 0 ? `${count} selected` : `${group.items.length} amenities`}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.items.map((item) => {
                  const checked = selected.includes(item)
                  return (
                    <label
                      key={item}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                        checked ? "border-primary bg-primary/[0.03]" : "hover:bg-muted/40",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(item)}
                      />
                      <span>{item}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <StepNav slug="amenities" onContinue={() => update({ amenities: selected })} />
    </WizardShell>
  )
}
