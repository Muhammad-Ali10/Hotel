"use client"

import { usePartnerTickets } from "@/lib/api/hooks"
import { PageHeader } from "@/components/extranet/shared"
import { GenerateTicketDialog } from "../../_components/generate-ticket-dialog"

/**
 * Counts the tickets rendered directly below.
 *
 * The header used to count a separate array while the list showed another, so
 * it claimed a resolved ticket above a list that had none.
 */
export function SupportHeader() {
  const tickets = usePartnerTickets()

  const list = tickets.data ?? []
  const open = list.filter((t) => t.status === "open").length
  const inProgress = list.filter((t) => t.status === "in_progress").length
  const resolved = list.filter((t) => t.status === "resolved").length

  return (
    <PageHeader
      title="Support"
      subtitle={
        tickets.isPending
          ? "Loading…"
          : `${list.length} ${list.length === 1 ? "ticket" : "tickets"} · ${open} open · ${inProgress} in progress · ${resolved} resolved`
      }
    >
      <GenerateTicketDialog />
    </PageHeader>
  )
}
