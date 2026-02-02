"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Search,
  Filter,
  Zap,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  X,
  FileText,
  Paperclip,
  Send,
  Shield,
  Bot,
  User,
  History,
  Info,
  MoreHorizontal,
  CheckSquare,
  Square,
  Loader2
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { SeverityBadge } from "@/components/finance/severity-badge"
import { StatusPill } from "@/components/finance/status-pill"
import { SimulationResultCard } from "@/components/finance/simulation-result-card"
import { Timeline } from "@/components/finance/timeline"
import { mockActions, mockCases, mockAuditEvents, mockPolicies, type Action } from "@/lib/mock-data"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

const actionTypes = [
  { value: 'post_reversal', label: 'Post Reversal' },
  { value: 'block_payment', label: 'Block Payment' },
  { value: 'flag_review', label: 'Flag for Review' },
  { value: 'clear_item', label: 'Clear Item' },
  { value: 'update_master', label: 'Update Master Data' },
]

const statuses = ['pending', 'approved', 'rejected', 'executed', 'failed']
const riskLevels = ['critical', 'high', 'medium', 'low']

export default function ActionCenterPage() {
  const searchParams = useSearchParams()
  const caseIdFilter = searchParams.get('caseId')
  
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['pending'])
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<string[]>([])
  const [selectedActionTypes, setSelectedActionTypes] = useState<string[]>([])
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set())
  const [bulkApprovalOpen, setBulkApprovalOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  // When caseId filter is present, clear status filter to show all
  useEffect(() => {
    if (caseIdFilter) {
      setSelectedStatuses([])
    }
  }, [caseIdFilter])

  // Filter actions
  const filteredActions = useMemo(() => {
    return mockActions.filter(action => {
      // Case ID filter (from URL)
      if (caseIdFilter && action.caseId !== caseIdFilter) {
        return false
      }

      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!action.description.toLowerCase().includes(query) &&
            !action.id.toLowerCase().includes(query)) {
          return false
        }
      }

      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(action.status)) {
        return false
      }

      // Risk level filter
      if (selectedRiskLevels.length > 0 && !selectedRiskLevels.includes(action.riskLevel)) {
        return false
      }

      // Action type filter
      if (selectedActionTypes.length > 0 && !selectedActionTypes.includes(action.actionType)) {
        return false
      }

      return true
    })
  }, [caseIdFilter, searchQuery, selectedStatuses, selectedRiskLevels, selectedActionTypes])

  const pendingCount = mockActions.filter(a => a.status === 'pending').length
  const approvedTodayCount = mockActions.filter(a => a.status === 'approved').length
  const executedTodayCount = mockActions.filter(a => a.status === 'executed').length

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedStatuses(['pending'])
    setSelectedRiskLevels([])
    setSelectedActionTypes([])
  }

  const hasCustomFilters = selectedStatuses.length !== 1 || selectedStatuses[0] !== 'pending' || 
    selectedRiskLevels.length > 0 || selectedActionTypes.length > 0 || searchQuery

  // Bulk selection helpers
  const pendingActions = filteredActions.filter(a => a.status === 'pending')
  const allPendingSelected = pendingActions.length > 0 && pendingActions.every(a => selectedActionIds.has(a.id))
  const somePendingSelected = pendingActions.some(a => selectedActionIds.has(a.id))

  const toggleActionSelection = (actionId: string) => {
    const newSet = new Set(selectedActionIds)
    if (newSet.has(actionId)) {
      newSet.delete(actionId)
    } else {
      newSet.add(actionId)
    }
    setSelectedActionIds(newSet)
  }

  const toggleAllPendingSelection = () => {
    if (allPendingSelected) {
      setSelectedActionIds(new Set())
    } else {
      setSelectedActionIds(new Set(pendingActions.map(a => a.id)))
    }
  }

  const selectedPendingCount = [...selectedActionIds].filter(id => 
    filteredActions.find(a => a.id === id && a.status === 'pending')
  ).length

  const handleBulkApprove = () => {
    setBulkAction('approve')
    setBulkApprovalOpen(true)
  }

  const handleBulkReject = () => {
    setBulkAction('reject')
    setBulkApprovalOpen(true)
  }

  const executeBulkAction = async () => {
    setIsBulkProcessing(true)
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1500))
    setIsBulkProcessing(false)
    setBulkApprovalOpen(false)
    setSelectedActionIds(new Set())
    setBulkAction(null)
  }

  const handleActionClick = (action: Action) => {
    setSelectedAction(action)
    setSheetOpen(true)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Action Center</h1>
            {caseIdFilter && (
              <Badge variant="secondary" className="gap-1">
                <FileText className="h-3 w-3" />
                Filtered by Case
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {caseIdFilter 
              ? `Showing actions for case: ${mockCases.find(c => c.id === caseIdFilter)?.caseNumber || caseIdFilter}`
              : 'Manage autonomous actions and approvals'
            }
          </p>
        </div>
        {caseIdFilter && (
          <Link href="/actions">
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <X className="h-4 w-4" />
              Clear Filter
            </Button>
          </Link>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedPendingCount > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <CheckSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedPendingCount} action(s) selected</p>
                  <p className="text-xs text-muted-foreground">Ready for bulk approval or rejection</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedActionIds(new Set())}
                  className="gap-1 bg-transparent"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear Selection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkReject}
                  className="gap-1"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject All
                </Button>
                <Button
                  size="sm"
                  onClick={handleBulkApprove}
                  className="gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-3xl font-bold text-warning">{pendingCount}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved Today</p>
                <p className="text-3xl font-bold text-success">{approvedTodayCount}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Executed Today</p>
                <p className="text-3xl font-bold text-primary">{executedTodayCount}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 bg-transparent">
                  <Filter className="h-3.5 w-3.5" />
                  Status
                  {selectedStatuses.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {selectedStatuses.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {statuses.map(status => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedStatuses([...selectedStatuses, status])
                      } else {
                        setSelectedStatuses(selectedStatuses.filter(s => s !== status))
                      }
                    }}
                  >
                    <StatusPill status={status as Action['status']} size="sm" />
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Risk Level Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 bg-transparent">
                  <Filter className="h-3.5 w-3.5" />
                  Risk Level
                  {selectedRiskLevels.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {selectedRiskLevels.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {riskLevels.map(level => (
                  <DropdownMenuCheckboxItem
                    key={level}
                    checked={selectedRiskLevels.includes(level)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRiskLevels([...selectedRiskLevels, level])
                      } else {
                        setSelectedRiskLevels(selectedRiskLevels.filter(l => l !== level))
                      }
                    }}
                  >
                    <SeverityBadge severity={level as Action['riskLevel']} size="sm" />
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Action Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 bg-transparent">
                  <Filter className="h-3.5 w-3.5" />
                  Action Type
                  {selectedActionTypes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {selectedActionTypes.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {actionTypes.map(type => (
                  <DropdownMenuCheckboxItem
                    key={type.value}
                    checked={selectedActionTypes.includes(type.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedActionTypes([...selectedActionTypes, type.value])
                      } else {
                        setSelectedActionTypes(selectedActionTypes.filter(t => t !== type.value))
                      }
                    }}
                  >
                    {type.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear Filters */}
            {hasCustomFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Queue Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Action Queue</CardTitle>
          <CardDescription>
            {filteredActions.length} actions matching your filters
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-10 p-3">
                    <Checkbox
                      checked={allPendingSelected}
                      onCheckedChange={toggleAllPendingSelection}
                      aria-label="Select all pending actions"
                      className={cn(somePendingSelected && !allPendingSelected && "opacity-50")}
                    />
                  </th>
                  <th className="text-left font-medium text-muted-foreground p-3">Action ID</th>
                  <th className="text-left font-medium text-muted-foreground p-3">Linked Case</th>
                  <th className="text-left font-medium text-muted-foreground p-3">Action Type</th>
                  <th className="text-left font-medium text-muted-foreground p-3">Autonomy</th>
                  <th className="text-left font-medium text-muted-foreground p-3">Approval</th>
                  <th className="text-left font-medium text-muted-foreground p-3">Risk</th>
                  <th className="text-left font-medium text-muted-foreground p-3">Target</th>
                  <th className="text-left font-medium text-muted-foreground p-3">Created</th>
                  <th className="text-left font-medium text-muted-foreground p-3">Status</th>
                  <th className="w-12 p-3" />
                </tr>
              </thead>
              <tbody>
                {filteredActions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-muted-foreground">
                      No actions found matching your filters
                    </td>
                  </tr>
                ) : (
                  filteredActions.map(action => {
                    const relatedCase = mockCases.find(c => c.id === action.caseId)
return (
  <tr
  key={action.id}
  className={cn(
    "border-b border-border hover:bg-muted/50 transition-colors cursor-pointer",
    caseIdFilter && action.caseId === caseIdFilter && "bg-primary/10 hover:bg-primary/15",
    selectedActionIds.has(action.id) && "bg-primary/5"
  )}
  onClick={() => handleActionClick(action)}
  >
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          {action.status === 'pending' ? (
                            <Checkbox
                              checked={selectedActionIds.has(action.id)}
                              onCheckedChange={() => toggleActionSelection(action.id)}
                              aria-label={`Select action ${action.id}`}
                            />
                          ) : (
                            <div className="h-4 w-4" />
                          )}
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-xs text-foreground">{action.id}</span>
                        </td>
                        <td className="p-3">
                          <Link 
                            href={`/cases/${action.caseId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline"
                          >
                            {relatedCase?.caseNumber || action.caseId}
                          </Link>
                        </td>
                        <td className="p-3">
                          <span className="text-foreground capitalize">
                            {action.actionType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {action.autonomyMode.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {action.requiredApproval ? (
                            <Badge variant="secondary" className="bg-warning/15 text-warning text-[10px]">
                              Required
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-success/15 text-success text-[10px]">
                              Auto
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <SeverityBadge severity={action.riskLevel} size="sm" showIcon={false} />
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">
                            {action.targetSystem}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <span className="text-muted-foreground">
                            {new Date(action.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="p-3">
                          <StatusPill status={action.status} size="sm" />
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleActionClick(action)}>
                                View Details
                              </DropdownMenuItem>
                              {action.status === 'pending' && (
                                <>
                                  <DropdownMenuItem>Approve</DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive">Reject</DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] p-0 flex flex-col">
          {selectedAction && (
            <>
              <SheetHeader className="p-6 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Action Details
                    </SheetTitle>
                    <SheetDescription className="mt-1">
                      {selectedAction.id}
                    </SheetDescription>
                  </div>
                  <StatusPill status={selectedAction.status} />
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  {/* Action Info */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground capitalize">
                        {selectedAction.actionType.replace(/_/g, ' ')}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedAction.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Risk Level</div>
                        <div className="mt-1">
                          <SeverityBadge severity={selectedAction.riskLevel} />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Autonomy Mode</div>
                        <div className="mt-1">
                          <Badge variant="outline" className="capitalize">
                            {selectedAction.autonomyMode.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Target System</div>
                        <div className="text-sm font-medium text-foreground mt-1">
                          {selectedAction.targetSystem}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Created</div>
                        <div className="text-sm font-medium text-foreground mt-1">
                          {new Date(selectedAction.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Linked Case</div>
                      <Link href={`/cases/${selectedAction.caseId}`}>
                        <Card>
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                                {mockCases.find(c => c.id === selectedAction.caseId)?.caseNumber || selectedAction.caseId}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </CardContent>
                        </Card>
                      </Link>
                    </div>
                  </div>

                  <Separator />

                  {/* Pre-execution Simulation */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Play className="h-4 w-4 text-primary" />
                        Pre-execution Simulation
                      </h4>
                      {!selectedAction.simulationResult && (
                        <Button size="sm" variant="outline" className="gap-2 bg-transparent">
                          <Play className="h-3.5 w-3.5" />
                          Run Simulation
                        </Button>
                      )}
                    </div>

                    {selectedAction.simulationResult ? (
                      <SimulationResultCard result={selectedAction.simulationResult} />
                    ) : (
                      <Card>
                        <CardContent className="p-8 text-center">
                          <Play className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">
                            No simulation has been run for this action yet.
                          </p>
                          <Button className="mt-4 gap-2">
                            <Play className="h-4 w-4" />
                            Run Simulation Now
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <Separator />

                  {/* Policy-based Guardrails */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4 text-primary" />
                      Policy-based Guardrails
                    </h4>
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {selectedAction.requiredApproval ? (
                              <AlertTriangle className="h-4 w-4 text-warning" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            )}
                            <span className="text-sm font-medium text-foreground">
                              {selectedAction.requiredApproval ? 'Approval Required' : 'Auto-execution Allowed'}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {selectedAction.requiredApproval
                            ? `This action requires manual approval due to ${selectedAction.riskLevel} risk level and the nature of the operation (${selectedAction.actionType.replace(/_/g, ' ')}).`
                            : 'This action can be executed automatically based on the current autonomy settings and risk profile.'
                          }
                        </p>
                        <div className="pt-2">
                          <Link href="/policies" className="text-xs text-primary hover:underline">
                            View applicable policies
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  {/* Audit Timeline */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                      <History className="h-4 w-4 text-primary" />
                      Audit Timeline
                    </h4>
                    <Timeline events={mockAuditEvents.slice(0, 3)} compact />
                  </div>

                  {/* Approval Section */}
                  {selectedAction.status === 'pending' && selectedAction.requiredApproval && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3">
                          Approval Decision
                        </h4>
                        <div className="space-y-3">
                          <Textarea
                            placeholder="Add a comment or note for the approval decision..."
                            className="min-h-[80px] resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="gap-2">
                              <Paperclip className="h-3.5 w-3.5" />
                              Attach
                            </Button>
                            <Button variant="ghost" size="sm" className="gap-2">
                              <Info className="h-3.5 w-3.5" />
                              Request Info
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>

              {/* Footer Actions */}
              {selectedAction.status === 'pending' && (
                <div className="p-6 border-t border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Button variant="destructive" className="flex-1 gap-2">
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button className="flex-1 gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={bulkApprovalOpen} onOpenChange={setBulkApprovalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkAction === 'approve' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  Bulk Approve Actions
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Bulk Reject Actions
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              You are about to {bulkAction} {selectedPendingCount} action(s). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Selected Actions:</span>
                    <span className="font-semibold">{selectedPendingCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Action:</span>
                    <Badge variant={bulkAction === 'approve' ? 'default' : 'destructive'}>
                      {bulkAction === 'approve' ? 'Approve' : 'Reject'}
                    </Badge>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="text-xs text-muted-foreground">
                  All selected actions will be processed immediately. An audit trail will be created for each action.
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setBulkApprovalOpen(false)}
              disabled={isBulkProcessing}
              className="bg-transparent"
            >
              Cancel
            </Button>
            <Button
              variant={bulkAction === 'approve' ? 'default' : 'destructive'}
              onClick={executeBulkAction}
              disabled={isBulkProcessing}
              className="gap-2"
            >
              {isBulkProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {bulkAction === 'approve' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Confirm {bulkAction === 'approve' ? 'Approval' : 'Rejection'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
