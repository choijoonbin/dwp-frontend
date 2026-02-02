import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { Settings } from "lucide-react"

export default function AdminPage() {
  return (
    <PlaceholderPage
      title="Admin"
      description="System administration and user management"
      icon={Settings}
      features={[
        "User and role management",
        "Permission configuration",
        "System settings and preferences",
        "Tenant and company code setup",
        "Security and access controls"
      ]}
      comingSoon={[
        "SSO/SAML configuration",
        "Custom branding options",
        "Advanced security policies"
      ]}
    />
  )
}
