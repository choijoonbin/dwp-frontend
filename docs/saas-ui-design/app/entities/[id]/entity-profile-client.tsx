"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Building2,
  Users,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  AlertTriangle,
  Wallet,
  Activity,
  Shield,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Clock,
  ChevronRight,
  Filter,
  Download
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  mockEntities,
  mockEntityChangeLogs,
  mockFiDocs,
  mockOpenItems,
  mockCases,
  mockActions,
  type Entity,
  type EntityChangeLog,
} from "@/lib/mock-data"

// Masked Field Component
function MaskedField({ 
  label, 
  value, 
  isMasked, 
  onRequestAccess 
}: { 
  label: string
  value?: string
  isMasked: boolean
  onRequestAccess: () => void
}) {
  if (!value) return null

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {isMasked ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono">{"*".repeat(10)}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onRequestAccess}>
            <Lock className="h-3 w-3 mr-1" />
            <span className="text-xs">Request</span>
          </Button>
        </div>
      ) : (
        <span className="text-sm font-medium">{value}</span>
      )}
    </div>
  )
}

// Risk Score Badge
function RiskScoreBadge({ score, trend, size = 'default' }: { score: number; trend: 'up' | 'down' | 'stable'; size?: 'default' | 'large' }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'bg-destructive/10 text-destructive border-destructive/20'
    if (s >= 60) return 'bg-warning/10 text-warning border-warning/20'
    if (s >= 40) return 'bg-info/10 text-info border-info/20'
    return 'bg-success/10 text-success border-success/20'
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  if (size === 'large') {
    return (
      <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border", getColor(score))}>
        <span className="text-2xl font-bold">{score}</span>
        <TrendIcon className="h-5 w-5" />
      </div>
    )
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium", getColor(score))}>
      <span>{score}</span>
      <TrendIcon className="h-3 w-3" />
    </div>
  )
}

// Change Log Timeline Item
function ChangeLogItem({ log, showMasked }: { log: EntityChangeLog; showMasked: boolean }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-destructive'
      case 'warn': return 'bg-warning'
      default: return 'bg-muted-foreground'
    }
  }

  const formatValue = (value: string) => {
    if (!showMasked && (log.fieldName === 'bankAccount' || log.fieldName === 'taxId')) {
      return '****'
    }
    return value
  }

  return (
    <div className="flex gap-4 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <div className={cn("h-3 w-3 rounded-full", getSeverityColor(log.severity))} />
        <div className="w-px flex-1 bg-border mt-2" />
      </div>
      <div className="flex-1 -mt-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{log.fieldName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(log.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {log.actorType === 'system' ? 'System' : log.actorType === 'agent' ? 'AI' : 'User'}
          </Badge>
        </div>
        <div className="mt-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground line-through">{formatValue(log.beforeValue)}</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{formatValue(log.afterValue)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            by {log.actor} via {log.source}
          </p>
        </div>
      </div>
    </div>
  )
}

