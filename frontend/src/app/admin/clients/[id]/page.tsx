import { ClientDetailView } from "./_components/client-detail-view"

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ClientDetailView id={id} />
}
