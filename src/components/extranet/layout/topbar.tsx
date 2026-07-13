"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, ChevronDown, Menu } from "lucide-react"

import { properties, activeProperty, currentUser } from "@/data/extranet"
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
