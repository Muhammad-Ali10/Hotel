"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  CalendarDays,
  Check,
  MapPin,
  Minus,
  Plus,
  Search,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { locations } from "@/data/locations"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type Guests = { adults: number; children: number; rooms: number }

// Keep search popovers anchored below the field (never flip up); just shift
// horizontally to stay on screen.
const DROP_DOWN = {
  side: "none",
  align: "shift",
  fallbackAxisSide: "none",
} as const

export function HeroSearch({
  initialLocation = "",
  className,
  glow = true,
}: {
  initialLocation?: string
  className?: string
  glow?: boolean
} = {}) {
  const router = useRouter()
  const [active, setActive] = React.useState<string | null>(null)
  const [location, setLocation] = React.useState(initialLocation)
  const [checkIn, setCheckIn] = React.useState<Date>()
  const [checkOut, setCheckOut] = React.useState<Date>()
  const [guests, setGuests] = React.useState<Guests>({
    adults: 2,
    children: 0,
    rooms: 1,
  })

  function onSearch() {
    router.push(
      location ? `/hotels?city=${encodeURIComponent(location)}` : "/hotels"
    )
  }

  const guestLabel = `${guests.adults + guests.children} Guests, ${guests.rooms} ${
    guests.rooms === 1 ? "Room" : "Rooms"
  }`
  const toggle = (key: string) => (open: boolean) =>
    setActive(open ? key : (cur) => (cur === key ? null : cur))

  return (
    <div className={cn("relative mx-auto w-full max-w-5xl", className)}>
      {/* soft depth glow */}
      {glow ? (
        <div className="bg-foreground/5 absolute -inset-x-6 -inset-y-3 -z-10 rounded-[3rem] blur-2xl" />
      ) : null}

      <div
        className={cn(
          "bg-card ring-foreground/5 flex flex-col gap-1.5 rounded-xl border p-2 shadow-lg ring-1 transition-shadow duration-300 sm:flex-row sm:items-center sm:gap-0  sm:p-1.5",
          active && "sm:shadow-2xl"
        )}
      >
        <LocationField
          value={location}
          onChange={setLocation}
          active={active === "loc"}
          onOpenChange={toggle("loc")}
        />
        <Divider faded={!!active} />
        <DateField
          label="Check In"
          value={checkIn}
          active={active === "in"}
          onOpenChange={toggle("in")}
          onSelect={(d) => {
            setCheckIn(d)
            if (checkOut && d && checkOut <= d) setCheckOut(undefined)
          }}
        />
        <Divider faded={!!active} />
        <DateField
          label="Check Out"
          value={checkOut}
          active={active === "out"}
          onOpenChange={toggle("out")}
          disabled={checkIn ? { before: checkIn } : undefined}
          onSelect={setCheckOut}
        />
        <Divider faded={!!active} />
        <GuestsField
          label={guestLabel}
          guests={guests}
          onChange={setGuests}
          active={active === "guests"}
          onOpenChange={toggle("guests")}
        />

        <Button
          type="button"
          size="lg"
          onClick={onSearch}
          className="mt-1 h-12 shrink-0 gap-2 rounded-full px-6 text-sm font-semibold sm:mt-0 sm:ml-1"
        >
          <Search className="size-4" />
          Search
        </Button>
      </div>
    </div>
  )
}

function Divider({ faded }: { faded?: boolean }) {
  return (
    <span
      className={cn(
        "bg-border mx-1 hidden h-8 w-px shrink-0 transition-opacity duration-200 sm:block",
        faded && "opacity-0"
      )}
    />
  )
}

