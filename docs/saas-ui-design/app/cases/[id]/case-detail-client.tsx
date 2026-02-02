"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  FileText,
  Brain,
  Zap,
  Send,
  Paperclip,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Bot,
  Shield,
  ExternalLink,
  Copy,
  ChevronRight,
  Hash,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  Link2,
  Ban,
  RotateCcw,
  Info,
  History,
  ArrowRight,
  BookOpen,
  Quote
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SeverityBadge } from "@/components/finance/severity-badge"
import { StatusPill } from "@/components/finance/status-pill"
import { ConfidenceRing } from "@/components/finance/confidence-meter"
import { DocumentRelationshipGraph } from "@/components/finance/document-relationship-graph"
import { RAGCitationModal } from "@/components/finance/rag-citation-modal"
import { ConfidenceBreakdown } from "@/components/finance/confidence-breakdown"
import { SimulationHighlightPanel } from "@/components/finance/simulation-highlight-panel"
import {
  mockCases,
  mockFiDocs,
  mockFiDocItems,
  mockPolicies,
  mockAuditEvents,
  mockComments,
  mockActions,
} from "@/lib/mock-data"

interface CaseDetailClientProps {
  caseId: string
}

// Extended mock comments with types
const extendedComments = [
  ...mockComments,
  {
    id: 'cmt-sys-001',
    caseId: 'case-001',
    author: 'System',
    authorType: 'system' as const,
    content: 'Case escalated to Senior Analyst level',
    createdAt: '2026-01-28T16:00:00Z'
  },
  {
    id: 'cmt-sys-002',
    caseId: 'case-001',
    author: 'AI Agent',
    authorType: 'ai' as const,
    content: 'Simulation completed. Reversal action ready for approval.',
    createdAt: '2026-01-28T16:15:00Z'
  }
]

// Mock confidence factors
const mockConfidenceFactors = [
  { id: 'cf-1', label: 'Amount Match', score: 95, weight: 30, description: 'Invoice amount matches previous payment within tolerance', icon: 'amount' as const },
  { id: 'cf-2', label: 'Vendor History', score: 20, weight: 20, description: 'Vendor has limited transaction history for pattern analysis', icon: 'history' as const },
  { id: 'cf-3', label: 'Policy Violation', score: 100, weight: 25, description: 'Clear violation of duplicate invoice policy detected', icon: 'policy' as const },
  { id: 'cf-4', label: 'Timing Pattern', score: 85, weight: 15, description: 'Invoice submitted within 30-day window of similar payment', icon: 'timing' as const },
  { id: 'cf-5', label: 'Data Pattern', score: 92, weight: 10, description: 'Reference number pattern matches previous invoice', icon: 'pattern' as const },
]

// Mock SAP field changes for simulation
const mockFieldChanges = [
  { id: 'fc-1', field: 'Payment Block', table: 'BSEG', system: 'SAP FI', currentValue: 'None', newValue: 'A - Locked for Payment', changeType: 'update' as const, riskLevel: 'safe' as const },
  { id: 'fc-2', field: 'Document Status', table: 'BKPF', system: 'SAP FI', currentValue: 'Posted', newValue: 'Blocked', changeType: 'update' as const, riskLevel: 'warning' as const },
  { id: 'fc-3', field: 'Clearing Document', table: 'BSAK', system: 'SAP FI', currentValue: '', newValue: '4900001234', changeType: 'create' as const, riskLevel: 'safe' as const },
  { id: 'fc-4', field: 'Vendor Balance', table: 'LFC1', system: 'SAP FI', currentValue: '$125,000.00', newValue: '$0.00', changeType: 'update' as const, riskLevel: 'warning' as const },
]

// Mock document relationship
const mockDocumentRelationship = [
  { id: 'DOC-1001', type: 'original' as const, number: '1900001234', date: '2026-01-10', amount: 125000, currency: 'USD', status: 'posted' as const },
  { id: 'DOC-2001', type: 'reversal' as const, number: '1900001235', date: '2026-01-28', amount: 125000, currency: 'USD', status: 'pending' as const },
]

// Mock RAG citations with page info
const mockRAGCitations = mockPolicies.map((p, i) => ({
  ...p,
  relevanceScore: [92, 87, 78][i] || 70,
  page: [12, 45, 8][i] || 1,
  excerpt: p.content
}))

