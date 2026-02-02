import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Sliders } from "lucide-react"

export default function AutonomyPage() {
  return (
    <PlaceholderPage
      title="Autonomy Level"
      description="Configure AI autonomy levels for different operation types"
      icon={Sliders}
      features={[
        "Per-action type autonomy settings",
        "Amount-based autonomy tiers",
        "Entity-specific autonomy rules",
        "Time-based autonomy schedules",
        "Gradual autonomy escalation"
      ]}
      comingSoon={[
        "ML-driven autonomy recommendations",
        "Risk-based autonomy adjustment",
        "Autonomy simulation sandbox"
      ]}
    />
  )
}
