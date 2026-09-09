import type { Metadata } from "next"

import { CancellationsView } from "./_components/cancellations-view"

export const metadata: Metadata = { title: "Cancellations" }

export default function AdminCancellationsPage() {
  return <CancellationsView />
}
