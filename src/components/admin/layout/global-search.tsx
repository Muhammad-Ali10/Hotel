"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

import {
  adminClients,
  adminGuests,
  adminProperties,
  adminReservations,
  clientName,
} from "@/data/admin"
import { adminNav } from "@/lib/admin/nav"
import { canView } from "@/lib/admin/rbac"
import { useAdminRole } from "@/components/admin/role-provider"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

type Hit = {
  id: string
  label: string
  hint: string
  href: string
  group: string
  resource: Parameters<typeof canView>[1]
}

/**
 * Cross-entity search. The Figma drew a search box but no results treatment —
 * this resolves it as a ⌘K palette over properties, clients, guests,
 * reservations and the nav itself, filtered by what the role can open.
 */
export function GlobalSearch() {
  const router = useRouter()
  const { role } = useAdminRole()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const hits = React.useMemo<Hit[]>(
    () => [
      ...adminNav.map((item) => ({
        id: `nav-${item.href}`,
        label: item.title,
        hint: item.href,
        href: item.href,
        group: "Go to",
        resource: item.resource,
      })),
      ...adminProperties.map((p) => ({
        id: p.id,
        label: p.name,
        hint: `${p.id} · ${p.city}, ${p.country}`,
        href: `/admin/properties/${p.id}`,
        group: "Properties",
        resource: "properties" as const,
      })),
      ...adminClients.map((c) => ({
        id: c.id,
        label: c.name,
        hint: `${c.id} · ${c.plan} plan`,
        href: `/admin/clients/${c.id}`,
        group: "Clients",
        resource: "clients" as const,
      })),
      ...adminGuests.map((g) => ({
        id: g.id,
        label: g.name,
        hint: `${g.id} · ${g.email}`,
        href: `/admin/guests/${g.id}`,
        group: "Guests",
        resource: "guests" as const,
      })),
      ...adminReservations.map((r) => ({
        id: r.id,
        label: `${r.id} — ${r.guestName}`,
        hint: `${clientName(
          adminProperties.find((p) => p.id === r.propertyId)?.clientId ?? ""
        )} · ${r.room}`,
        href: `/admin/reservations?focus=${r.id}`,
        group: "Reservations",
        resource: "reservations" as const,
      })),
    ],
    []
  )

  const visible = hits.filter((hit) => canView(role, hit.resource))
  const groups = Array.from(new Set(visible.map((h) => h.group)))

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hidden h-9 w-full max-w-md justify-start gap-2 font-normal md:flex"
      >
        <Search aria-hidden className="size-4" />
        <span className="truncate">
          Search properties, clients, reservations…
        </span>
        <kbd className="bg-muted text-muted-foreground ml-auto hidden rounded border px-1.5 py-0.5 font-mono text-[10px] lg:inline-block">
          ⌘K
        </kbd>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="md:hidden"
      >
        <Search className="size-4" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search Stayora Admin"
        description="Find a property, client, guest, reservation or section."
      >
        <CommandInput placeholder="Search properties, clients, reservations…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group} heading={group}>
              {visible
                .filter((hit) => hit.group === group)
                .map((hit) => (
                  <CommandItem
                    key={hit.id}
                    value={`${hit.label} ${hit.hint}`}
                    onSelect={() => go(hit.href)}
                  >
                    <span className="flex-1 truncate">{hit.label}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {hit.hint}
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}
