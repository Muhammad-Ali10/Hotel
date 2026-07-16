"use client"

import { useProfile } from "@/store/selectors"
import { TicketList } from "@/components/shared/ticket-list"

export function MyTickets() {
  const profile = useProfile()
  return <TicketList audience="customer" authorName={profile.firstName} />
}
