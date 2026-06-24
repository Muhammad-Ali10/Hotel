"use client"

import * as React from "react"
import Link from "next/link"
import { Hotel, Menu } from "lucide-react"

import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ModeToggle } from "@/components/layout/mode-toggle"
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar"

export function DashboardHeader() {
  const [open, setOpen] = React.useState(false)

  return (
    <header className="bg-background sticky top-0 z-50 w-full border-b">
      <div className="mx-auto flex h-16 max-w-[1700px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
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
                <SheetTitle>Dashboard navigation</SheetTitle>
              </SheetHeader>
              <DashboardSidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <Hotel className="size-5" />
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">
              {siteConfig.name}
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {siteConfig.mainNav.map((item) => (
            <Button
              key={item.title}
              variant="ghost"
              size="sm"
              render={<Link href={item.href}>{item.title}</Link>}
            />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            render={<Link href="/login">Login</Link>}
          />
          <Button size="sm" render={<Link href="/signup">Register</Link>} />
        </div>
      </div>
    </header>
  )
}
