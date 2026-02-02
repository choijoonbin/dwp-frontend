"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw
} from "lucide-react"

interface Document {
  id: string
  type: 'original' | 'reversal' | 'credit_memo' | 'payment' | 'clearing'
  number: string
  date: string
  amount: number
  currency: string
  status: 'posted' | 'pending' | 'cleared' | 'reversed'
}

interface DocumentRelationshipGraphProps {
  documents: Document[]
  className?: string
}

const documentTypeConfig = {
  original: { label: 'Original Invoice', color: 'bg-info/20 text-info border-info/30' },
  reversal: { label: 'Reversal', color: 'bg-warning/20 text-warning border-warning/30' },
  credit_memo: { label: 'Credit Memo', color: 'bg-primary/20 text-primary border-primary/30' },
  payment: { label: 'Payment', color: 'bg-success/20 text-success border-success/30' },
  clearing: { label: 'Clearing', color: 'bg-muted text-muted-foreground border-border' }
}

const statusConfig = {
  posted: { icon: CheckCircle2, color: 'text-success' },
  pending: { icon: Clock, color: 'text-warning' },
  cleared: { icon: CheckCircle2, color: 'text-primary' },
  reversed: { icon: RotateCcw, color: 'text-destructive' }
}

export function DocumentRelationshipGraph({ documents, className }: DocumentRelationshipGraphProps) {
  return (
    <Card className={cn("bg-card", className)}>
      <CardHeader className="pb-2 p-3">
        <CardTitle className="text-xs font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Document Relationship
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="relative">
          {/* Flow Diagram */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {documents.map((doc, index) => {
              const typeConfig = documentTypeConfig[doc.type]
              const StatusIcon = statusConfig[doc.status].icon
              
              return (
                <div key={doc.id} className="flex items-center gap-2">
                  {/* Document Node */}
                  <div className={cn(
                    "relative flex flex-col items-center min-w-[100px] p-2 rounded-lg border",
                    typeConfig.color
                  )}>
                    {/* Status indicator */}
                    <div className={cn(
                      "absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background flex items-center justify-center",
                      statusConfig[doc.status].color
                    )}>
                      <StatusIcon className="h-3 w-3" />
                    </div>
                    
                    <span className="text-[9px] font-medium uppercase opacity-70">
                      {typeConfig.label}
                    </span>
                    <span className="text-xs font-mono font-bold mt-0.5">
                      {doc.number}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {doc.date}
                    </span>
                    <span className="text-xs font-medium mt-0.5">
                      {doc.currency} {doc.amount.toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Arrow connector */}
                  {index < documents.length - 1 && (
                    <div className="flex items-center">
                      <div className="w-4 h-0.5 bg-border" />
                      <ArrowRight className="h-4 w-4 text-muted-foreground -mx-1" />
                      <div className="w-4 h-0.5 bg-border" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-border">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-success" />
              <span>Posted</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3 text-warning" />
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <RotateCcw className="h-3 w-3 text-destructive" />
              <span>Reversed</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
