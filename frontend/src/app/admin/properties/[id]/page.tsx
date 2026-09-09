import { PropertyDetailView } from "./_components/property-detail-view"

export default async function AdminPropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PropertyDetailView id={id} />
}
