import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Fence } from "lucide-react"

export default function GuardrailsPage() {
  return (
    <PlaceholderPage
      title="Guardrails"
      description="Safety boundaries and limits for autonomous AI operations"
      icon={Fence}
      features={[
        "Financial amount limits and thresholds",
        "Transaction velocity controls",
        "Entity-level restrictions",
        "Time-based operation windows",
        "Escalation triggers configuration"
      ]}
      comingSoon={[
        "Dynamic guardrail adjustment",
        "Guardrail breach analytics",
        "Custom guardrail templates"
      ]}
    />
  )
}
