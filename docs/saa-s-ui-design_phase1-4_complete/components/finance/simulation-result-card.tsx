"use client"

import { cn } from "@/lib/utils"
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Box, 
  Shield,
  ChevronRight
} from "lucide-react"
import type { SimulationResult } from "@/lib/mock-data"

interface SimulationResultCardProps {
  result: SimulationResult
  className?: string
}

export function SimulationResultCard({ result, className }: SimulationResultCardProps) {
  const allValidationsPassed = result.validations.every(v => v.passed)

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      result.predictedSuccess ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5",
      className
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 border-b",
        result.predictedSuccess ? "border-success/20 bg-success/10" : "border-destructive/20 bg-destructive/10"
      )}>
        {result.predictedSuccess ? (
          <CheckCircle2 className="h-5 w-5 text-success" />
        ) : (
          <XCircle className="h-5 w-5 text-destructive" />
        )}
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            {result.predictedSuccess ? "Simulation Passed" : "Simulation Failed"}
          </h4>
          <p className="text-xs text-muted-foreground">
            Pre-execution validation complete
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Impacted Objects */}
        <div>
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Box className="h-3.5 w-3.5" />
            Impacted Objects
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {result.impactedObjects.map((obj, i) => (
              <span 
                key={i}
                className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-md text-foreground"
              >
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                {obj}
              </span>
            ))}
          </div>
        </div>

        {/* Validations */}
        <div>
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Validations
          </h5>
          <div className="space-y-1.5">
            {result.validations.map((validation, i) => (
              <div 
                key={i}
                className="flex items-center gap-2 text-sm"
              >
                {validation.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                )}
                <span className="font-medium text-foreground">{validation.name}:</span>
                <span className="text-muted-foreground">{validation.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Notes */}
        {result.riskNotes.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Risk Notes
            </h5>
            <div className="space-y-1">
              {result.riskNotes.map((note, i) => (
                <div 
                  key={i}
                  className="flex items-start gap-2 text-sm text-warning bg-warning/10 px-3 py-2 rounded-md"
                >
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {note}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
