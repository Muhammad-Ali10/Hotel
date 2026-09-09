import { GuestDetailView } from "./_components/guest-detail-view"

export default async function AdminGuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <GuestDetailView id={id} />
}
