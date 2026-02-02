import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { BarChart3 } from "lucide-react"

export default function AnalyticsPage() {
  return (
    <PlaceholderPage
      title="Impact Analytics"
      description="Measure and analyze the impact of autonomous finance operations"
      icon={BarChart3}
      features={[
        "ROI tracking and measurement",
        "Time savings analytics",
        "Error reduction metrics",
        "Process efficiency KPIs",
        "Custom dashboard builder"
      ]}
      comingSoon={[
        "Predictive impact forecasting",
        "Comparative benchmarking",
        "Executive reporting templates"
      ]}
    />
  )
}
