import { MoreHorizontal } from "lucide-react"

import {
  currentUser,
  notificationSettings,
  securitySettings,
  teamUsers,
} from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { avatarImage } from "@/lib/images"
import {
  PageHeader,
  SectionCard,
  StatusPill,
} from "@/components/extranet/shared"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AccountNav } from "./_components/account-nav"
import { AddUserDialog } from "./_components/add-user-dialog"
import { EditProfileDialog } from "./_components/edit-profile-dialog"
import { SettingsToggles } from "./_components/settings-toggles"

const profileFields = [
  { label: "Email", value: currentUser.email },
  { label: "Phone", value: currentUser.phone },
  { label: "Company", value: currentUser.company },
  { label: "Location", value: currentUser.location },
]

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Account"
        subtitle="Manage your profile, team and security settings"
      />

      {/* Profile */}
      <Card>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="size-16">
              <AvatarImage
                src={avatarImage(currentUser.seed, 128)}
                alt={currentUser.name}
              />
              <AvatarFallback>SM</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-heading text-lg font-semibold">
                {currentUser.name}
              </h2>
              <p className="text-muted-foreground text-sm">{currentUser.role}</p>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            {profileFields.map((f) => (
              <div key={f.label} className="space-y-0.5">
                <p className="text-muted-foreground text-xs">{f.label}</p>
                <p className="text-sm font-medium">{f.value}</p>
              </div>
            ))}
          </div>

          <EditProfileDialog />
        </CardContent>
      </Card>

      <AccountNav />

      {/* Team */}
      <SectionCard
        title="Create & Manage Users"
        description={`${teamUsers.length} team members`}
        action={<AddUserDialog />}
        contentClassName="px-0"
      >
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamUsers.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarImage src={avatarImage(u.seed)} alt={u.name} />
                      <AvatarFallback>{u.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{u.role}</Badge>
                </TableCell>
                <TableCell>
                  <StatusPill status={u.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.lastLogin}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">User actions</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Notification Settings"
          description="Control how you receive updates and alerts"
        >
          <SettingsToggles settings={notificationSettings} />
        </SectionCard>

        <SectionCard
          title="Security"
          description="Manage your account security settings"
        >
          <SettingsToggles settings={securitySettings} />
        </SectionCard>
      </div>
    </div>
  )
}
