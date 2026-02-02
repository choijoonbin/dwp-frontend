"use client"

import { cn } from "@/lib/utils"
import { FileText, ArrowRight, RotateCcw, CheckCircle2 } from "lucide-react"

interface ReversalChainItem {
  docNumber: string
  docType: string
  postingDate: string
  amount: number
  currency: string
  status: 'original' | 'reversal' | 'correction'
}

interface ReversalChainViewProps {
  items?: ReversalChainItem[]
  className?: string
}

const defaultItems: ReversalChainItem[] = [
  { docNumber: '1900001100', docType: 'KR', postingDate: '2026-01-15', amount: 125000, currency: 'USD', status: 'original' },
  { docNumber: '1900001234', docType: 'KR', postingDate: '2026-01-28', amount: 125000, currency: 'USD', status: 'reversal' },
]

export function ReversalChainView({ items = defaultItems, className }: ReversalChainViewProps) {
  return (
    <div className={cn("", className)}>
      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-primary" />
        Document Chain
      </h4>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {items.map((item, index) => (
          <div key={item.docNumber} className="flex items-center gap-2">
            <div className={cn(
              "flex-shrink-0 border rounded-lg p-3 min-w-[140px]",
              item.status === 'original' && "bg-muted/50 border-border",
              item.status === 'reversal' && "bg-warning/10 border-warning/30",
              item.status === 'correction' && "bg-success/10 border-success/30"
            )}>
              <div className="flex items-center gap-2 mb-1">
                <FileText className={cn(
                  "h-4 w-4",
                  item.status === 'original' && "text-muted-foreground",
                  item.status === 'reversal' && "text-warning",
                  item.status === 'correction' && "text-success"
                )} />
                <span className="text-xs font-medium text-foreground">{item.docNumber}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>Type: {item.docType}</div>
                <div>{item.postingDate}</div>
                <div className="font-medium text-foreground">
                  {item.currency} {item.amount.toLocaleString()}
                </div>
              </div>
              <div className={cn(
                "text-[10px] font-medium uppercase tracking-wider mt-2",
                item.status === 'original' && "text-muted-foreground",
                item.status === 'reversal' && "text-warning",
                item.status === 'correction' && "text-success"
              )}>
                {item.status}
              </div>
            </div>
            {index < items.length - 1 && (
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
