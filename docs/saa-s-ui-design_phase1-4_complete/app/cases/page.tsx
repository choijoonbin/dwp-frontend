"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useApp } from "@/components/providers/app-provider"
import {
  Search,
  Filter,
  Columns3,
  Download,
  MoreHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  UserPlus,
  Tag,
  ArrowUpDown,
  Bookmark,
  Plus,
  X,
  Check,
  Eye,
  AlertTriangle,
  Send
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { SeverityBadge } from "@/components/finance/severity-badge"
import { StatusPill } from "@/components/finance/status-pill"
import { ConfidenceMeter } from "@/components/finance/confidence-meter"
import { mockCases, mockSavedViews, type Case, type SavedView } from "@/lib/mock-data"

const allColumns = [
  { id: 'caseNumber', label: 'Case ID', visible: true },
  { id: 'severity', label: 'Severity', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'anomalyType', label: 'Anomaly Type', visible: true },
  { id: 'companyCode', label: 'Company', visible: true },
  { id: 'counterparty', label: 'Counterparty', visible: true },
  { id: 'amount', label: 'Amount', visible: true },
  { id: 'detectedAt', label: 'Detected', visible: true },
  { id: 'slaDue', label: 'SLA Due', visible: true },
  { id: 'assignee', label: 'Assignee', visible: true },
  { id: 'confidence', label: 'Confidence', visible: true },
]

const anomalyTypes = [
  { value: 'duplicate_invoice', label: 'Duplicate Invoice' },
  { value: 'bank_change', label: 'Bank Change' },
  { value: 'policy_violation', label: 'Policy Violation' },
  { value: 'integrity_mismatch', label: 'Integrity Mismatch' },
  { value: 'amount_variance', label: 'Amount Variance' },
  { value: 'timing_anomaly', label: 'Timing Anomaly' },
]

const severities = ['critical', 'high', 'medium', 'low']
const statuses = ['open', 'in_progress', 'pending_approval', 'resolved', 'dismissed']

export default function CaseWorklistPage() {
  const { currentTenant, savedViews, currentView, setCurrentView } = useApp()
  const router = useRouter()

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedAnomalyTypes, setSelectedAnomalyTypes] = useState<string[]>([])

  // Apply saved view filters when view changes
  useEffect(() => {
    if (currentView) {
      const filters = currentView.filters as Record<string, string[]>
      if (filters.status) setSelectedStatuses(filters.status)
      if (filters.severity) setSelectedSeverities(filters.severity)
      // Reset other filters if not in view
      if (!filters.status) setSelectedStatuses([])
      if (!filters.severity) setSelectedSeverities([])
    }
  }, [currentView])
  
  // Table state
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [visibleColumns, setVisibleColumns] = useState(allColumns)
  const [sortColumn, setSortColumn] = useState<string>('detectedAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Save View Dialog
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [newViewName, setNewViewName] = useState("")

  // Filter cases
  const filteredCases = useMemo(() => {
    return mockCases.filter(c => {
      // Tenant filter
      if (c.tenantId !== currentTenant.id) return false
      
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!c.caseNumber.toLowerCase().includes(query) &&
            !c.counterparty.toLowerCase().includes(query) &&
            !c.description.toLowerCase().includes(query)) {
          return false
        }
      }

      // Severity filter
      if (selectedSeverities.length > 0 && !selectedSeverities.includes(c.severity)) {
        return false
      }

      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(c.status)) {
        return false
      }

      // Anomaly type filter
      if (selectedAnomalyTypes.length > 0 && !selectedAnomalyTypes.includes(c.anomalyType)) {
        return false
      }

      return true
    })
  }, [currentTenant.id, searchQuery, selectedSeverities, selectedStatuses, selectedAnomalyTypes])

  // Sort cases
  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => {
      const aVal = a[sortColumn as keyof Case]
      const bVal = b[sortColumn as keyof Case]
      
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      
      return 0
    })
  }, [filteredCases, sortColumn, sortDirection])

  // Paginate
  const paginatedCases = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedCases.slice(start, start + pageSize)
  }, [sortedCases, page, pageSize])

  const totalPages = Math.ceil(sortedCases.length / pageSize)

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnId)
      setSortDirection('asc')
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(paginatedCases.map(c => c.id))
    } else {
      setSelectedRows([])
    }
  }

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedRows([...selectedRows, id])
    } else {
      setSelectedRows(selectedRows.filter(r => r !== id))
    }
  }

  const toggleColumnVisibility = (columnId: string) => {
    setVisibleColumns(cols => 
      cols.map(col => 
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    )
  }

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedSeverities([])
    setSelectedStatuses([])
    setSelectedAnomalyTypes([])
  }

  const hasActiveFilters = searchQuery || selectedSeverities.length > 0 || selectedStatuses.length > 0 || selectedAnomalyTypes.length > 0

  const handleRowClick = (caseId: string) => {
    router.push(`/cases/${caseId}`)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Case Worklist</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and review anomaly detection cases
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Saved Views */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Bookmark className="h-4 w-4" />
                {currentView?.name || "Select View"}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {savedViews.map(view => (
                <DropdownMenuItem
                  key={view.id}
                  onClick={() => setCurrentView(view)}
                  className="gap-2"
                >
                  <Check className={cn(
                    "h-4 w-4",
                    currentView?.id === view.id ? "opacity-100" : "opacity-0"
                  )} />
                  {view.name}
                  {view.isDefault && (
                    <Badge variant="secondary" className="ml-auto text-[10px] h-4">Default</Badge>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
                <DialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Save Current View
                  </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save View</DialogTitle>
                    <DialogDescription>
                      Save your current filters and column settings as a reusable view.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label htmlFor="viewName">View Name</Label>
                    <Input
                      id="viewName"
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      placeholder="e.g., My Critical Cases"
                      className="mt-2"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSaveViewOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => {
                      // Mock save
                      setSaveViewOpen(false)
                      setNewViewName("")
                    }}>
                      Save View
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Severity Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 bg-transparent">
                  <Filter className="h-3.5 w-3.5" />
                  Severity
                  {selectedSeverities.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {selectedSeverities.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {severities.map(severity => (
                  <DropdownMenuCheckboxItem
                    key={severity}
                    checked={selectedSeverities.includes(severity)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSeverities([...selectedSeverities, severity])
                      } else {
                        setSelectedSeverities(selectedSeverities.filter(s => s !== severity))
                      }
                    }}
                  >
                    <SeverityBadge severity={severity as Case['severity']} size="sm" />
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

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
                    <StatusPill status={status as Case['status']} size="sm" />
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Anomaly Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 bg-transparent">
                  <Filter className="h-3.5 w-3.5" />
                  Anomaly Type
                  {selectedAnomalyTypes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {selectedAnomalyTypes.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {anomalyTypes.map(type => (
                  <DropdownMenuCheckboxItem
                    key={type.value}
                    checked={selectedAnomalyTypes.includes(type.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedAnomalyTypes([...selectedAnomalyTypes, type.value])
                      } else {
                        setSelectedAnomalyTypes(selectedAnomalyTypes.filter(t => t !== type.value))
                      }
                    }}
                  >
                    {type.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}

            <div className="flex-1" />

            {/* Column Visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 bg-transparent">
                  <Columns3 className="h-3.5 w-3.5" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {visibleColumns.map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.visible}
                    onCheckedChange={() => toggleColumnVisibility(col.id)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export */}
            <Button variant="outline" size="sm" className="gap-2 h-9 bg-transparent">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedRows.length > 0 && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {selectedRows.length} selected
              </span>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <UserPlus className="h-3.5 w-3.5" />
                Assign
              </Button>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Tag className="h-3.5 w-3.5" />
                Tag
              </Button>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <ArrowUpDown className="h-3.5 w-3.5" />
                Reprioritize
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedRows([])}>
                Clear Selection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-12 p-3">
                    <Checkbox
                      checked={selectedRows.length === paginatedCases.length && paginatedCases.length > 0}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  {visibleColumns.filter(c => c.visible).map(col => (
                    <th 
                      key={col.id}
                      className="text-left font-medium text-muted-foreground p-3 cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => handleSort(col.id)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {sortColumn === col.id && (
                          <ChevronDown className={cn(
                            "h-4 w-4 transition-transform",
                            sortDirection === 'asc' && "rotate-180"
                          )} />
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-12 p-3" />
                </tr>
              </thead>
              <tbody>
                {paginatedCases.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.filter(c => c.visible).length + 2} className="text-center py-12 text-muted-foreground">
                      No cases found matching your filters
                    </td>
                  </tr>
                ) : (
                  paginatedCases.map(caseItem => (
                    <tr 
                      key={caseItem.id} 
                      className={cn(
                        "border-b border-border hover:bg-muted/50 transition-colors cursor-pointer",
                        selectedRows.includes(caseItem.id) && "bg-primary/5"
                      )}
                      onClick={() => handleRowClick(caseItem.id)}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedRows.includes(caseItem.id)}
                          onCheckedChange={(checked) => handleSelectRow(caseItem.id, !!checked)}
                          aria-label={`Select ${caseItem.caseNumber}`}
                        />
                      </td>
                      {visibleColumns.filter(c => c.visible).map(col => (
                        <td key={col.id} className="p-3">
                          <CellContent column={col.id} caseItem={caseItem} />
                        </td>
                      ))}
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/cases/${caseItem.id}`} className="flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Open Case
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex items-center gap-2">
                              <UserPlus className="h-4 w-4" />
                              Assign
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              Escalate
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex items-center gap-2">
                              <Send className="h-4 w-4" />
                              Request Approval
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive flex items-center gap-2">
                              <X className="h-4 w-4" />
                              Dismiss
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Showing</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>of {sortedCases.length} cases</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm">
                Page {page} of {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages || totalPages === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages || totalPages === 0}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CellContent({ column, caseItem }: { column: string; caseItem: Case }) {
  switch (column) {
case 'caseNumber':
  return (
  <div>
    <span className="font-medium text-foreground hover:text-primary transition-colors">
      {caseItem.caseNumber}
    </span>
    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{caseItem.title}</p>
  </div>
  )
    case 'severity':
      return <SeverityBadge severity={caseItem.severity} size="sm" />
    case 'status':
      return <StatusPill status={caseItem.status} size="sm" />
    case 'anomalyType':
      return (
        <span className="text-foreground capitalize">
          {caseItem.anomalyType.replace(/_/g, ' ')}
        </span>
      )
    case 'companyCode':
      return <span className="text-foreground">{caseItem.companyCode}</span>
    case 'counterparty':
      return (
        <div>
          <div className="text-foreground truncate max-w-[150px]">{caseItem.counterparty}</div>
          <div className="text-xs text-muted-foreground">{caseItem.counterpartyId}</div>
        </div>
      )
    case 'amount':
      return (
        <span className="font-medium tabular-nums text-foreground">
          {caseItem.currency} {caseItem.amount.toLocaleString()}
        </span>
      )
    case 'detectedAt':
      return (
        <span className="text-muted-foreground">
          {new Date(caseItem.detectedAt).toLocaleDateString()}
        </span>
      )
    case 'slaDue':
      const slaDue = new Date(caseItem.slaDue)
      const now = new Date()
      const isOverdue = slaDue < now && caseItem.status !== 'resolved' && caseItem.status !== 'dismissed'
      const isAtRisk = !isOverdue && (slaDue.getTime() - now.getTime()) < 24 * 60 * 60 * 1000
      return (
        <span className={cn(
          isOverdue && "text-destructive font-medium",
          isAtRisk && "text-warning font-medium",
          !isOverdue && !isAtRisk && "text-muted-foreground"
        )}>
          {slaDue.toLocaleDateString()}
        </span>
      )
    case 'assignee':
      return caseItem.assignee ? (
        <span className="text-foreground">{caseItem.assignee}</span>
      ) : (
        <span className="text-muted-foreground italic">Unassigned</span>
      )
    case 'confidence':
      return <ConfidenceMeter value={caseItem.confidence} size="sm" />
    default:
      return null
  }
}
