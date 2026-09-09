"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

import { adminNav } from "@/lib/admin/nav"
import { canView } from "@/lib/admin/rbac"
import { useProperties, useReservations, useUsers } from "@/lib/admin/api/hooks"
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

type Resource = Parameters<typeof canView>[1]

type Hit = {
  id: string
  label: string
  hint: string
  href: string
  resource: Resource
}

/** Long enough to be worth a round trip; short enough to feel instant. */
const MIN_QUERY = 2
const DEBOUNCE_MS = 250

/**
 * Cross-entity search.
 *
 * The Figma drew a search box and no results treatment. The mock resolved it
 * by building an index of every property, client, guest and reservation in the
 * browser — which works over a fixture of forty rows and not at all over a
 * marketplace: the palette would have had to hold the entire database to open.
 *
 * So it asks the API instead, on the same `q` parameter each list endpoint
 * already takes. Debounced, and only past two characters — a query per
 * keystroke is three round trips a letter for results nobody reads.
 *
 * The nav is still local and still instant. "Go to Finance" should not need a
 * network, and it is the thing a palette is most often used for.
 */
export function GlobalSearch() {
  const router = useRouter()
  const { role } = useAdminRole()
  const [open, setOpen] = React.useState(false)
  const [typed, setTyped] = React.useState("")
  const [term, setTerm] = React.useState("")

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

  /** The debounce. `typed` follows the keyboard; `term` is what gets fetched. */
  React.useEffect(() => {
    const id = setTimeout(() => setTerm(typed.trim()), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [typed])

  const active = open && term.length >= MIN_QUERY
  const query = React.useMemo(() => ({ q: term, limit: 5 }), [term])

  /*
   * Only what this role can open, and only once the palette is open.
   *
   * "Do not fetch" is `enabled: false`, not `{ limit: 0 }` — which is what it
   * used to be, and which the API rejects, so closed palettes were firing three
   * 400s on every admin screen.
   */
  const properties = useProperties(query, active && canView(role, "properties"))
  const users = useUsers(query, active && canView(role, "guests"))
  const bookings = useReservations(query, active && canView(role, "reservations"))

  const navHits: Hit[] = React.useMemo(
    () =>
      adminNav
        .filter((item) => canView(role, item.resource))
        .map((item) => ({
          id: `nav-${item.href}`,
          label: item.title,
          hint: item.href,
          href: item.href,
          resource: item.resource,
        })),
    [role]
  )

  const groups: { heading: string; hits: Hit[]; loading: boolean }[] = [
    { heading: "Go to", hits: navHits, loading: false },
    {
      heading: "Properties",
      loading: active && properties.isFetching,
      hits: active
        ? (properties.data?.items ?? []).map((row) => ({
            id: row.id,
            label: row.name,
            hint: `${row.city}, ${row.country}`,
            href: `/admin/properties/${row.id}`,
            resource: "properties" as Resource,
          }))
        : [],
    },
    {
      heading: "People",
      loading: active && users.isFetching,
      hits: active
        ? (users.data?.items ?? []).map((row) => ({
            id: row.id,
            label: `${row.firstName} ${row.lastName}`.trim() || row.email,
            hint: `${row.email} · ${row.role}`,
            href:
              row.role === "customer"
                ? `/admin/guests/${row.id}`
                : `/admin/users`,
            resource: "guests" as Resource,
          }))
        : [],
    },
    {
      heading: "Bookings",
      loading: active && bookings.isFetching,
      hits: active
        ? (bookings.data?.items ?? []).map((row) => ({
            id: row.id,
            label: `${row.ref} — ${row.guestFirstName} ${row.guestLastName}`,
            hint: `${row.propertyName} · ${row.roomName}`,
            href: `/admin/reservations?focus=${row.id}`,
            resource: "reservations" as Resource,
          }))
        : [],
    },
  ]

  const anyLoading = groups.some((g) => g.loading)
  const anyHits = groups.some((g) => g.hits.length > 0)

  function go(href: string) {
    setOpen(false)
    setTyped("")
    setTerm("")
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
        <span className="truncate">Search properties, people, bookings…</span>
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
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setTyped("")
            setTerm("")
          }
        }}
        title="Search Stayora Admin"
        description="Find a property, a person, a booking or a section."
      >
        <CommandInput
          value={typed}
          onValueChange={setTyped}
          placeholder="Search properties, people, bookings…"
        />
        <CommandList>
          {/*
            * `shouldFilter` stays on for the nav, which is local. The API
            * groups are already filtered by the server, and cmdk matching them
            * again against the same string is harmless — it is the same term.
            */}
          <CommandEmpty>
            {typed.trim().length > 0 && typed.trim().length < MIN_QUERY
              ? "Keep typing…"
              : anyLoading
                ? "Searching…"
                : "Nothing found."}
          </CommandEmpty>

          {groups.map((group) =>
            group.hits.length === 0 ? null : (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.hits.map((hit) => (
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
            )
          )}

          {active && anyLoading && !anyHits ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              Searching…
            </p>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  )
}
