"use client"

import React from "react"

import { cn } from "@/lib/utils"
import { Circle, Clock, CheckCircle2, XCircle, Loader2, Pause } from "lucide-react"

type Status = "open" | "in_progress" | "pending_approval" | "resolved" | "dismissed" | "pending" | "approved" | "rejected" | "executed" | "failed"

interface StatusPillProps {
  status: Status
  size?: "sm" | "md" | "lg"
  className?: string
}

const statusConfig: Record<Status, { label: string; icon: React.ElementType; className: string }> = {
  open: {
    label: "Open",
    icon: Circle,
    className: "bg-muted text-foreground"
  },
  in_progress: {
    label: "In Progress",
    icon: Loader2,
    className: "bg-info/15 text-info"
  },
  pending_approval: {
    label: "Pending Approval",
    icon: Clock,
    className: "bg-warning/15 text-warning"
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-warning/15 text-warning"
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    className: "bg-success/15 text-success"
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "bg-success/15 text-success"
  },
  dismissed: {
    label: "Dismissed",
    icon: XCircle,
    className: "bg-muted text-muted-foreground"
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-destructive/15 text-destructive"
  },
  executed: {
    label: "Executed",
    icon: CheckCircle2,
    className: "bg-success/15 text-success"
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-destructive/15 text-destructive"
  }
}

const sizeConfig = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2 py-1 gap-1.5",
  lg: "text-sm px-2.5 py-1.5 gap-2"
}

export function StatusPill({ status, size = "md", className }: StatusPillProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  const isAnimated = status === "in_progress"

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        sizeConfig[size],
        config.className,
        className
      )}
    >
      <Icon className={cn(
        size === "sm" ? "h-3 w-3" : size === "md" ? "h-3.5 w-3.5" : "h-4 w-4",
        isAnimated && "animate-spin"
      )} />
      {config.label}
    </span>
  )
}
