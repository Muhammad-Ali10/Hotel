"use client"

import * as React from "react"
import Link from "next/link"
import { Globe, Hotel, Menu } from "lucide-react"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ModeToggle } from "@/components/layout/mode-toggle"
import { NotificationBell } from "@/components/shared/notification-bell"

export function SiteHeader() {
  const [open, setOpen] = React.useState(false)

  return (
    <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-50 w-full border-b backdrop-blur">
      {/* Primary row */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <Hotel className="size-5" />
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight">
            {siteConfig.name}
          </span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {siteConfig.mainNav.map((item) => (
            <Button
              key={item.title}
              variant="ghost"
              size="sm"
              render={<Link href={item.href}>{item.title}</Link>}
            />
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="text-muted-foreground hidden items-center gap-3 text-sm md:flex">
            <span className="flex items-center gap-1">
              <Globe className="size-4" /> EN
            </span>
            {/* Every price on the site is formatted in USD; this label used to
                say PKR. */}
            <span>USD</span>
            <Link href="/support" className="hover:text-foreground">
              Help
            </Link>
          </div>
          <NotificationBell audience="customer" href="/dashboard/notifications" />
          <ModeToggle />
          <div className="hidden items-center gap-2 sm:flex">
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/signup">Register</Link>}
            />
            <Button size="sm" render={<Link href="/login">Login</Link>} />
          </div>

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
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="font-heading">{siteConfig.name}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {siteConfig.mainNav.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="hover:bg-muted rounded-md px-3 py-2 text-sm font-medium"
                  >
                    {item.title}
                  </Link>
                ))}
                <div className="mt-4 flex flex-col gap-2">
                  <Button variant="outline" render={<Link href="/signup">Register</Link>} />
                  <Button render={<Link href="/login">Login</Link>} />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Category tabs row */}
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {siteConfig.categories.map((cat) => (
            <button
              key={cat.label}
              type="button"
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
                cat.active
                  ? "border-primary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              <span aria-hidden>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
