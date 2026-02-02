"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  FileText,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  GitBranch,
  AlertCircle,
  ChevronRight,
  Info,
  Download,
  Clock,
  User,
  Building2,
  Calendar,
  Hash,
  DollarSign,
  Zap
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  mockFiDocs, 
  mockFiDocItems, 
  mockIntegrityChecks, 
  mockCases, 
  mockActions,
  type FiDocHeader,
  type FiDocItem,
  type IntegrityCheck 
} from "@/lib/mock-data"
import { SeverityBadge } from "@/components/finance/severity-badge"
import { StatusPill } from "@/components/finance/status-pill"

interface FiDocumentDetailClientProps {
  docId: string
}

export function FiDocumentDetailClient({ docId }: FiDocumentDetailClientProps) {
  const router = useRouter()
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Find the document
  const doc = mockFiDocs.find(d => d.id === docId)
  const lineItems = mockFiDocItems.filter(item => item.docId === docId)
  const integrityChecks = mockIntegrityChecks.filter(chk => chk.docId === docId)
  const relatedCases = mockCases.filter(c => c.fiDocId === docId)
  const relatedActions = mockActions.filter(a => relatedCases.some(c => c.id === a.caseId))

  // Build reversal chain
  const reversalChain = useMemo(() => {
    if (!doc) return []
    
    const chain: FiDocHeader[] = []
    
    // Go backwards to find the original
    let current = doc
    const visitedBack = new Set<string>()
    while (current.reversesDoc && !visitedBack.has(current.reversesDoc)) {
      visitedBack.add(current.reversesDoc)
      const prev = mockFiDocs.find(d => d.id === current.reversesDoc)
      if (prev) {
        chain.unshift(prev)
        current = prev
      } else break
    }
    
    // Add current doc
    chain.push(doc)
    
    // Go forward to find subsequent reversals
    current = doc
    const visitedFwd = new Set<string>()
    while (current.reversedByDoc && !visitedFwd.has(current.reversedByDoc)) {
      visitedFwd.add(current.reversedByDoc)
      const next = mockFiDocs.find(d => d.id === current.reversedByDoc)
      if (next) {
        chain.push(next)
        current = next
      } else break
    }
    
    return chain
  }, [doc])

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Integrity status badge
  const IntegrityBadge = ({ status }: { status: 'pass' | 'warn' | 'fail' }) => {
    const config = {
      pass: { icon: CheckCircle2, label: 'Pass', className: 'bg-success/10 text-success border-success/20' },
      warn: { icon: AlertTriangle, label: 'Warning', className: 'bg-warning/10 text-warning border-warning/20' },
      fail: { icon: XCircle, label: 'Failed', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    }
    const { icon: Icon, label, className } = config[status]
    return (
      <Badge variant="outline" className={cn("gap-1 font-normal", className)}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  // Check severity badge
  const CheckSeverityBadge = ({ severity }: { severity: 'info' | 'warn' | 'critical' }) => {
    const config = {
      info: { className: 'bg-info/10 text-info border-info/20' },
      warn: { className: 'bg-warning/10 text-warning border-warning/20' },
      critical: { className: 'bg-destructive/10 text-destructive border-destructive/20' },
    }
    return (
      <Badge variant="outline" className={cn("font-normal capitalize", config[severity].className)}>
        {severity}
      </Badge>
    )
  }

  if (!doc) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Document Not Found</h2>
            <p className="text-muted-foreground mb-4">The document you are looking for does not exist or has been removed.</p>
            <Button asChild>
              <Link href="/documents">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate line item totals
  const totalDebit = lineItems.filter(i => i.shkzg === 'S').reduce((sum, i) => sum + i.wrbtr, 0)
  const totalCredit = lineItems.filter(i => i.shkzg === 'H').reduce((sum, i) => sum + i.wrbtr, 0)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-1 bg-transparent" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground font-mono">{doc.belnr}</h1>
              <IntegrityBadge status={doc.integrityStatus} />
              {doc.reversalFlag && (
                <Badge variant="outline" className="gap-1 bg-muted">
                  <GitBranch className="h-3 w-3" />
                  Reversal Chain
                </Badge>
              )}
              {doc.linkedCasesCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {doc.linkedCasesCount} Case(s)
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {doc.bktxt} | {doc.bukrs} / {doc.gjahr}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <ExternalLink className="h-4 w-4" />
            Open in SAP
          </Button>
        </div>
      </div>

      {/* Header Summary Card (BKPF-like) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document Header
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <Hash className="h-3 w-3" />
                Document Number
              </div>
              <div className="flex items-center gap-1">
                <span className="font-mono font-semibold">{doc.belnr}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => copyToClipboard(doc.belnr, 'belnr')}
                >
                  {copiedField === 'belnr' ? <CheckCircle2 className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <Building2 className="h-3 w-3" />
                Company Code
              </div>
              <span className="font-mono font-semibold">{doc.bukrs}</span>
            </div>
            <div>
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <Calendar className="h-3 w-3" />
                Posting Date
              </div>
              <span className="font-semibold">{new Date(doc.budat).toLocaleDateString()}</span>
            </div>
            <div>
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <FileText className="h-3 w-3" />
                Doc Type / TCode
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="font-mono">{doc.blart}</Badge>
                <span className="text-xs text-muted-foreground">{doc.tcode}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <User className="h-3 w-3" />
                Created By
              </div>
              <span className="font-semibold">{doc.usnam}</span>
            </div>
            <div>
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <DollarSign className="h-3 w-3" />
                Total Amount
              </div>
              <span className="font-mono font-semibold text-lg">
                {Math.abs(doc.wrbtr).toLocaleString('en-US', { minimumFractionDigits: 2 })} {doc.waers}
              </span>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-muted-foreground text-xs mb-1">Reference</div>
              <span className="font-mono text-sm">{doc.xblnr}</span>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Counterparty</div>
              <div>
                <span className="font-semibold">{doc.counterparty}</span>
                {doc.counterpartyId && (
                  <span className="text-xs text-muted-foreground ml-2">{doc.counterpartyId}</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Document Date</div>
              <span className="text-sm">{new Date(doc.bldat).toLocaleDateString()}</span>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Entry Date</div>
              <span className="text-sm">{new Date(doc.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="items" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="items" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Line Items</span>
            <span className="sm:hidden">Items</span>
          </TabsTrigger>
          <TabsTrigger value="reversals" className="gap-2">
            <GitBranch className="h-4 w-4" />
            <span className="hidden sm:inline">Reversals</span>
            <span className="sm:hidden">Rev</span>
          </TabsTrigger>
          <TabsTrigger value="integrity" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Integrity</span>
            <span className="sm:hidden">Chks</span>
          </TabsTrigger>
          <TabsTrigger value="related" className="gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Related</span>
            <span className="sm:hidden">Rel</span>
          </TabsTrigger>
        </TabsList>

        {/* Line Items Tab */}
        <TabsContent value="items">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Line Items (BSEG)</CardTitle>
              <CardDescription>{lineItems.length} line item(s)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left font-medium text-muted-foreground p-3 w-16">Item</th>
                      <th className="text-left font-medium text-muted-foreground p-3">G/L Account</th>
                      <th className="text-left font-medium text-muted-foreground p-3">Text</th>
                      <th className="text-left font-medium text-muted-foreground p-3">D/C</th>
                      <th className="text-right font-medium text-muted-foreground p-3">Amount</th>
                      <th className="text-left font-medium text-muted-foreground p-3">Tax</th>
                      <th className="text-left font-medium text-muted-foreground p-3">Cost Center</th>
                      <th className="text-left font-medium text-muted-foreground p-3">Assignment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-muted-foreground">
                          No line items found for this document
                        </td>
                      </tr>
                    ) : (
                      <>
                        {lineItems.map(item => (
                          <tr key={item.id} className="border-b border-border hover:bg-muted/30">
                            <td className="p-3 font-mono">{item.buzei}</td>
                            <td className="p-3">
                              <div>
                                <span className="font-mono">{item.hkont}</span>
                                <p className="text-xs text-muted-foreground">{item.hkontName}</p>
                              </div>
                            </td>
                            <td className="p-3 max-w-[200px] truncate">{item.sgtxt}</td>
                            <td className="p-3">
                              <Badge variant="outline" className={cn(
                                "font-mono",
                                item.shkzg === 'S' ? "bg-success/10 text-success border-success/20" : "bg-info/10 text-info border-info/20"
                              )}>
                                {item.shkzg === 'S' ? 'Debit' : 'Credit'}
                              </Badge>
                            </td>
                            <td className="p-3 text-right font-mono">
                              {item.wrbtr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 font-mono text-muted-foreground">{item.mwskz || '-'}</td>
                            <td className="p-3 font-mono text-muted-foreground">{item.kostl || '-'}</td>
                            <td className="p-3 font-mono text-muted-foreground truncate max-w-[100px]">{item.zuonr || '-'}</td>
                          </tr>
                        ))}
                        {/* Totals row */}
                        <tr className="bg-muted/50 font-semibold">
                          <td colSpan={4} className="p-3 text-right">Totals:</td>
                          <td className="p-3 text-right font-mono">
                            <div className="space-y-1">
                              <div className="text-success">{totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })} D</div>
                              <div className="text-info">{totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })} C</div>
                            </div>
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reversal Chain Tab */}
        <TabsContent value="reversals">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Reversal Chain
              </CardTitle>
              <CardDescription>Document reversal history and relationships</CardDescription>
            </CardHeader>
            <CardContent>
              {reversalChain.length <= 1 ? (
                <div className="text-center py-8">
                  <GitBranch className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No Reversal Chain</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">This document has not been reversed and does not reverse another document.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Visual chain */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {reversalChain.map((chainDoc, idx) => (
                      <div key={chainDoc.id} className="flex items-center">
                        <Link
                          href={`/documents/${chainDoc.id}`}
                          className={cn(
                            "flex flex-col items-center p-3 rounded-lg border min-w-[120px] transition-colors",
                            chainDoc.id === doc.id
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          )}
                        >
                          <span className="font-mono text-sm font-semibold">{chainDoc.belnr}</span>
                          <span className="text-xs text-muted-foreground">{new Date(chainDoc.budat).toLocaleDateString()}</span>
                          <span className={cn(
                            "text-xs font-mono mt-1",
                            chainDoc.wrbtr < 0 ? "text-destructive" : "text-foreground"
                          )}>
                            {chainDoc.wrbtr.toLocaleString('en-US', { minimumFractionDigits: 2 })} {chainDoc.waers}
                          </span>
                          {chainDoc.id === doc.id && (
                            <Badge variant="default" className="mt-2 text-[10px]">Current</Badge>
                          )}
                        </Link>
                        {idx < reversalChain.length - 1 && (
                          <ChevronRight className="h-5 w-5 text-muted-foreground mx-1 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Chain table */}
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left font-medium text-muted-foreground p-3">Doc Number</th>
                          <th className="text-left font-medium text-muted-foreground p-3">Posting Date</th>
                          <th className="text-left font-medium text-muted-foreground p-3">Type</th>
                          <th className="text-right font-medium text-muted-foreground p-3">Amount</th>
                          <th className="text-left font-medium text-muted-foreground p-3">Relationship</th>
                          <th className="text-left font-medium text-muted-foreground p-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {reversalChain.map((chainDoc, idx) => (
                          <tr 
                            key={chainDoc.id} 
                            className={cn(
                              "border-b border-border",
                              chainDoc.id === doc.id && "bg-primary/5"
                            )}
                          >
                            <td className="p-3 font-mono font-semibold">{chainDoc.belnr}</td>
                            <td className="p-3">{new Date(chainDoc.budat).toLocaleDateString()}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="font-mono">{chainDoc.blart}</Badge>
                            </td>
                            <td className={cn("p-3 text-right font-mono", chainDoc.wrbtr < 0 && "text-destructive")}>
                              {chainDoc.wrbtr.toLocaleString('en-US', { minimumFractionDigits: 2 })} {chainDoc.waers}
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {idx === 0 ? 'Original' : `Reverses ${reversalChain[idx - 1].belnr}`}
                            </td>
                            <td className="p-3">
                              {chainDoc.id !== doc.id && (
                                <Button variant="ghost" size="sm" asChild className="h-7">
                                  <Link href={`/documents/${chainDoc.id}`}>Open</Link>
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrity Checks Tab */}
        <TabsContent value="integrity">
          <div className="space-y-4">
            {integrityChecks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
                  <p className="text-lg font-semibold text-success">All Integrity Checks Passed</p>
                  <p className="text-sm text-muted-foreground mt-1">No validation issues were detected for this document.</p>
                </CardContent>
              </Card>
            ) : (
              integrityChecks.map(check => (
                <Card key={check.id} className={cn(
                  "border-l-4",
                  check.severity === 'critical' && "border-l-destructive",
                  check.severity === 'warn' && "border-l-warning",
                  check.severity === 'info' && "border-l-info"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {check.passed ? (
                            <CheckCircle2 className="h-5 w-5 text-success" />
                          ) : (
                            <AlertCircle className={cn(
                              "h-5 w-5",
                              check.severity === 'critical' && "text-destructive",
                              check.severity === 'warn' && "text-warning",
                              check.severity === 'info' && "text-info"
                            )} />
                          )}
                          <span className="font-semibold">{check.ruleName}</span>
                          <CheckSeverityBadge severity={check.severity} />
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{check.evidence}</p>
                        {check.recommendation && (
                          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
                            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">Recommended Action</p>
                              <p className="text-sm text-muted-foreground">{check.recommendation}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      {check.relatedCaseId && (
                        <Button variant="outline" size="sm" asChild className="bg-transparent">
                          <Link href={`/cases/${check.relatedCaseId}`}>
                            View Case
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Related Objects Tab */}
        <TabsContent value="related">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Related Cases */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Related Cases
                </CardTitle>
                <CardDescription>{relatedCases.length} case(s) linked to this document</CardDescription>
              </CardHeader>
              <CardContent>
                {relatedCases.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No cases linked to this document</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {relatedCases.map(c => (
                      <Link
                        key={c.id}
                        href={`/cases/${c.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <span className="font-mono font-semibold">{c.caseNumber}</span>
                          <p className="text-sm text-muted-foreground">{c.title}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={c.severity} />
                          <StatusPill status={c.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Related Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Related Actions
                </CardTitle>
                <CardDescription>{relatedActions.length} action(s) associated with related cases</CardDescription>
              </CardHeader>
              <CardContent>
                {relatedActions.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No actions linked to this document</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {relatedActions.map(a => (
                      <Link
                        key={a.id}
                        href={`/actions?caseId=${a.caseId}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <span className="font-mono text-sm">{a.id}</span>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">{a.description}</p>
                        </div>
                        <StatusPill status={a.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Navigation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild className="bg-transparent">
                    <Link href={`/lineage?docId=${doc.id}`}>
                      <GitBranch className="h-4 w-4 mr-2" />
                      Open in Lineage
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="bg-transparent">
                    <Link href={`/entities/${doc.counterpartyId}`}>
                      <User className="h-4 w-4 mr-2" />
                      View Counterparty
                    </Link>
                  </Button>
                  <Button variant="outline" className="bg-transparent">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in SAP
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
