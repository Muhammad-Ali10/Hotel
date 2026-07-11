import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { contacts } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { avatarImage } from "@/lib/images"
import { PageHeader } from "@/components/extranet/shared"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        subtitle="Key contacts and emergency numbers for your properties"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/account" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Property</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarImage src={avatarImage(c.seed)} alt={c.name} />
                      <AvatarFallback>{c.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{c.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.email}</TableCell>
                <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                <TableCell>{c.role}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.property}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
