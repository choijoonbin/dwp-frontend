"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, FileText, ExternalLink, Quote } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Policy } from "@/lib/mock-data"

interface EvidencePanelProps {
  policies: Policy[]
  className?: string
}

export function EvidencePanel({ policies, className }: EvidencePanelProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Quote className="h-4 w-4 text-primary" />
        RAG Citations
      </h4>
      <div className="space-y-2">
        {policies.map((policy) => (
          <EvidenceCard key={policy.id} policy={policy} />
        ))}
      </div>
    </div>
  )
}

function EvidenceCard({ policy }: { policy: Policy }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
      >
        <div className="mt-0.5">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground truncate">{policy.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {policy.category}
            </span>
            <span className="text-xs text-muted-foreground">
              Updated: {policy.lastUpdated}
            </span>
          </div>
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <div className="ml-7 pl-3 border-l-2 border-primary/30">
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              "{policy.content}"
            </p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                Source: {policy.source}
              </span>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                <ExternalLink className="h-3 w-3" />
                View Full
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