export function CaseDetailClient({ caseId }: CaseDetailClientProps) {
  const caseData = mockCases.find(c => c.id === caseId) || mockCases[0]
  const fiDoc = mockFiDocs.find(d => d.id === caseData.fiDocId) || mockFiDocs[0]
  const fiDocItems = mockFiDocItems.filter(i => i.docId === fiDoc?.id)
  const relatedActions = mockActions.filter(a => a.caseId === caseData.id)
  const caseComments = extendedComments.filter(c => c.caseId === caseData.id)
  const caseAuditEvents = mockAuditEvents.filter(e => e.caseId === caseData.id || !e.caseId)

  const [newComment, setNewComment] = useState("")
  const [simulationMode, setSimulationMode] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<'actions' | 'audit'>('actions')

  // Mock similar cases with similarity scores
  const similarCases = mockCases
    .filter(c => c.id !== caseData.id && c.anomalyType === caseData.anomalyType)
    .slice(0, 3)
    .map(c => ({
      ...c,
      similarity: Math.floor(Math.random() * 20) + 75
    }))

  // Mock simulation result
  const simulationResult = {
    before: { vendorBalance: 125000, glBalance: 450000, openItems: 5 },
    after: { vendorBalance: 0, glBalance: 325000, openItems: 4 },
    outcome: 'success' as const,
    message: 'Reversal will successfully clear the duplicate payment and restore correct balances.'
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Case Header */}
      <div className="border-b border-border bg-background px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/cases">
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 bg-transparent">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">{caseData.title}</h1>
                <SeverityBadge severity={caseData.severity} />
                <StatusPill status={caseData.status} />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  {caseData.caseNumber}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(caseData.detectedAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {caseData.companyCode}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {caseData.amount.toLocaleString()} {caseData.currency}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ConfidenceRing score={caseData.confidence} size="md" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 bg-transparent">
                    <Copy className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Copy ID</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy case ID to clipboard</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 bg-transparent">
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">SAP</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open in SAP</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel - Source Evidence */}
        <div className="lg:w-[360px] w-full border-b lg:border-b-0 lg:border-r border-border flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Source Evidence
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {/* Document Relationship Graph - NEW */}
              <DocumentRelationshipGraph documents={mockDocumentRelationship} />

              {/* FI Document Card - Compact */}
              <Card className="bg-card">
                <CardHeader className="pb-2 p-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium">FI Document</CardTitle>
                    <Badge variant="outline" className="text-[10px] h-5">{fiDoc?.docType}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Doc #</span>
                      <p className="font-mono font-medium truncate">{fiDoc?.docNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date</span>
                      <p className="font-medium">{fiDoc?.postingDate}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount</span>
                      <p className="font-medium">{fiDoc?.totalAmount?.toLocaleString()} {fiDoc?.currency}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vendor</span>
                      <p className="font-medium truncate">{fiDoc?.vendorId}</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <span className="text-xs text-muted-foreground">Line Items ({fiDocItems.length})</span>
                    <div className="mt-1.5 space-y-1">
                      {fiDocItems.slice(0, 2).map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                          <span className="font-mono text-muted-foreground">{item.glAccount}</span>
                          <span className={cn(
                            "font-medium",
                            item.debitCredit === 'D' ? "text-destructive" : "text-success"
                          )}>
                            {item.debitCredit === 'D' ? '-' : '+'}{item.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                      {fiDocItems.length > 2 && (
                        <p className="text-[10px] text-muted-foreground text-center">
                          +{fiDocItems.length - 2} more items
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Open Items Summary */}
              <Card className="bg-card">
                <CardHeader className="pb-2 p-3">
                  <CardTitle className="text-xs font-medium">Related Open Items</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Receivables</span>
                      <p className="font-bold text-lg">3</p>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <span className="text-muted-foreground">Payables</span>
                      <p className="font-bold text-lg">2</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Total: $245,000 | Oldest: 45 days
                  </div>
                </CardContent>
              </Card>

              {/* Data Lineage Link */}
              <Link href={`/lineage?caseId=${caseData.id}`}>
                <Card className="bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">View Data Lineage</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </div>
          </ScrollArea>
        </div>

        {/* Center Panel - AI Analysis */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="analysis" className="flex-1 flex flex-col">
            <div className="px-4 py-2 border-b border-border bg-muted/30">
              <TabsList className="h-8 bg-transparent p-0 gap-4">
                <TabsTrigger value="analysis" className="h-8 px-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm">
                  <Brain className="h-4 w-4 mr-1.5" />
                  AI Analysis
                </TabsTrigger>
                <TabsTrigger value="confidence" className="h-8 px-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm">
                  <TrendingUp className="h-4 w-4 mr-1.5" />
                  Confidence
                </TabsTrigger>
                <TabsTrigger value="similar" className="h-8 px-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm">
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Similar
                </TabsTrigger>
                <TabsTrigger value="policies" className="h-8 px-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm">
                  <Shield className="h-4 w-4 mr-1.5" />
                  RAG
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="analysis" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {/* Anomaly Score - Prominent */}
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Anomaly Confidence Score</p>
                          <p className="text-4xl font-bold text-primary">{caseData.confidence}%</p>
                        </div>
                        <ConfidenceRing score={caseData.confidence} size="lg" />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {caseData.anomalyType.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {caseData.severity} severity
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* AI Reasoning */}
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2 p-4">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Brain className="h-4 w-4 text-muted-foreground" />
                        AI Reasoning
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-sm text-foreground leading-relaxed">
                        {caseData.description}
                      </p>
                      <Separator className="my-3" />
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground">Key Factors</span>
                        <ul className="space-y-1.5">
                          <li className="flex items-start gap-2 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                            <span>Amount matches previous payment within 30-day window</span>
                          </li>
                          <li className="flex items-start gap-2 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                            <span>Same vendor and invoice reference pattern detected</span>
                          </li>
                          <li className="flex items-start gap-2 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 flex-shrink-0" />
                            <span>Vendor bank account changed 48 hours prior</span>
                          </li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="confidence" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <ConfidenceBreakdown 
                    factors={mockConfidenceFactors} 
                    totalScore={caseData.confidence}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="similar" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    Cases with similar patterns and characteristics
                  </p>
                  {similarCases.map((c) => (
                    <Link key={c.id} href={`/cases/${c.id}`}>
                      <Card className="bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium truncate">{c.title}</p>
                                <SeverityBadge severity={c.severity} size="sm" />
                              </div>
                              <p className="text-xs text-muted-foreground">{c.caseNumber}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {c.counterparty} | {c.currency} {c.amount.toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="flex items-center gap-1">
                                <span className="text-2xl font-bold text-primary">{c.similarity}%</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">similar</p>
                              <StatusPill status={c.status} size="sm" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                  {similarCases.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No similar cases found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="policies" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    Click on a policy to view the original document excerpt
                  </p>
                  {mockRAGCitations.map((citation) => (
                    <RAGCitationModal key={citation.id} citation={citation}>
                      <Card className="bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium">{citation.name}</p>
                              </div>
                              <Badge variant="outline" className="text-[10px] mt-1">{citation.category}</Badge>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <span className={cn(
                                "font-bold",
                                citation.relevanceScore >= 90 ? "text-success" :
                                citation.relevanceScore >= 70 ? "text-primary" :
                                "text-warning"
                              )}>
                                {citation.relevanceScore}%
                              </span>
                              <span className="text-muted-foreground">relevance</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 mt-2">
                            <Quote className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                              {citation.content}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
                            <span>Source: {citation.source}</span>
                            {citation.page && <span>| Page {citation.page}</span>}
                          </div>
                        </CardContent>
                      </Card>
                    </RAGCitationModal>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Panel - Actions & Audit */}
        <div className="lg:w-[400px] w-full border-t lg:border-t-0 lg:border-l border-border flex flex-col overflow-hidden">
          {/* Simulation Mode Toggle */}
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Simulation Mode</span>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="sim-mode" className={cn(
                "text-xs font-medium",
                simulationMode ? "text-primary" : "text-muted-foreground"
              )}>
                {simulationMode ? 'ON' : 'OFF'}
              </Label>
              <Switch
                id="sim-mode"
                checked={simulationMode}
                onCheckedChange={setSimulationMode}
              />
            </div>
          </div>

          {/* Simulation Preview - Enhanced with Field Highlights */}
          {simulationMode && (
            <div className="p-4 border-b border-border space-y-3">
              {/* Before/After Preview */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-background">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground mb-2">BEFORE</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vendor Bal:</span>
                        <span className="font-mono">${simulationResult.before.vendorBalance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">GL Balance:</span>
                        <span className="font-mono">${simulationResult.before.glBalance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Open Items:</span>
                        <span className="font-mono">{simulationResult.before.openItems}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-background">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground mb-2">AFTER</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vendor Bal:</span>
                        <span className="font-mono text-success">${simulationResult.after.vendorBalance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">GL Balance:</span>
                        <span className="font-mono">${simulationResult.after.glBalance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Open Items:</span>
                        <span className="font-mono">{simulationResult.after.openItems}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Field Change Highlights - NEW */}
              <SimulationHighlightPanel 
                changes={mockFieldChanges} 
                isActive={simulationMode}
              />

              {/* Result */}
              <div className={cn(
                "p-2 rounded text-xs flex items-center gap-2",
                simulationResult.outcome === 'success' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}>
                {simulationResult.outcome === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {simulationResult.message}
              </div>
            </div>
          )}

          {/* Tab Switcher for Actions/Audit */}
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex gap-4">
              <button
                onClick={() => setRightPanelTab('actions')}
                className={cn(
                  "text-sm pb-1 border-b-2 transition-colors",
                  rightPanelTab === 'actions' 
                    ? "border-primary text-foreground font-medium" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Zap className="h-4 w-4 inline mr-1.5" />
                Actions
              </button>
              <button
                onClick={() => setRightPanelTab('audit')}
                className={cn(
                  "text-sm pb-1 border-b-2 transition-colors",
                  rightPanelTab === 'audit' 
                    ? "border-primary text-foreground font-medium" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <History className="h-4 w-4 inline mr-1.5" />
                Audit Stream
              </button>
            </div>
          </div>

          {/* Actions Panel */}
          {rightPanelTab === 'actions' && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Primary CTA Stack */}
                <div className="space-y-2">
                  <Button className="w-full justify-start gap-2 h-10" size="sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Approve Action
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2 h-10 bg-transparent" size="sm">
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2 h-10 bg-transparent" size="sm">
                    <Info className="h-4 w-4" />
                    Request Info
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2 h-10 bg-transparent" size="sm">
                    <Ban className="h-4 w-4" />
                    Set Payment Block
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2 h-10 bg-transparent" size="sm">
                    <RotateCcw className="h-4 w-4" />
                    Post Reversal
                  </Button>
                </div>

                <Separator />

                {/* Go to Action Center */}
                <Link href={`/actions?caseId=${caseData.id}`}>
                  <Button variant="secondary" className="w-full justify-between gap-2" size="sm">
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Go to Action Center
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>

                <Separator />

                {/* Pending Actions */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Pending Actions ({relatedActions.filter(a => a.status === 'pending').length})</h3>
                  <div className="space-y-2">
                    {relatedActions.map((action) => (
                      <Card key={action.id} className="bg-muted/30">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium capitalize">{action.actionType.replace(/_/g, ' ')}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{action.description}</p>
                            </div>
                            <StatusPill status={action.status} size="sm" />
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <SeverityBadge severity={action.riskLevel} size="sm" showIcon={false} />
                            <span className="text-[10px] text-muted-foreground">{action.targetSystem}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {relatedActions.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No actions yet</p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          {/* Audit Stream Panel */}
          {rightPanelTab === 'audit' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {[...caseComments.map(c => ({ ...c, type: 'comment' as const })), 
                    ...caseAuditEvents.slice(0, 5).map(e => ({ 
                      ...e, 
                      type: 'event' as const,
                      author: e.actor,
                      content: e.description,
                      createdAt: e.timestamp 
                    }))]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((item, i) => (
                      <div key={i} className="flex gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                          item.type === 'event' 
                            ? "bg-muted" 
                            : ('authorType' in item && item.authorType === 'ai') 
                              ? "bg-primary/20" 
                              : "bg-muted"
                        )}>
                          {item.type === 'event' ? (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          ) : ('authorType' in item && item.authorType === 'ai') ? (
                            <Bot className="h-4 w-4 text-primary" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{item.author}</span>
                            <Badge variant="outline" className="text-[10px] h-4">
                              {item.type === 'event' ? 'System' : 'Comment'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">{item.content}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
              
              {/* Comment Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add audit note..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="icon" variant="ghost" className="bg-transparent">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
