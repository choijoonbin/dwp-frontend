import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { FileBarChart } from "lucide-react"

export default function ReconciliationPage() {
  return (
    <PlaceholderPage
      title="Reconciliation Report"
      description="Financial reconciliation reports and balance verification"
      icon={FileBarChart}
      features={[
        "Inter-company reconciliation",
        "Bank statement matching",
        "GL to sub-ledger reconciliation",
        "Variance analysis and reporting",
        "Automated reconciliation scheduling"
      ]}
      comingSoon={[
        "AI-assisted matching suggestions",
        "Real-time reconciliation status",
        "Custom reconciliation rules"
      ]}
    />
  )
}
