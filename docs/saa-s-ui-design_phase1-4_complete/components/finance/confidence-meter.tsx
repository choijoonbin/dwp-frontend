"use client"

import { cn } from "@/lib/utils"

interface ConfidenceMeterProps {
  value: number
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

function getConfidenceColor(value: number) {
  if (value >= 90) return "bg-success"
  if (value >= 70) return "bg-warning"
  return "bg-destructive"
}

function getConfidenceTextColor(value: number) {
  if (value >= 90) return "text-success"
  if (value >= 70) return "text-warning"
  return "text-destructive"
}

const sizeConfig = {
  sm: { height: "h-1", width: "w-16", text: "text-[10px]" },
  md: { height: "h-1.5", width: "w-20", text: "text-xs" },
  lg: { height: "h-2", width: "w-24", text: "text-sm" }
}

export function ConfidenceMeter({ value, showLabel = true, size = "md", className }: ConfidenceMeterProps) {
  const config = sizeConfig[size]
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("bg-muted rounded-full overflow-hidden", config.height, config.width)}>
        <div 
          className={cn("h-full rounded-full transition-all", getConfidenceColor(value))}
          style={{ width: `${value}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn("font-medium tabular-nums", config.text, getConfidenceTextColor(value))}>
          {value}%
        </span>
      )}
    </div>
  )
}

export function ConfidenceRing({ value, size = 60, strokeWidth = 4, className }: { value: number; size?: number; strokeWidth?: number; className?: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-all duration-500",
            value >= 90 ? "text-success" : value >= 70 ? "text-warning" : "text-destructive"
          )}
        />
      </svg>
      <span className={cn(
        "absolute text-sm font-bold tabular-nums",
        getConfidenceTextColor(value)
      )}>
        {value}%
      </span>
    </div>
  )
}
