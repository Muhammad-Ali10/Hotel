"use client"

import { AdminPageHeader, InfoNote } from "@/components/admin/shared"

/**
 * The header, and nothing else.
 *
 * Four stat tiles used to live here and a tab bar under them. Both are gone:
 *
 *   - **"Bookings generated"** counted nothing. No endpoint attributes
 *     bookings to a campaign, and a marketplace-wide claim that promotions
 *     produced N bookings — with no way to check it — is the least defensible
 *     number on a page full of them.
 *   - **"Discount rankings"** was a second route ranking properties by how
 *     deeply they discount. There is no such endpoint either, and the useful
 *     half of it — which campaigns are cutting most — is a property of the
 *     promotion list, so it lives on that list now.
 *
 * The counts that ARE knowable are on the list itself, where they describe the
 * rows underneath them.
 */
export function PromotionsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Promotions Oversight"
        subtitle="Every campaign running across the marketplace"
      />

      {children}

      <InfoNote>
        A promotion belongs to the client who created it — the platform watches
        rather than edits. Only one applies to a stay, and it is the best one
        for the guest.
      </InfoNote>
    </div>
  )
}
