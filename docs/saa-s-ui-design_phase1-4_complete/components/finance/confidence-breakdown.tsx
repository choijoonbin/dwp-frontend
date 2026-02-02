"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  TrendingUp,
  DollarSign,
  History,
  ShieldAlert,
  Clock,
  HelpCircle
} from "lucide-react"

interface ConfidenceFactor {
  id: string
  label: string
  score: number
  weight: number
  description: string
  icon: 'amount' | 'history' | 'policy' | 'timing' | 'pattern'
}

interface ConfidenceBreakdownProps {
  factors: ConfidenceFactor[]
  totalScore: number
  className?: string
}

const iconMap = {
  amount: DollarSign,
  history: History,
  policy: ShieldAlert,
  timing: Clock,
  pattern: TrendingUp
}

export function ConfidenceBreakdown({ factors, totalScore, className }: ConfidenceBreakdownProps) {
  return (
    <Card className={cn("bg-card", className)}>
      <CardHeader className="pb-3 p-4">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Confidence Score Breakdown
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Each factor contributes to the overall confidence score based on its weight. 
                  Higher weights indicate more significant factors in the analysis.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        {/* Overall Score */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm font-medium text-foreground">Total Confidence</span>
          <span className={cn(
            "text-2xl font-bold",
            totalScore >= 90 ? "text-success" :
            totalScore >= 70 ? "text-primary" :
            totalScore >= 50 ? "text-warning" :
            "text-destructive"
          )}>
            {totalScore}%
          </span>
        </div>

        {/* Individual Factors */}
        <div className="space-y-3">
          {factors.map((factor) => {
            const Icon = iconMap[factor.icon]
            const contribution = Math.round((factor.score * factor.weight) / 100)
            
            return (
              <div key={factor.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-6 w-6 rounded flex items-center justify-center",
                      factor.score >= 90 ? "bg-success/20 text-success" :
                      factor.score >= 70 ? "bg-primary/20 text-primary" :
                      factor.score >= 50 ? "bg-warning/20 text-warning" :
                      "bg-destructive/20 text-destructive"
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="text-left">
                          <span className="font-medium">{factor.label}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-[200px]">{factor.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Weight: {factor.weight}%
                    </span>
                    <span className={cn(
                      "font-bold text-sm min-w-[40px] text-right",
                      factor.score >= 90 ? "text-success" :
                      factor.score >= 70 ? "text-primary" :
                      factor.score >= 50 ? "text-warning" :
                      "text-destructive"
                    )}>
                      {factor.score}%
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <Progress 
                    value={factor.score} 
                    className="h-2 bg-muted"
                  />
                  {/* Contribution indicator */}
                  <div 
                    className="absolute top-0 h-2 bg-foreground/20 rounded-full"
                    style={{ width: `${factor.weight}%`, right: 0 }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Contributes ~{contribution}% to total score
                </div>
              </div>
            )
          })}
        </div>

        {/* Formula explanation */}
        <div className="pt-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground">
            Total = Sum of (Factor Score x Factor Weight) / 100
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
