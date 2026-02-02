"use client"

import React from "react"

import { cn } from "@/lib/utils"
import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react"

type Severity = "critical" | "high" | "medium" | "low"

interface SeverityBadgeProps {
  severity: Severity
  showIcon?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

const severityConfig: Record<Severity, { label: string; icon: React.ElementType; className: string }> = {
  critical: {
    label: "Critical",
    icon: AlertTriangle,
    className: "bg-destructive/15 text-destructive border-destructive/30"
  },
  high: {
    label: "High",
    icon: AlertCircle,
    className: "bg-warning/15 text-warning border-warning/30"
  },
  medium: {
    label: "Medium",
    icon: Info,
    className: "bg-info/15 text-info border-info/30"
  },
  low: {
    label: "Low",
    icon: CheckCircle,
    className: "bg-success/15 text-success border-success/30"
  }
}

const sizeConfig = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2 py-1 gap-1.5",
  lg: "text-sm px-2.5 py-1.5 gap-2"
}

export function SeverityBadge({ severity, showIcon = true, size = "md", className }: SeverityBadgeProps) {
  const config = severityConfig[severity]
  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-md border",
        sizeConfig[size],
        config.className,
        className
      )}
    >
      {showIcon && <Icon className={cn(size === "sm" ? "h-3 w-3" : size === "md" ? "h-3.5 w-3.5" : "h-4 w-4")} />}
      {config.label}
    </span>
  )
}
