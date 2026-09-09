"use client"

import * as React from "react"
import { toast } from "sonner"

import { cellPad } from "@/lib/extranet/constants"
import { usePartnerOrg, useTeam, useTeamActions } from "@/lib/api/hooks"
import { SectionCard } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Who to call, and about what.
 *
 * This looked like it needed a table of its own — "key contacts and emergency
 * numbers" — and it does not. The people who answer for a property are the
 * TEAM: the same rows, with a phone number and what they do beside them. A
 * second list would immediately drift from the first, and somebody would be
 * called on a number nobody had updated since they left.
 *
 * So the job title is editable here and nowhere else, because this is the
 * screen where "who handles finance" is the question being asked.
 */
export function ContactsView() {
  const org = usePartnerOrg()
  const team = useTeam()
  const { update } = useTeamActions()

  const [editing, setEditing] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState("")

  const members = team.data?.members ?? []

  function save(memberId: string) {
    update.mutate(
      { memberId, patch: { jobTitle: draft.trim() } },
      {
        onSuccess: () => {
          setEditing(null)
          setDraft("")
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="The organisation"
        description="Where the platform writes when it needs an answer from the business rather than from a person."
      >
        {org.isPending ? (
          <div className="bg-muted h-12 animate-pulse rounded-lg" aria-busy="true" />
        ) : (
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span>
              <span className="text-muted-foreground">Email </span>
              {org.data?.contactEmail ?? "—"}
            </span>
            <span>
              <span className="text-muted-foreground">Phone </span>
              {org.data?.contactPhone || "Not set"}
            </span>
          </div>
        )}
      </SectionCard>

      <div className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">People</h2>

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
                    <TableHead>Does what</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Access</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.firstName} {member.lastName}
                      </TableCell>
                      <TableCell>
                        {editing === member.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={draft}
                              autoFocus
                              className="h-8 w-48"
                              placeholder="e.g. Front office manager"
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") save(member.id)
                                if (e.key === "Escape") setEditing(null)
                              }}
                            />
                            <Button
                              size="xs"
                              disabled={update.isPending}
                              onClick={() => save(member.id)}
                            >
                              Save
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="hover:bg-accent -mx-2 rounded px-2 py-1 text-left text-sm"
                            onClick={() => {
                              setEditing(member.id)
                              setDraft(member.jobTitle)
                            }}
                          >
                            {member.jobTitle || (
                              <span className="text-muted-foreground">Not set</span>
                            )}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <a href={`mailto:${member.email}`} className="hover:underline">
                          {member.email}
                        </a>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {/*
                         * A phone number belongs to the PERSON, not the org, so
                         * only they can change it — from their own profile.
                         */}
                        {member.phone ? (
                          <a href={`tel:${member.phone}`} className="hover:underline">
                            {member.phone}
                          </a>
                        ) : (
                          "Not shared"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{member.role}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                        Nobody on this account yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        <p className="text-muted-foreground text-sm">
          Job titles say what somebody does; the role beside it says what they may
          change. They are not the same thing, and the role is set on the Account
          screen.
        </p>
      </div>
    </div>
  )
}
