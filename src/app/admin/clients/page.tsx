import type { Metadata } from "next"

import { ClientsView } from "./_components/clients-view"

export const metadata: Metadata = { title: "Clients · Stayora Admin" }

export default function AdminClientsPage() {
  return <ClientsView />
}
