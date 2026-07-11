import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { roomDifferentiation } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { PageHeader } from "@/components/extranet/shared"
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

export default function RoomDifferentiationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Room Differentiation Tool"
        subtitle="Highlight what makes your rooms stand out from the competition"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/boost" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Room Type</TableHead>
              <TableHead>Market Standard</TableHead>
              <TableHead>Your Offering</TableHead>
              <TableHead>Competitive Advantage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roomDifferentiation.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium whitespace-normal">
                  {r.roomType}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-normal">
                  {r.marketStandard}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {r.yourOffering}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {r.advantage}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
