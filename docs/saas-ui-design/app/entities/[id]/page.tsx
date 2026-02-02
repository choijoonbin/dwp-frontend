import { EntityProfileClient } from "./entity-profile-client"

export default function EntityDetailPage({ params }: { params: { id: string } }) {
  return <EntityProfileClient entityId={params.id} />
}
