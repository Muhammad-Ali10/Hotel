"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, ChevronDown, Menu } from "lucide-react"

import { usePartnerOrg, useProfile } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { avatarImage } from "@/lib/images"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ModeToggle } from "@/components/layout/mode-toggle"
import { ExtranetSidebar } from "./sidebar"
import { NotificationsMenu } from "./notifications-menu"
import { TopbarSearch } from "./topbar-search"

const initialsOf = (name: string) => name
  .split(" ")
  .map((p) => p[0])
  .join("")

export function ExtranetTopbar() {
  const [open, setOpen] = React.useState(false)
  const { data: profile } = useProfile()
  /*
   * The REAL switcher.
   *
   * It used to set a local string and nothing else: picking a different hotel
   * changed the label and not one screen below it.
   */
  const { properties, active, setActive, isPending } = useActiveProperty()

  const { data: org } = usePartnerOrg()

  const name = profile ? `${profile.firstName} ${profile.lastName}` : ""
  const orgName = org?.name ?? ""
  const initials = name ? initialsOf(name) : ""

  return (
    <header className="bg-background sticky top-0 z-40 w-full border-b">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        {/* Mobile sidebar */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </Button>
            }
          />
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Extranet navigation</SheetTitle>
            </SheetHeader>
            <ExtranetSidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Property switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-2">
                <Building2 className="size-4" />
                <span className="max-w-[9rem] truncate">
                  {isPending ? "Loading…" : (active?.name ?? "No property")}
                </span>
                <ChevronDown className="size-4 opacity-60" />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Switch property</DropdownMenuLabel>
            {properties.length === 0 && !isPending ? (
              <DropdownMenuItem disabled className="flex-col items-start gap-0">
                <span className="font-medium">No properties yet</span>
                <span className="text-muted-foreground text-xs">
                  Add one from the portfolio screen.
                </span>
              </DropdownMenuItem>
            ) : null}
            {properties.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setActive(p.id)}
                className="flex-col items-start gap-0"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground text-xs">
                  {p.city} · {p.rooms} {p.rooms === 1 ? "room" : "rooms"}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <TopbarSearch />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ModeToggle />

          {/* Notifications */}
          <NotificationsMenu />

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="hover:bg-muted flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors"
                >
                  <Avatar size="sm">
                    <AvatarImage
                      src={avatarImage(profile?.avatarSeed ?? "")}
                      alt={name}
                    />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left leading-tight lg:block">
                    <span className="block text-sm font-medium">{name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {/*
                        The org, not a role. A member's role is `admin` /
                        `manager` / `staff` and lives on the session; what they
                        want to see here is which company they are signed in
                        as.
                      */}
                      {orgName}
                    </span>
                  </span>
                  <ChevronDown className="hidden size-4 opacity-60 lg:block" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-foreground text-sm font-medium">{name}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {profile?.email ?? ""}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/extranet/account" />}>
                Account
              </DropdownMenuItem>
              {/* "Settings" used to point at /extranet/account too — two menu
                  items, one destination. */}
              <DropdownMenuItem render={<Link href="/extranet/property/messaging" />}>
                Notification settings
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/extranet/account/change-password" />}>
                Security
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" render={<Link href="/" />}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
