"use client"

import * as React from "react"

import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { StoreHydration } from "@/components/providers/store-hydration"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        <StoreHydration />
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors closeButton position="top-center" />
      </QueryProvider>
    </ThemeProvider>
  )
}
