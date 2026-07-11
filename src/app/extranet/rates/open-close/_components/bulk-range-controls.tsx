"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const roomTypeOptions = [
  "All room types",
  "Standard Room",
  "Premium King",
  "Deluxe Ocean Suite",
  "Family Suite",
  "Penthouse Suite",
  "Accessible Room",
]

/** Open Range / Close Range buttons that each open a dialog to pick a room
 *  type and date range, then confirm with a toast. Mock — no persistence. */
export function BulkRangeControls() {
  const [mode, setMode] = React.useState<"open" | "close" | null>(null)

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setMode("open")}>
          Open Range
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMode("close")}>
          Close Range
        </Button>
      </div>

      {/* Remount per mode so fields reset each time it opens. */}
      <RangeDialog
        key={mode ?? "closed"}
        mode={mode}
        onClose={() => setMode(null)}
      />
    </>
  )
}

function RangeDialog({
  mode,
  onClose,
}: {
  mode: "open" | "close" | null
  onClose: () => void
}) {
  const [roomType, setRoomType] = React.useState(roomTypeOptions[0])
  const isOpening = mode === "open"

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isOpening ? "Open Rooms for Range" : "Close Rooms for Range"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Room Type</Label>
            <Select value={roomType} onValueChange={(v) => setRoomType(String(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roomTypeOptions.map((rt) => (
                  <SelectItem key={rt} value={rt}>
                    {rt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="range-from">From</Label>
              <Input id="range-from" type="date" defaultValue="2026-07-15" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="range-to">To</Label>
              <Input id="range-to" type="date" defaultValue="2026-07-22" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
              toast.success(
                isOpening ? "Rooms opened for range" : "Rooms closed for range"
              )
              onClose()
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