function FieldButton({
  icon,
  label,
  value,
  placeholder,
  active,
  className,
  ...props
}: {
  icon: React.ReactNode
  label: string
  value?: string
  placeholder: string
  active: boolean
} & React.ComponentProps<"button">) {
  const filled = Boolean(value)
  return (
    <button
      type="button"
      className={cn(
        "group/field relative flex min-w-0 flex-1 items-center gap-3 rounded-full px-5 py-2 text-left transition-all duration-200",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground group-hover/field:bg-muted-foreground/15"
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          {label}
        </span>
        <span
          className={cn(
            "truncate text-sm font-medium",
            !filled && "text-muted-foreground/70 font-normal"
          )}
        >
          {filled ? value : placeholder}
        </span>
      </span>
    </button>
  )
}

function LocationField({
  value,
  onChange,
  active,
  onOpenChange,
}: {
  value: string
  onChange: (v: string) => void
  active: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Popover open={active} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <FieldButton
            icon={<MapPin className="size-4" />}
            label="Location"
            value={value}
            placeholder="Where are you going?"
            active={active}
          />
        }
      />
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={10}
        collisionAvoidance={DROP_DOWN}
        className="w-[300px] p-0"
      >
        <Command>
          <CommandInput placeholder="Search destinations…" />
          <CommandList>
            <CommandEmpty>No destinations found.</CommandEmpty>
            <CommandGroup heading="Popular destinations">
              {locations.map((loc) => {
                const label = `${loc.city}, ${loc.country}`
                const selected = value === loc.city
                return (
                  <CommandItem
                    key={label}
                    value={label}
                    onSelect={() => {
                      onChange(loc.city)
                      onOpenChange(false)
                    }}
                  >
                    <MapPin className="text-muted-foreground size-4" />
                    <span className="flex-1">{label}</span>
                    {selected ? <Check className="size-4" /> : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function DateField({
  label,
  value,
  active,
  onOpenChange,
  disabled,
  onSelect,
}: {
  label: string
  value: Date | undefined
  active: boolean
  onOpenChange: (open: boolean) => void
  disabled?: { before: Date }
  onSelect: (d: Date | undefined) => void
}) {
  return (
    <Popover open={active} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <FieldButton
            icon={<CalendarDays className="size-4" />}
            label={label}
            value={value ? format(value, "EEE, MMM d") : undefined}
            placeholder="Add date"
            active={active}
          />
        }
      />
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={10}
        collisionAvoidance={DROP_DOWN}
        className="w-auto p-0"
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onSelect(d)
            onOpenChange(false)
          }}
          disabled={disabled}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

function GuestsField({
  label,
  guests,
  onChange,
  active,
  onOpenChange,
}: {
  label: string
  guests: Guests
  onChange: (g: Guests) => void
  active: boolean
  onOpenChange: (open: boolean) => void
}) {
  const rows: { key: keyof Guests; title: string; hint: string; min: number }[] =
    [
      { key: "adults", title: "Adults", hint: "Ages 13+", min: 1 },
      { key: "children", title: "Children", hint: "Ages 2–12", min: 0 },
      { key: "rooms", title: "Rooms", hint: "", min: 1 },
    ]

  return (
    <Popover open={active} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <FieldButton
            icon={<Users className="size-4" />}
            label="Guests"
            value={label}
            placeholder="Add guests"
            active={active}
          />
        }
      />
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={10}
        collisionAvoidance={DROP_DOWN}
        className="w-80"
      >
        <div className="flex flex-col gap-1">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-4 py-2"
            >
              <div>
                <p className="text-sm font-medium">{row.title}</p>
                {row.hint ? (
                  <p className="text-muted-foreground text-xs">{row.hint}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-full"
                  disabled={guests[row.key] <= row.min}
                  onClick={() =>
                    onChange({ ...guests, [row.key]: guests[row.key] - 1 })
                  }
                  aria-label={`Decrease ${row.title}`}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-4 text-center text-sm tabular-nums">
                  {guests[row.key]}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-full"
                  onClick={() =>
                    onChange({ ...guests, [row.key]: guests[row.key] + 1 })
                  }
                  aria-label={`Increase ${row.title}`}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
