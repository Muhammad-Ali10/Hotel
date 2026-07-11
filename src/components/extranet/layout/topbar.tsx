"use client"

import * as React from "react"
import Link from "next/link"
import { Bell, Building2, ChevronDown, Menu, Search } from "lucide-react"

import { properties, activeProperty, currentUser } from "@/data/extranet"
import { avatarImage } from "@/lib/images"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

const initials = currentUser.name
  .split(" ")
  .map((p) => p[0])
  .join("")

export function ExtranetTopbar() {
  const [open, setOpen] = React.useState(false)
  const [property, setProperty] = React.useState(activeProperty.name)

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
                <span className="max-w-[9rem] truncate">{property}</span>
                <ChevronDown className="size-4 opacity-60" />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Switch property</DropdownMenuLabel>
            {properties.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setProperty(p.name)}
                className="flex-col items-start gap-0"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground text-xs">
                  {p.city} · {p.rooms} rooms
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <div className="relative hidden flex-1 md:block">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search reservations, guests…"
            className="bg-muted/40 h-9 max-w-md pl-8"
          />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ModeToggle />

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="relative"
          >
            <Bell className="size-5" />
            <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium">
              4
            </span>
          </Button>

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
                      src={avatarImage(currentUser.seed)}
                      alt={currentUser.name}
                    />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left leading-tight lg:block">
                    <span className="block text-sm font-medium">
                      {currentUser.name}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {currentUser.role}
                    </span>
                  </span>
                  <ChevronDown className="hidden size-4 opacity-60 lg:block" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-foreground text-sm font-medium">
                  {currentUser.name}
                </span>
                <span className="text-muted-foreground text-xs font-normal">
                  {currentUser.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/extranet/account" />}>
                Account
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/extranet/account" />}>
                Settings
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
