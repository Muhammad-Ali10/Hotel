"use client"

import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { cellPad } from "@/lib/extranet/constants"
import { avatarImage } from "@/lib/images"
import { notificationSettings, securitySettings } from "@/data/extranet/account"
import { useStore } from "@/store"
import { PageHeader, SectionCard, StatusPill } from "@/components/extranet/shared"
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
import { AccountNav } from "./account-nav"
import { AddUserDialog } from "./add-user-dialog"
import { EditProfileDialog } from "./edit-profile-dialog"
import { SettingsToggles } from "./settings-toggles"

const notificationIds = notificationSettings.map((s) => s.id)
const securityIds = securitySettings.map((s) => s.id)

/**
 * The partner's account. Profile, team and preferences all read the store now —
 * the profile dialog, the toggles and Add User each collected a full payload
 * and threw it away behind a success toast.
 */
export function AccountView() {
  const partner = useStore((s) => s.partner)
  const team = useStore((s) => s.team)
  const removeTeamUser = useStore((s) => s.removeTeamUser)

  const profileFields = [
    { label: "Email", value: partner.email },
    { label: "Phone", value: partner.phone },
    { label: "Company", value: partner.company },
    { label: "Location", value: partner.location },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Account" subtitle="Manage your profile, team and security settings" />

      {/* Profile */}
      <Card>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="size-16">
              <AvatarImage src={avatarImage(partner.seed, 128)} alt={partner.name} />
              <AvatarFallback>{partner.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-heading text-lg font-semibold">{partner.name}</h2>
              <p className="text-muted-foreground text-sm">{partner.role}</p>
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
        description={`${team.length} team members`}
        action={<AddUserDialog />}
        contentClassName="px-0"
      >
        <div className="overflow-x-auto">
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
              {team.map((u) => (
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
                  <TableCell className="text-muted-foreground">{u.lastLogin}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${u.name}`}
                      className="text-muted-foreground"
                      disabled={u.email === partner.email}
                      onClick={() => {
                        removeTeamUser(u.id)
                        toast.success(`${u.name} removed from the team.`)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Notification Settings"
          description="Control how you receive updates and alerts"
        >
          <SettingsToggles ids={notificationIds} />
        </SectionCard>

        <SectionCard title="Security" description="Protect your account and your data">
          <SettingsToggles ids={securityIds} />
        </SectionCard>
      </div>
    </div>
  )
}
