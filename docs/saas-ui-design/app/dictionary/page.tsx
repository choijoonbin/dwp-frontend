import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { BookType } from "lucide-react"

export default function DictionaryPage() {
  return (
    <PlaceholderPage
      title="Enterprise Dictionary"
      description="Centralized terminology and business glossary for AI understanding"
      icon={BookType}
      features={[
        "Business term definitions",
        "SAP field mapping glossary",
        "Acronym and abbreviation library",
        "Multi-language terminology support",
        "Context-aware term suggestions"
      ]}
      comingSoon={[
        "Term relationship mapping",
        "Auto-discovery of new terms",
        "Integration with SAP Data Dictionary"
      ]}
    />
  )
}
