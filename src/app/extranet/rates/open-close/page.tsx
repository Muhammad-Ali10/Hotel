import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { openCloseRooms } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import {
  ConfirmDialog,
  PageHeader,
  SectionCard,
} from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BulkRangeControls } from "./_components/bulk-range-controls"

export default function OpenCloseRoomsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Open / Close Rooms"
        subtitle="Control room availability across all properties"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/rates" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Room Status Overview
          </h2>
          <p className="text-muted-foreground text-xs">
            Last updated: June 15, 2026
          </p>
        </div>
        <Card className="py-0">
          <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Room Type</TableHead>
              <TableHead className="text-right">Open Rooms</TableHead>
              <TableHead className="text-right">Closed Rooms</TableHead>
              <TableHead>Upcoming Closure</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {openCloseRooms.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.roomType}</TableCell>
                <TableCell className="text-right">{r.open}</TableCell>
                <TableCell className="text-right">
                  {r.closed > 0 ? (
                    <span className="text-destructive">{r.closed}</span>
                  ) : (
                    r.closed
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.upcomingClosure}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <ConfirmDialog
                      trigger={
                        <Button variant="outline" size="xs">
                          Open All
                        </Button>
                      }
                      title={`Open all ${r.roomType} rooms?`}
                      description={`Every room of type “${r.roomType}” will be marked open for booking.`}
                      confirmLabel="Open All"
                      toastMessage="All rooms opened"
                    />
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="xs">
                          Close All
                        </Button>
                      }
                      title={`Close all ${r.roomType} rooms?`}
                      description={`Every room of type “${r.roomType}” will be closed and unavailable for booking.`}
                      confirmLabel="Close All"
                      destructive
                      toastMessage="All rooms closed"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </Card>
      </div>

      <SectionCard
        title="Bulk Actions"
        description="Select multiple dates and room types to open or close them in bulk."
      >
        <BulkRangeControls />
      </SectionCard>
    </div>
  )
}