export function EntityProfileClient({ entityId }: { entityId: string }) {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || 'overview'

  const [activeTab, setActiveTab] = useState(initialTab)
  const [piiMasked, setPiiMasked] = useState(true)
  const [accessRequestOpen, setAccessRequestOpen] = useState(false)
  const [accessReason, setAccessReason] = useState("")
  const [accessPending, setAccessPending] = useState(false)
  const [changeLogFilter, setChangeLogFilter] = useState<string[]>([])

  // Find entity
  const entity = mockEntities.find(e => e.id === entityId)

  // Get related data
  const changeLogs = useMemo(() => {
    let logs = mockEntityChangeLogs.filter(log => log.entityId === entityId)
    if (changeLogFilter.length > 0) {
      logs = logs.filter(log => changeLogFilter.includes(log.severity))
    }
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [entityId, changeLogFilter])

  const relatedDocs = useMemo(() => {
    if (!entity) return []
    return mockFiDocs.filter(doc => entity.linkedDocIds.includes(doc.id))
  }, [entity])

  const relatedOpenItems = useMemo(() => {
    if (!entity) return []
    return mockOpenItems.filter(oi => oi.entityId === entityId)
  }, [entity, entityId])

  const relatedCases = useMemo(() => {
    if (!entity) return []
    return mockCases.filter(c => entity.linkedCaseIds.includes(c.id))
  }, [entity])

  const relatedActions = useMemo(() => {
    const caseIds = relatedCases.map(c => c.id)
    return mockActions.filter(a => caseIds.includes(a.caseId))
  }, [relatedCases])

  if (!entity) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-warning mb-4" />
            <h2 className="text-lg font-semibold mb-2">Entity Not Found</h2>
            <p className="text-muted-foreground mb-4">The entity with ID {entityId} could not be found.</p>
            <Button asChild>
              <Link href="/entities">Return to Entity Hub</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handleRequestAccess = () => {
    setAccessRequestOpen(true)
  }

  const handleSubmitAccessRequest = () => {
    setAccessPending(true)
    setAccessRequestOpen(false)
    setAccessReason("")
    // In real app, this would submit the request
  }

  const handleGrantAccess = () => {
    setPiiMasked(false)
    setAccessPending(false)
  }

  // Mock KPIs for this entity
  const entityKPIs = {
    actionSuccessRate: 85,
    avgResolutionDays: 3.2,
    totalTransactions: 45,
    yoyGrowth: 12.5
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/entities">
            <Button variant="ghost" size="icon" className="h-8 w-8 mt-1 bg-transparent">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-start gap-4">
            <div className={cn(
              "h-14 w-14 rounded-xl flex items-center justify-center",
              entity.type === 'vendor' ? "bg-primary/10" : "bg-info/10"
            )}>
              {entity.type === 'vendor' ? (
                <Building2 className="h-7 w-7 text-primary" />
              ) : (
                <Users className="h-7 w-7 text-info" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">{entity.name}</h1>
                <Badge variant="outline" className="text-xs">
                  {entity.type}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground font-mono">{entity.code}</p>
              <div className="flex items-center gap-3 mt-2">
                <RiskScoreBadge score={entity.riskScore} trend={entity.riskTrend} size="large" />
                <Badge variant="outline" className={cn(
                  "text-xs",
                  entity.concentrationRisk === 'high' ? "bg-destructive/10 text-destructive border-destructive/20" :
                  entity.concentrationRisk === 'medium' ? "bg-warning/10 text-warning border-warning/20" :
                  "bg-success/10 text-success border-success/20"
                )}>
                  {entity.concentrationRisk.charAt(0).toUpperCase() + entity.concentrationRisk.slice(1)} Concentration
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-12 sm:ml-0">
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <ExternalLink className="h-4 w-4" />
            Open in SAP
          </Button>
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="changelog" className="gap-2">
            <Clock className="h-4 w-4" />
            Change Log
          </TabsTrigger>
          <TabsTrigger value="related" className="gap-2">
            <FileText className="h-4 w-4" />
            Related
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2">
            <Shield className="h-4 w-4" />
            Access Control
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Open Items</p>
                    <p className="text-xl font-bold">{formatCurrency(entity.openItemsTotal, entity.currency)}</p>
                    <p className="text-xs text-muted-foreground">{entity.openItemsCount} items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                    <p className={cn("text-xl font-bold", entity.overdueTotal > 0 && "text-destructive")}>
                      {formatCurrency(entity.overdueTotal, entity.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">{entity.overdueCount} items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Recent Anomalies</p>
                    <p className="text-xl font-bold">{entity.recentAnomaliesCount}</p>
                    <p className="text-xs text-muted-foreground">Last 30 days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Action Success</p>
                    <p className="text-xl font-bold">{entityKPIs.actionSuccessRate}%</p>
                    <p className="text-xs text-muted-foreground">Resolution rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Related Snapshot Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  FI Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{relatedDocs.length}</p>
                <p className="text-xs text-muted-foreground mb-3">Linked documents</p>
                <Button variant="outline" size="sm" className="w-full bg-transparent" asChild>
                  <Link href={`/documents?entityId=${entity.id}`}>
                    View Documents
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Open Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{relatedOpenItems.length}</p>
                <p className="text-xs text-muted-foreground mb-3">Outstanding items</p>
                <Button variant="outline" size="sm" className="w-full bg-transparent" asChild>
                  <Link href={`/open-items?entityId=${entity.id}`}>
                    View Open Items
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Cases
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{relatedCases.length}</p>
                <p className="text-xs text-muted-foreground mb-3">Active cases</p>
                <Button variant="outline" size="sm" className="w-full bg-transparent" asChild>
                  <Link href={`/cases?entityId=${entity.id}`}>
                    View Cases
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{relatedActions.length}</p>
                <p className="text-xs text-muted-foreground mb-3">Related actions</p>
                <Button variant="outline" size="sm" className="w-full bg-transparent" asChild>
                  <Link href={`/actions?entityId=${entity.id}`}>
                    View Actions
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Change Log Tab */}
        <TabsContent value="changelog" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Audit Change Log</h3>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    <Filter className="h-4 w-4" />
                    Filter
                    {changeLogFilter.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">{changeLogFilter.length}</Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuCheckboxItem
                    checked={changeLogFilter.includes('critical')}
                    onCheckedChange={(checked) => {
                      if (checked) setChangeLogFilter(prev => [...prev, 'critical'])
                      else setChangeLogFilter(prev => prev.filter(f => f !== 'critical'))
                    }}
                  >
                    Critical
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={changeLogFilter.includes('warn')}
                    onCheckedChange={(checked) => {
                      if (checked) setChangeLogFilter(prev => [...prev, 'warn'])
                      else setChangeLogFilter(prev => prev.filter(f => f !== 'warn'))
                    }}
                  >
                    Warning
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={changeLogFilter.includes('info')}
                    onCheckedChange={(checked) => {
                      if (checked) setChangeLogFilter(prev => [...prev, 'info'])
                      else setChangeLogFilter(prev => prev.filter(f => f !== 'info'))
                    }}
                  >
                    Info
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-6">
              {changeLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No change history found for this entity.</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {changeLogs.map(log => (
                    <ChangeLogItem key={log.id} log={log} showMasked={!piiMasked} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Related Tab */}
        <TabsContent value="related" className="space-y-6 mt-6">
          {/* Related Documents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Related FI Documents</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/documents?entityId=${entity.id}`}>View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {relatedDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No related documents</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left font-medium text-muted-foreground p-2">Doc Number</th>
                        <th className="text-left font-medium text-muted-foreground p-2">Type</th>
                        <th className="text-left font-medium text-muted-foreground p-2">Date</th>
                        <th className="text-right font-medium text-muted-foreground p-2">Amount</th>
                        <th className="text-left font-medium text-muted-foreground p-2">Status</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedDocs.slice(0, 5).map(doc => (
                        <tr key={doc.id} className="border-b border-border hover:bg-muted/50">
                          <td className="p-2 font-mono text-xs">{doc.belnr}</td>
                          <td className="p-2">{doc.blart}</td>
                          <td className="p-2">{formatDate(doc.budat)}</td>
                          <td className="p-2 text-right">{formatCurrency(doc.wrbtr, doc.waers)}</td>
                          <td className="p-2">
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              doc.integrityStatus === 'pass' ? "bg-success/10 text-success" :
                              doc.integrityStatus === 'warn' ? "bg-warning/10 text-warning" :
                              "bg-destructive/10 text-destructive"
                            )}>
                              {doc.integrityStatus}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/documents/${doc.id}`}>
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Open Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Related Open Items</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/open-items?entityId=${entity.id}`}>View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {relatedOpenItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No open items</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left font-medium text-muted-foreground p-2">Item</th>
                        <th className="text-left font-medium text-muted-foreground p-2">Type</th>
                        <th className="text-left font-medium text-muted-foreground p-2">Due</th>
                        <th className="text-right font-medium text-muted-foreground p-2">Amount</th>
                        <th className="text-left font-medium text-muted-foreground p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedOpenItems.slice(0, 5).map(oi => (
                        <tr key={oi.id} className="border-b border-border hover:bg-muted/50">
                          <td className="p-2 font-mono text-xs">{oi.docNumber}</td>
                          <td className="p-2">
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              oi.type === 'AR' ? "bg-info/10 text-info" : "bg-primary/10 text-primary"
                            )}>
                              {oi.type}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <span className={cn(oi.daysPastDue > 0 && "text-destructive")}>
                              {formatDate(oi.dueDate)}
                              {oi.daysPastDue > 0 && ` (+${oi.daysPastDue}d)`}
                            </span>
                          </td>
                          <td className="p-2 text-right">{formatCurrency(oi.amount, oi.currency)}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {oi.disputeFlag && <Badge variant="outline" className="text-xs bg-warning/10 text-warning">Dispute</Badge>}
                              {oi.paymentBlock && <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive">Blocked</Badge>}
                              {!oi.disputeFlag && !oi.paymentBlock && (
                                <Badge variant="outline" className="text-xs">{oi.status}</Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Cases */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Related Cases</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/cases?entityId=${entity.id}`}>View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {relatedCases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No related cases</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left font-medium text-muted-foreground p-2">Case</th>
                        <th className="text-left font-medium text-muted-foreground p-2">Title</th>
                        <th className="text-left font-medium text-muted-foreground p-2">Severity</th>
                        <th className="text-left font-medium text-muted-foreground p-2">Status</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedCases.map(c => (
                        <tr key={c.id} className="border-b border-border hover:bg-muted/50">
                          <td className="p-2 font-mono text-xs">{c.caseNumber}</td>
                          <td className="p-2">{c.title}</td>
                          <td className="p-2">
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              c.severity === 'critical' ? "bg-destructive/10 text-destructive" :
                              c.severity === 'high' ? "bg-warning/10 text-warning" :
                              c.severity === 'medium' ? "bg-info/10 text-info" :
                              "bg-muted text-muted-foreground"
                            )}>
                              {c.severity}
                            </Badge>
                          </td>
                          <td className="p-2">{c.status.replace('_', ' ')}</td>
                          <td className="p-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/cases/${c.id}`}>
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Control Tab */}
        <TabsContent value="access" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>PII Access Control</CardTitle>
              <CardDescription>
                Sensitive entity data is protected. Request access or use demo mode to view masked fields.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {piiMasked ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-success" />
                  )}
                  <div>
                    <p className="font-medium">
                      {piiMasked ? "Sensitive Fields Masked" : "Full Access Granted"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {piiMasked 
                        ? "Bank account, contact info, and tax ID are hidden"
                        : "All sensitive fields are visible"}
                    </p>
                  </div>
                </div>
                {accessPending ? (
                  <Badge variant="outline" className="bg-warning/10 text-warning">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending Approval
                  </Badge>
                ) : (
                  <Button
                    variant={piiMasked ? "default" : "outline"}
                    size="sm"
                    onClick={piiMasked ? handleRequestAccess : () => setPiiMasked(true)}
                    className={!piiMasked ? "bg-transparent" : ""}
                  >
                    {piiMasked ? (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Request Access
                      </>
                    ) : (
                      <>
                        <Unlock className="h-4 w-4 mr-2" />
                        Revoke Access
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Demo Mode Toggle */}
              <div className="flex items-center justify-between p-4 border border-dashed border-border rounded-lg">
                <div>
                  <p className="font-medium">Demo Mode (Admin Simulation)</p>
                  <p className="text-sm text-muted-foreground">
                    Bypass access controls for demonstration purposes
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGrantAccess}
                  disabled={!piiMasked}
                  className="bg-transparent"
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Grant Access
                </Button>
              </div>

              <Separator />

              {/* Sensitive Fields Display */}
              <div>
                <h4 className="text-sm font-medium mb-3">Sensitive Fields</h4>
                <div className="space-y-0 divide-y divide-border">
                  <MaskedField 
                    label="Bank Account" 
                    value={entity.bankAccount} 
                    isMasked={piiMasked} 
                    onRequestAccess={handleRequestAccess} 
                  />
                  <MaskedField 
                    label="Bank Name" 
                    value={entity.bankName} 
                    isMasked={piiMasked} 
                    onRequestAccess={handleRequestAccess} 
                  />
                  <MaskedField 
                    label="Tax ID" 
                    value={entity.taxId} 
                    isMasked={piiMasked} 
                    onRequestAccess={handleRequestAccess} 
                  />
                  <MaskedField 
                    label="Contact Name" 
                    value={entity.contactName} 
                    isMasked={piiMasked} 
                    onRequestAccess={handleRequestAccess} 
                  />
                  <MaskedField 
                    label="Contact Email" 
                    value={entity.contactEmail} 
                    isMasked={piiMasked} 
                    onRequestAccess={handleRequestAccess} 
                  />
                  <MaskedField 
                    label="Contact Phone" 
                    value={entity.contactPhone} 
                    isMasked={piiMasked} 
                    onRequestAccess={handleRequestAccess} 
                  />
                  <MaskedField 
                    label="Address" 
                    value={entity.address} 
                    isMasked={piiMasked} 
                    onRequestAccess={handleRequestAccess} 
                  />
                </div>
              </div>

              {/* Non-sensitive fields always visible */}
              <div>
                <h4 className="text-sm font-medium mb-3">General Information</h4>
                <div className="space-y-0 divide-y divide-border">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Company Code</span>
                    <span className="text-sm font-medium">{entity.companyCode}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Currency</span>
                    <span className="text-sm font-medium">{entity.currency}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Payment Terms</span>
                    <span className="text-sm font-medium">{entity.paymentTerms}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Last Updated</span>
                    <span className="text-sm font-medium">{formatDate(entity.lastUpdated)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Access Request Dialog */}
      <Dialog open={accessRequestOpen} onOpenChange={setAccessRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request PII Access</DialogTitle>
            <DialogDescription>
              Explain why you need access to sensitive data for {entity.name}.
              This request will be logged and requires approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Access</Label>
              <Textarea
                value={accessReason}
                onChange={(e) => setAccessReason(e.target.value)}
                placeholder="e.g., Investigating bank account change anomaly for case CS-2026-0001"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessRequestOpen(false)} className="bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleSubmitAccessRequest} disabled={!accessReason.trim()}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
