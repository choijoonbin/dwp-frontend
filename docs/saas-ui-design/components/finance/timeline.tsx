"use client"

import React from "react"

import { cn } from "@/lib/utils"
import { 
  FileText, 
  Zap, 
  Play, 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  Clock,
  Bot,
  User,
  Shield
} from "lucide-react"
import type { AuditEvent } from "@/lib/mock-data"

interface TimelineProps {
  events: AuditEvent[]
  compact?: boolean
  className?: string
}

const eventIcons: Record<AuditEvent['eventType'], React.ElementType> = {
  case_created: FileText,
  action_proposed: Zap,
  simulation_run: Play,
  approval_requested: Clock,
  action_approved: CheckCircle2,
  action_rejected: XCircle,
  action_executed: Shield,
  comment_added: MessageSquare
}

const actorIcons: Record<AuditEvent['actorType'], React.ElementType> = {
  system: Shield,
  user: User,
  agent: Bot
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function Timeline({ events, compact = false, className }: TimelineProps) {
  return (
    <div className={cn("relative", className)}>
      <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
      <div className={cn("space-y-4", compact && "space-y-2")}>
        {events.map((event, index) => {
          const EventIcon = eventIcons[event.eventType]
          const ActorIcon = actorIcons[event.actorType]
          
          return (
            <div key={event.id} className="relative flex gap-3">
              <div className={cn(
                "relative z-10 flex items-center justify-center rounded-full border bg-background",
                compact ? "h-6 w-6" : "h-7 w-7",
                event.actorType === 'agent' && "border-primary/50 bg-primary/10",
                event.actorType === 'user' && "border-info/50 bg-info/10",
                event.actorType === 'system' && "border-muted-foreground/50"
              )}>
                <EventIcon className={cn(
                  compact ? "h-3 w-3" : "h-3.5 w-3.5",
                  event.actorType === 'agent' && "text-primary",
                  event.actorType === 'user' && "text-info",
                  event.actorType === 'system' && "text-muted-foreground"
                )} />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <ActorIcon className="h-3 w-3 text-muted-foreground" />
                    <span className={cn(
                      "font-medium text-foreground",
                      compact ? "text-xs" : "text-sm"
                    )}>
                      {event.actor}
                    </span>
                  </div>
                  <span className={cn(
                    "text-muted-foreground",
                    compact ? "text-[10px]" : "text-xs"
                  )}>
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                <p className={cn(
                  "text-muted-foreground mt-0.5 leading-relaxed",
                  compact ? "text-xs" : "text-sm"
                )}>
                  {event.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
