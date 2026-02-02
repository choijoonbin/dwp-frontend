import { FiDocumentDetailClient } from "./fi-document-detail-client"

export default function FiDocumentDetailPage({ params }: { params: { id: string } }) {
  return <FiDocumentDetailClient docId={params.id} />
}
