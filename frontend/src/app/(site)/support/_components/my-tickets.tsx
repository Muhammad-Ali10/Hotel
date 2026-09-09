"use client"

import { TicketList } from "@/components/shared/ticket-list"

/**
 * The public support page's ticket list.
 *
 * `audience` and `authorName` are gone as props: the API returns the caller's
 * own tickets and knows who they are, so passing either was a claim the client
 * had no standing to make.
 */
export function MyTickets() {
  return <TicketList />
}
