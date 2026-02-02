import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { MessageSquareMore } from "lucide-react"

export default function FeedbackPage() {
  return (
    <PlaceholderPage
      title="Feedback & Labeling"
      description="Human feedback collection for continuous AI improvement"
      icon={MessageSquareMore}
      features={[
        "Decision feedback capture",
        "Data labeling workflows",
        "Correction tracking and learning",
        "Feedback quality scoring",
        "Model improvement metrics"
      ]}
      comingSoon={[
        "Active learning suggestions",
        "Crowd-sourced labeling",
        "Feedback-driven retraining"
      ]}
    />
  )
}
