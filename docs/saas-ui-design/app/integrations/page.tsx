import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Plug } from "lucide-react"

export default function IntegrationsPage() {
  return (
    <PlaceholderPage
      title="Integrations & Data Ops"
      description="Manage connections to SAP and external systems"
      icon={Plug}
      features={[
        "SAP RFC/BAPI connection management",
        "Data sync scheduling and monitoring",
        "API endpoint configuration",
        "Webhook management",
        "Integration health monitoring"
      ]}
      comingSoon={[
        "No-code integration builder",
        "Third-party app marketplace",
        "Real-time streaming integration"
      ]}
    />
  )
}
