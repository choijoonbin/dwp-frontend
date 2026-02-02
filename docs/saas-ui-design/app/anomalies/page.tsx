import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { AlertTriangle } from "lucide-react"

export default function AnomaliesPage() {
  return (
    <PlaceholderPage
      title="Anomaly Detection"
      description="AI-powered anomaly detection across financial transactions"
      icon={AlertTriangle}
      features={[
        "Real-time anomaly detection using ML models",
        "Pattern recognition for duplicate payments",
        "Vendor behavior analysis and risk scoring",
        "Configurable detection thresholds",
        "Integration with SAP FI modules"
      ]}
      comingSoon={[
        "Custom anomaly rules builder",
        "Anomaly clustering and categorization",
        "Predictive anomaly forecasting"
      ]}
    />
  )
}
