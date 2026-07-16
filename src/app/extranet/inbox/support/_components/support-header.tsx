"use client"

import { useTickets } from "@/store/selectors"
import { PageHeader } from "@/components/extranet/shared"
import { GenerateTicketDialog } from "../../_components/generate-ticket-dialog"

/**
 * Counts the tickets rendered directly below. The header used to count a legacy
 * SUP-00x array while the list showed the store, so it claimed one resolved
 * ticket above a list that had none.
 */
export function SupportHeader() {
  const tickets = useTickets("partner")
  const open = tickets.filter((t) => t.status === "open").length
  const inProgress = tickets.filter((t) => t.status === "in_progress").length
  const resolved = tickets.filter((t) => t.status === "resolved").length

  return (
    <PageHeader
      title="Support"
      subtitle={`${tickets.length} ${tickets.length === 1 ? "ticket" : "tickets"} · ${open} open · ${inProgress} in progress · ${resolved} resolved`}
    >
      <GenerateTicketDialog />
    </PageHeader>
  )
}
