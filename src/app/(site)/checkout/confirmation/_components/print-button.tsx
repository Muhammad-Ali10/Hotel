"use client"

import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"

export function PrintButton() {
  return (
    <Button
      variant="ghost"
      onClick={() => {
        if (typeof window !== "undefined") window.print()
      }}
    >
      <Printer className="size-4" />
      Print confirmation
    </Button>
  )
}
