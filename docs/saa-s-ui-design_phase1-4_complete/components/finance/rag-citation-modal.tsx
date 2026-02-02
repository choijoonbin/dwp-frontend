"use client"

import React from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  FileText,
  ExternalLink,
  Download,
  Quote,
  Calendar,
  BookOpen
} from "lucide-react"

interface RAGCitation {
  id: string
  policyName: string
  category: string
  content: string
  source: string
  page?: number
  relevanceScore: number
  lastUpdated: string
  excerpt?: string
}

interface RAGCitationModalProps {
  citation: RAGCitation
  children: React.ReactNode
}

export function RAGCitationModal({ citation, children }: RAGCitationModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Policy Citation
          </DialogTitle>
          <DialogDescription>
            Source document and excerpt from the RAG knowledge base
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full max-h-[60vh]">
            <div className="space-y-4">
              {/* Policy Header */}
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{citation.policyName}</h3>
                    <Badge variant="outline" className="mt-1 text-xs">{citation.category}</Badge>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-muted-foreground">Relevance:</span>
                      <span className={cn(
                        "font-bold",
                        citation.relevanceScore >= 90 ? "text-success" :
                        citation.relevanceScore >= 70 ? "text-primary" :
                        "text-warning"
                      )}>
                        {citation.relevanceScore}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {citation.source}
                  </span>
                  {citation.page && (
                    <span className="flex items-center gap-1">
                      Page {citation.page}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Updated: {citation.lastUpdated}
                  </span>
                </div>
              </div>

              {/* Highlighted Quote */}
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-full" />
                <div className="pl-4 py-2">
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                    <Quote className="h-4 w-4 text-primary" />
                    <span>Referenced excerpt</span>
                  </div>
                  <p className="text-sm text-foreground bg-primary/5 p-3 rounded-lg border border-primary/20 leading-relaxed">
                    {citation.content}
                  </p>
                </div>
              </div>

              {/* Mock PDF Preview */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Document Preview (Page {citation.page || 1})
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 bg-transparent">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Full
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 bg-transparent">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
                <div className="p-6 bg-background min-h-[200px]">
                  {/* Mock PDF Content */}
                  <div className="max-w-lg mx-auto space-y-4 text-sm">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-5/6" />
                    
                    {/* Highlighted section */}
                    <div className="p-3 bg-yellow-500/10 border-l-2 border-yellow-500 rounded-r">
                      <p className="text-xs text-foreground">
                        {citation.content}
                      </p>
                    </div>
                    
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-4/5" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </div>
                </div>
              </div>

              {/* Additional Context */}
              <div className="p-4 rounded-lg bg-info/10 border border-info/20">
                <h4 className="text-sm font-medium text-info mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  AI Analysis Note
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This policy excerpt was retrieved with {citation.relevanceScore}% relevance to the current case context. 
                  The AI identified key matching terms including: invoice validation, duplicate detection, and payment threshold rules.
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
