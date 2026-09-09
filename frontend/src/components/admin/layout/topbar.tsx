"use client"

import * as React from "react"
import Link from "next/link"
import { Check, LogOut, Menu, Settings, ShieldCheck, User } from "lucide-react"

import { ROLE_LABELS } from "@/lib/admin/rbac"
import { useAdminRole } from "@/components/admin/role-provider"
import { AdminSidebar } from "./sidebar"
import { AdminNotificationsMenu } from "./notifications-menu"
import { GlobalSearch } from "./global-search"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
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
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function AdminTopbar() {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const { user, role } = useAdminRole()

  return (
    <header className="bg-card sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b px-4 sm:px-6">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Jump to any section of the Stayora admin panel.
          </SheetDescription>
          <AdminSidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <Link
        href="/admin"
        className="font-heading flex items-center gap-2 text-sm font-semibold lg:hidden"
      >
        <ShieldCheck className="size-4" />
        Stayora Admin
      </Link>

      <div className="flex flex-1 justify-center px-2 md:justify-start">
        <GlobalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <AdminNotificationsMenu />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="h-10 gap-2 px-1.5 sm:px-2"
                aria-label="Account menu"
              >
                <Avatar className="size-7">
                  <AvatarFallback className="text-xs">
                    {user?.initials ?? ""}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium">{user?.name ?? ""}</span>
                  <span className="text-muted-foreground block text-xs">
                    {role ? ROLE_LABELS[role] : ""}
                  </span>
                </span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user?.name ?? ""}</p>
              <p className="text-muted-foreground text-xs font-normal">
                {user?.email ?? ""}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/admin/settings" />}>
              <User className="size-4" />
              My profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/admin/settings" />}>
              <Settings className="size-4" />
              Platform settings
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/admin/users" />}>
              <ShieldCheck className="size-4" />
              Team management
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/admin/audit" />}>
              <Check className="size-4" />
              Activity log
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              render={<Link href="/login" />}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

/*
 * The role switcher that stood here let anybody set their own permissions from
 * a dropdown — "Mock only", said its own label, on a panel any signed-in
 * account could reach. The role is the session's now, and a session is not
 * something a menu can change.
 */
