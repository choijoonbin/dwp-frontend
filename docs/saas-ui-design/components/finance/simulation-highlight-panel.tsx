"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Play,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Database
} from "lucide-react"

interface FieldChange {
  id: string
  field: string
  table: string
  system: string
  currentValue: string
  newValue: string
  changeType: 'update' | 'create' | 'delete' | 'lock'
  riskLevel: 'safe' | 'warning' | 'critical'
}

interface SimulationHighlightPanelProps {
  changes: FieldChange[]
  isActive: boolean
  className?: string
}

const changeTypeConfig = {
  update: { label: 'Update', icon: ArrowRight },
  create: { label: 'Create', icon: CheckCircle2 },
  delete: { label: 'Delete', icon: Ban },
  lock: { label: 'Lock', icon: Ban }
}

const riskLevelConfig = {
  safe: { color: 'bg-success/20 text-success border-success/30', highlight: 'ring-2 ring-success/50' },
  warning: { color: 'bg-warning/20 text-warning border-warning/30', highlight: 'ring-2 ring-warning/50' },
  critical: { color: 'bg-destructive/20 text-destructive border-destructive/30', highlight: 'ring-2 ring-destructive/50' }
}

export function SimulationHighlightPanel({ changes, isActive, className }: SimulationHighlightPanelProps) {
  if (!isActive) return null

  return (
    <Card className={cn("bg-primary/5 border-primary/20", className)}>
      <CardHeader className="pb-2 p-3">
        <CardTitle className="text-xs font-medium flex items-center gap-2">
          <Play className="h-4 w-4 text-primary" />
          SAP ERP Field Changes Preview
          <Badge variant="outline" className="ml-auto text-[10px]">Simulation</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {changes.map((change) => {
              const typeConfig = changeTypeConfig[change.changeType]
              const riskConfig = riskLevelConfig[change.riskLevel]
              const TypeIcon = typeConfig.icon

              return (
                <div
                  key={change.id}
                  className={cn(
                    "p-3 rounded-lg border transition-all",
                    riskConfig.color,
                    riskConfig.highlight
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5" />
                      <span className="text-xs font-mono">{change.system}</span>
                      <span className="text-xs text-muted-foreground">/</span>
                      <span className="text-xs font-mono">{change.table}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <TypeIcon className="h-3 w-3" />
                      {typeConfig.label}
                    </Badge>
                  </div>

                  <div className="text-sm font-medium mb-2">{change.field}</div>

                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex-1 p-2 rounded bg-background/50 font-mono">
                      <span className="text-muted-foreground text-[10px] block mb-0.5">Current:</span>
                      <span className={cn(
                        change.changeType === 'delete' && "line-through text-muted-foreground"
                      )}>
                        {change.currentValue || '(empty)'}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 flex-shrink-0" />
                    <div className={cn(
                      "flex-1 p-2 rounded font-mono font-medium",
                      change.riskLevel === 'safe' && "bg-success/10 text-success",
                      change.riskLevel === 'warning' && "bg-warning/10 text-warning",
                      change.riskLevel === 'critical' && "bg-destructive/10 text-destructive"
                    )}>
                      <span className="text-[10px] block mb-0.5 opacity-70">New:</span>
                      {change.newValue}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>{changes.length} field(s) will be modified</span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-success" />
              Safe
            </span>
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-warning" />
              Warning
            </span>
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-destructive" />
              Critical
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
