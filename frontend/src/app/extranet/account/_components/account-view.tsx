"use client"

import * as React from "react"
import Link from "next/link"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { cellPad } from "@/lib/extranet/constants"
import { formatRelativeTime } from "@/lib/format"
import { usePartnerOrg, useSession, useTeam, useTeamActions } from "@/lib/api/hooks"
import { PageHeader, SectionCard } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { InviteUserDialog } from "./add-user-dialog"
import { EditOrgDialog } from "./edit-profile-dialog"

const ROLE_MEANING: Record<string, string> = {
  admin: "Everything, including team, contracts and rate-plan terms",
  manager: "Rates, availability, bookings and content",
  staff: "Bookings and messages only — no prices, no team",
}

/**
 * The organisation, and who is in it.
 *
 * Three things on the old screen collected a full payload and threw it away
 * behind a success toast: the profile dialog, the notification toggles and
 * "Add User". Two of them are now real; the third could not be, and is gone —
 * see the notes on `InviteUserDialog` and on Settings.
 *
 * Roles are spelled out rather than shown as a badge alone. "Manager" tells an
 * owner nothing about whether that person can change a price.
 */
export function AccountView() {
  const me = useSession()
  const org = usePartnerOrg()
  const team = useTeam()
  const { update, remove, revokeInvite } = useTeamActions()

  const members = team.data?.members ?? []
  const invites = team.data?.invites ?? []

  /*
   * Whether this account may change the team at all.
   *
   * The API refuses either way — this only decides whether to show a control
   * that would 403. A button that always fails is worse than no button.
   */
  const myMembership = members.find((m) => m.userId === me.data?.id)
  const isOrgAdmin = myMembership?.role === "admin"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account"
        subtitle={org.data ? org.data.name : "Your organisation and its team"}
      >
        {isOrgAdmin ? <EditOrgDialog /> : null}
      </PageHeader>

      <AccountNav />

      <SectionCard
        title="Organisation"
        description="What guests and the platform see on your paperwork."
      >
        {org.isPending ? (
          <div className="bg-muted h-20 animate-pulse rounded-lg" aria-busy="true" />
        ) : org.error ? (
          <p className="text-destructive text-sm">{org.error.message}</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Name" value={org.data?.name ?? "—"} />
            <Field label="Contact email" value={org.data?.contactEmail ?? "—"} />
            <Field label="Phone" value={org.data?.contactPhone || "Not set"} />
            <Field label="Country" value={org.data?.country || "Not set"} />
          </dl>
        )}
      </SectionCard>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Team</h2>
          {isOrgAdmin ? <InviteUserDialog /> : null}
        </div>

        {team.isPending ? (
          <div className="bg-muted h-40 animate-pulse rounded-xl" aria-busy="true" />
        ) : team.error ? (
          <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
            {team.error.message}
          </div>
        ) : (
          <Card className="py-0">
            <div className="overflow-x-auto">
              <Table className={cellPad}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Properties</TableHead>
                    <TableHead>Last signed in</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <p className="font-medium">
                          {member.firstName} {member.lastName}
                          {member.userId === me.data?.id ? (
                            <span className="text-muted-foreground"> (you)</span>
                          ) : null}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {member.email}
                          {member.jobTitle ? ` · ${member.jobTitle}` : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        {isOrgAdmin && member.userId !== me.data?.id ? (
                          <select
                            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
                            value={member.role}
                            disabled={update.isPending}
                            onChange={(e) =>
                              update.mutate(
                                {
                                  memberId: member.id,
                                  patch: { role: e.target.value as never },
                                },
                                {
                                  onSuccess: () =>
                                    toast.success(
                                      `${member.firstName} is now ${e.target.value}`
                                    ),
                                  onError: (err) => toast.error(err.message),
                                }
                              )
                            }
                          >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="staff">Staff</option>
                          </select>
                        ) : (
                          <Badge variant="secondary">{member.role}</Badge>
                        )}
                        <p className="text-muted-foreground mt-1 text-xs">
                          {ROLE_MEANING[member.role]}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {/*
                         * Empty means EVERY property, not none (rule #21).
                         *
                         * Rendering "0 properties" for the org's owner would
                         * read as somebody locked out of their own portfolio.
                         */}
                        {member.propertyIds.length === 0
                          ? "All properties"
                          : `${member.propertyIds.length} of them`}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {member.lastLoginAt
                          ? formatRelativeTime(member.lastLoginAt)
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isOrgAdmin && member.userId !== me.data?.id ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${member.firstName}`}
                            disabled={remove.isPending}
                            onClick={() =>
                              remove.mutate(member.id, {
                                onSuccess: () =>
                                  toast.success(`${member.firstName} removed`, {
                                    description:
                                      "Their account still exists — they simply lose access to this organisation.",
                                  }),
                                onError: (err) => toast.error(err.message),
                              })
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      {invites.length > 0 ? (
        <SectionCard
          title="Invited, not yet joined"
          description="An invitation is a token the person redeems, which is also what proves the address is theirs."
        >
          <ul className="divide-y">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-muted-foreground text-xs">
                    {invite.role} · expires {formatRelativeTime(invite.expiresAt)}
                  </p>
                </div>
                {isOrgAdmin ? (
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={revokeInvite.isPending}
                    onClick={() =>
                      revokeInvite.mutate(invite.id, {
                        onSuccess: () => toast.success("Invitation revoked"),
                        onError: (err) => toast.error(err.message),
                      })
                    }
                  >
                    Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Your own account"
        description="Password, sessions and what the platform sends you."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/extranet/account/change-password">Change password</Link>}
          />
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/extranet/account/devices">Signed-in devices</Link>}
          />
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href="/extranet/property/messaging">Notification preferences</Link>
            }
          />
        </div>
      </SectionCard>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}
