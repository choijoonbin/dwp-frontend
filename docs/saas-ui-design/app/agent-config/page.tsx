import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Bot } from "lucide-react"

export default function AgentConfigPage() {
  return (
    <PlaceholderPage
      title="Agent Configuration"
      description="Configure and manage AI agent behaviors and capabilities"
      icon={Bot}
      features={[
        "Agent personality and tone settings",
        "Capability enable/disable controls",
        "Processing priority configuration",
        "Agent performance tuning",
        "Multi-agent orchestration rules"
      ]}
      comingSoon={[
        "Custom agent creation",
        "Agent A/B testing",
        "Agent performance benchmarking"
      ]}
    />
  )
}
