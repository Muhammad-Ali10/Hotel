"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, ChevronDown, Menu } from "lucide-react"

import { usePartnerHotels, useActiveHotel } from "@/store/selectors"
import { useStore } from "@/store"
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
  // Profile and portfolio come from the store, so a rename on either the
  // Account screen or a property screen shows up here immediately.
  const partner = useStore((s) => s.partner)
  const hotels = usePartnerHotels()
  const activeHotel = useActiveHotel()
  const [property, setProperty] = React.useState(activeHotel?.name ?? "")
  const initials = initialsOf(partner.name)

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
                <span className="max-w-[9rem] truncate">{property || activeHotel?.name}</span>
                <ChevronDown className="size-4 opacity-60" />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Switch property</DropdownMenuLabel>
            {hotels.map((h) => (
              <DropdownMenuItem
                key={h.id}
                onClick={() => setProperty(h.name)}
                className="flex-col items-start gap-0"
              >
                <span className="font-medium">{h.name}</span>
                <span className="text-muted-foreground text-xs">
                  {h.city} · {h.rooms.reduce((sum, r) => sum + r.units, 0)} rooms
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
                      src={avatarImage(partner.seed)}
                      alt={partner.name}
                    />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left leading-tight lg:block">
                    <span className="block text-sm font-medium">
                      {partner.name}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {partner.role}
                    </span>
                  </span>
                  <ChevronDown className="hidden size-4 opacity-60 lg:block" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-foreground text-sm font-medium">
                  {partner.name}
                </span>
                <span className="text-muted-foreground text-xs font-normal">
                  {partner.email}
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
