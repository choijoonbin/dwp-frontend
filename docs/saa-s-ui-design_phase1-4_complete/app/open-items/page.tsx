"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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
  Wallet,
  AlertTriangle,
  Ban,
  FileText,
  Building2,
  GitBranch,
  Zap,
  Mail,
  CheckCircle2,
  Clock,
  X,
  Plus,
  Check,
  Bookmark,
  Eye,
  Play,
  ShieldAlert,
  ShieldCheck,
  ShieldX
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  mockOpenItems,
  mockCompanyCodes,
  mockEntities,
  type OpenItem,
} from "@/lib/mock-data"

// Aging Bucket Card
function AgingBucketCard({ 
  label, 
  count, 
  amount, 
  currency,
  isActive,
  onClick
}: { 
  label: string
  count: number
  amount: number
  currency: string
  isActive: boolean
  onClick: () => void
}) {
  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amt)
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 min-w-[120px] p-3 rounded-lg border text-left transition-colors",
        isActive 
          ? "bg-primary/10 border-primary/50" 
          : "bg-muted/50 border-border hover:bg-muted"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-1">{formatCurrency(amount)}</p>
      <p className="text-xs text-muted-foreground">{count} items</p>
    </button>
  )
}

// Guardrail Status Badge
function GuardrailBadge({ status }: { status?: 'allowed' | 'approval_required' | 'blocked' }) {
  if (!status) return null

  const config = {
    allowed: { icon: ShieldCheck, label: 'Allowed', className: 'bg-success/10 text-success border-success/20' },
    approval_required: { icon: ShieldAlert, label: 'Approval Required', className: 'bg-warning/10 text-warning border-warning/20' },
    blocked: { icon: ShieldX, label: 'Blocked', className: 'bg-destructive/10 text-destructive border-destructive/20' }
  }

  const { icon: Icon, label, className } = config[status]

  return (
    <Badge variant="outline" className={cn("text-xs gap-1", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}

// Column definitions
const columns = [
  { id: 'id', label: 'Item ID', visible: true },
  { id: 'type', label: 'Type', visible: true },
  { id: 'entityName', label: 'Entity', visible: true },
  { id: 'dueDate', label: 'Due Date', visible: true },
  { id: 'daysPastDue', label: 'Overdue', visible: true },
  { id: 'amount', label: 'Amount', visible: true },
  { id: 'disputeFlag', label: 'Dispute', visible: true },
  { id: 'paymentBlock', label: 'Block', visible: true },
  { id: 'docNumber', label: 'Document', visible: true },
  { id: 'recommendedAction', label: 'Recommended', visible: true },
  { id: 'status', label: 'Status', visible: true },
]

export default function OpenItemsPage() {
  const searchParams = useSearchParams()
  const { currentTenant, companyCodes } = useApp()

  // Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || "")
  const [selectedType, setSelectedType] = useState<string>(searchParams.get('type') || "all")
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>(searchParams.get('companyCode') || "all")
  const [entityFilter, setEntityFilter] = useState<string>(searchParams.get('entityId') || "")
  const [disputeFilter, setDisputeFilter] = useState<string>("all")
  const [blockFilter, setBlockFilter] = useState<string>("all")
  const [agingFilter, setAgingFilter] = useState<string | null>(null)

  // Table state
  const [visibleColumns, setVisibleColumns] = useState(columns)
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [sortColumn, setSortColumn] = useState<string>('daysPastDue')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Drawer state
  const [selectedItem, setSelectedItem] = useState<OpenItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Dialogs
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [newViewName, setNewViewName] = useState("")
  const [newViewScope, setNewViewScope] = useState<'personal' | 'team' | 'org'>('personal')

  // Calculate aging buckets
  const agingBuckets = useMemo(() => {
    const tenantItems = mockOpenItems.filter(oi => oi.tenantId === currentTenant.id)
    const buckets = {
      current: { count: 0, amount: 0 },
      '1-30': { count: 0, amount: 0 },
      '31-60': { count: 0, amount: 0 },
      '61-90': { count: 0, amount: 0 },
      '90+': { count: 0, amount: 0 }
    }

    tenantItems.forEach(item => {
      const days = item.daysPastDue
      const bucket = days <= 0 ? 'current' 
        : days <= 30 ? '1-30'
        : days <= 60 ? '31-60'
        : days <= 90 ? '61-90'
        : '90+'
      buckets[bucket].count++
      buckets[bucket].amount += item.amount
    })

    return buckets
  }, [currentTenant])

  // Filter open items
  const filteredItems = useMemo(() => {
    return mockOpenItems.filter(item => {
      // Tenant filter
      if (item.tenantId !== currentTenant.id) return false

      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!item.id.toLowerCase().includes(query) &&
            !item.docNumber.toLowerCase().includes(query) &&
            !item.entityName.toLowerCase().includes(query)) {
          return false
        }
      }

      // Type filter
      if (selectedType !== 'all' && item.type !== selectedType) {
        return false
      }

      // Company code
      if (selectedCompanyCode !== 'all' && item.companyCode !== selectedCompanyCode) {
        return false
      }

      // Entity filter
      if (entityFilter && item.entityId !== entityFilter) {
        return false
      }

      // Dispute filter
      if (disputeFilter === 'yes' && !item.disputeFlag) return false
      if (disputeFilter === 'no' && item.disputeFlag) return false

      // Block filter
      if (blockFilter === 'yes' && !item.paymentBlock) return false
      if (blockFilter === 'no' && item.paymentBlock) return false

      // Aging filter
      if (agingFilter) {
        const days = item.daysPastDue
        switch (agingFilter) {
          case 'current': if (days > 0) return false; break
          case '1-30': if (days <= 0 || days > 30) return false; break
          case '31-60': if (days <= 30 || days > 60) return false; break
          case '61-90': if (days <= 60 || days > 90) return false; break
          case '90+': if (days <= 90) return false; break
        }
      }

      return true
    })
  }, [currentTenant, searchQuery, selectedType, selectedCompanyCode, entityFilter, disputeFilter, blockFilter, agingFilter])

  // Sort items
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aVal = a[sortColumn as keyof OpenItem]
      const bVal = b[sortColumn as keyof OpenItem]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        return sortDirection === 'asc' 
          ? (aVal ? 1 : 0) - (bVal ? 1 : 0)
          : (bVal ? 1 : 0) - (aVal ? 1 : 0)
      }
      return sortDirection === 'asc' 
        ? String(aVal || '').localeCompare(String(bVal || ''))
        : String(bVal || '').localeCompare(String(aVal || ''))
    })
  }, [filteredItems, sortColumn, sortDirection])

  // Paginate
  const totalPages = Math.ceil(sortedItems.length / pageSize)
  const paginatedItems = sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Active filters
  const activeFilters = [
    ...(selectedType !== 'all' ? [{ key: 'type', label: `Type: ${selectedType}` }] : []),
    ...(selectedCompanyCode !== 'all' ? [{ key: 'company', label: `Company: ${selectedCompanyCode}` }] : []),
    ...(entityFilter ? [{ key: 'entity', label: `Entity: ${entityFilter}` }] : []),
    ...(disputeFilter !== 'all' ? [{ key: 'dispute', label: `Dispute: ${disputeFilter}` }] : []),
    ...(blockFilter !== 'all' ? [{ key: 'block', label: `Blocked: ${blockFilter}` }] : []),
    ...(agingFilter ? [{ key: 'aging', label: `Aging: ${agingFilter}` }] : []),
  ]

  const clearFilter = (key: string) => {
    switch (key) {
      case 'type': setSelectedType('all'); break
      case 'company': setSelectedCompanyCode('all'); break
      case 'entity': setEntityFilter(''); break
      case 'dispute': setDisputeFilter('all'); break
      case 'block': setBlockFilter('all'); break
      case 'aging': setAgingFilter(null); break
    }
  }

  const handleRowClick = (item: OpenItem) => {
    setSelectedItem(item)
    setDrawerOpen(true)
  }

  const handleSelectRow = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedRows(prev => [...prev, itemId])
    } else {
      setSelectedRows(prev => prev.filter(id => id !== itemId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(paginatedItems.map(i => i.id))
    } else {
      setSelectedRows([])
    }
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

  const getActionLabel = (action?: string) => {
    switch (action) {
      case 'send_reminder': return 'Send Reminder'
      case 'request_approval': return 'Request Approval'
      case 'create_case': return 'Create Case'
      case 'escalate': return 'Escalate'
      case 'auto_clear': return 'Auto Clear'
      default: return '-'
    }
  }

  // Get selected items type for bulk actions
  const selectedItemsType = useMemo(() => {
    if (selectedRows.length === 0) return null
    const items = mockOpenItems.filter(i => selectedRows.includes(i.id))
    const types = new Set(items.map(i => i.type))
    if (types.size === 1) return Array.from(types)[0]
    return 'mixed'
  }, [selectedRows])

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Open Items</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AR/AP operational view for overdue risk and recommended actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Bookmark className="h-4 w-4" />
                <span className="hidden sm:inline">Saved Views</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Views</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>All Open Items</DropdownMenuItem>
              <DropdownMenuItem>Overdue AP</DropdownMenuItem>
              <DropdownMenuItem>Disputed Items</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSaveViewOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Save Current View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Aging Buckets */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Aging Analysis</span>
            <Tabs value={selectedType} onValueChange={setSelectedType} className="ml-auto">
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs h-6 px-2">All</TabsTrigger>
                <TabsTrigger value="AR" className="text-xs h-6 px-2">AR</TabsTrigger>
                <TabsTrigger value="AP" className="text-xs h-6 px-2">AP</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <AgingBucketCard
              label="Current"
              count={agingBuckets.current.count}
              amount={agingBuckets.current.amount}
              currency="USD"
              isActive={agingFilter === 'current'}
              onClick={() => setAgingFilter(agingFilter === 'current' ? null : 'current')}
            />
            <AgingBucketCard
              label="1-30 Days"
              count={agingBuckets['1-30'].count}
              amount={agingBuckets['1-30'].amount}
              currency="USD"
              isActive={agingFilter === '1-30'}
              onClick={() => setAgingFilter(agingFilter === '1-30' ? null : '1-30')}
            />
            <AgingBucketCard
              label="31-60 Days"
              count={agingBuckets['31-60'].count}
              amount={agingBuckets['31-60'].amount}
              currency="USD"
              isActive={agingFilter === '31-60'}
              onClick={() => setAgingFilter(agingFilter === '31-60' ? null : '31-60')}
            />
            <AgingBucketCard
              label="61-90 Days"
              count={agingBuckets['61-90'].count}
              amount={agingBuckets['61-90'].amount}
              currency="USD"
              isActive={agingFilter === '61-90'}
              onClick={() => setAgingFilter(agingFilter === '61-90' ? null : '61-90')}
            />
            <AgingBucketCard
              label="90+ Days"
              count={agingBuckets['90+'].count}
              amount={agingBuckets['90+'].amount}
              currency="USD"
              isActive={agingFilter === '90+'}
              onClick={() => setAgingFilter(agingFilter === '90+' ? null : '90+')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search item ID, document, or entity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              <Select value={selectedCompanyCode} onValueChange={setSelectedCompanyCode}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companyCodes.map(cc => (
                    <SelectItem key={cc.id} value={cc.id}>{cc.id} - {cc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={disputeFilter} onValueChange={setDisputeFilter}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue placeholder="Dispute" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Disputes</SelectItem>
                  <SelectItem value="yes">Disputed</SelectItem>
                  <SelectItem value="no">Not Disputed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={blockFilter} onValueChange={setBlockFilter}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue placeholder="Block" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Blocks</SelectItem>
                  <SelectItem value="yes">Blocked</SelectItem>
                  <SelectItem value="no">Not Blocked</SelectItem>
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2 bg-transparent">
                    <Columns3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Columns</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {visibleColumns.map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={col.visible}
                      onCheckedChange={(checked) => {
                        setVisibleColumns(prev => prev.map(c => 
                          c.id === col.id ? { ...c, visible: checked } : c
                        ))
                      }}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Active filters */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Active filters:</span>
                {activeFilters.map(filter => (
                  <Badge
                    key={filter.key}
                    variant="secondary"
                    className="gap-1 pr-1 cursor-pointer hover:bg-secondary/80"
                    onClick={() => clearFilter(filter.key)}
                  >
                    {filter.label}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setSelectedType('all')
                    setSelectedCompanyCode('all')
                    setEntityFilter('')
                    setDisputeFilter('all')
                    setBlockFilter('all')
                    setAgingFilter(null)
                  }}
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedRows.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{selectedRows.length} item(s) selected</span>
              <div className="flex items-center gap-2">
                {selectedItemsType === 'AR' && (
                  <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                    <Mail className="h-3.5 w-3.5" />
                    Send Reminder
                  </Button>
                )}
                {selectedItemsType === 'AP' && (
                  <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Request Approval
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Create Case
                </Button>
                <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                  <Play className="h-3.5 w-3.5" />
                  Simulate Action
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRows([])}>
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-10 p-3">
                    <Checkbox
                      checked={paginatedItems.length > 0 && selectedRows.length === paginatedItems.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  {visibleColumns.filter(c => c.visible).map(col => (
                    <th
                      key={col.id}
                      className="text-left font-medium text-muted-foreground p-3 cursor-pointer hover:bg-muted/70 whitespace-nowrap"
                      onClick={() => {
                        if (sortColumn === col.id) {
                          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
                        } else {
                          setSortColumn(col.id)
                          setSortDirection('desc')
                        }
                      }}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {sortColumn === col.id && (
                          <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-10 p-3"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.filter(c => c.visible).length + 2} className="text-center py-12 text-muted-foreground">
                      No open items found matching your filters
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map(item => (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-border hover:bg-muted/50 transition-colors cursor-pointer",
                        selectedRows.includes(item.id) && "bg-primary/5",
                        selectedItem?.id === item.id && "bg-primary/10"
                      )}
                      onClick={() => handleRowClick(item)}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedRows.includes(item.id)}
                          onCheckedChange={(checked) => handleSelectRow(item.id, !!checked)}
                        />
                      </td>
                      {visibleColumns.filter(c => c.visible).map(col => (
                        <td key={col.id} className="p-3">
                          {col.id === 'id' && (
                            <span className="font-mono text-xs">{item.id}</span>
                          )}
                          {col.id === 'type' && (
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              item.type === 'AR' ? "bg-info/10 text-info" : "bg-primary/10 text-primary"
                            )}>
                              {item.type}
                            </Badge>
                          )}
                          {col.id === 'entityName' && (
                            <span className="font-medium">{item.entityName}</span>
                          )}
                          {col.id === 'dueDate' && (
                            <span>{formatDate(item.dueDate)}</span>
                          )}
                          {col.id === 'daysPastDue' && (
                            <span className={cn(
                              item.daysPastDue > 0 && "text-destructive font-medium"
                            )}>
                              {item.daysPastDue > 0 ? `+${item.daysPastDue}d` : '-'}
                            </span>
                          )}
                          {col.id === 'amount' && (
                            <span className="font-mono">{formatCurrency(item.amount, item.currency)}</span>
                          )}
                          {col.id === 'disputeFlag' && (
                            item.disputeFlag ? (
                              <Badge variant="outline" className="text-xs bg-warning/10 text-warning">Yes</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )
                          )}
                          {col.id === 'paymentBlock' && (
                            item.paymentBlock ? (
                              <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive">
                                <Ban className="h-3 w-3 mr-1" />
                                Blocked
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )
                          )}
                          {col.id === 'docNumber' && (
                            <Link 
                              href={`/documents/${item.docId}`} 
                              className="text-primary hover:underline font-mono text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {item.docNumber}
                            </Link>
                          )}
                          {col.id === 'recommendedAction' && (
                            <span className="text-xs">{getActionLabel(item.recommendedAction)}</span>
                          )}
                          {col.id === 'status' && (
                            <Badge variant="outline" className="text-xs">
                              {item.status.replace('_', ' ')}
                            </Badge>
                          )}
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
                            <DropdownMenuItem onClick={() => handleRowClick(item)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/documents/${item.docId}`}>
                                <FileText className="h-4 w-4 mr-2" />
                                View Document
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/entities/${item.entityId}`}>
                                <Building2 className="h-4 w-4 mr-2" />
                                View Entity
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/lineage?openItemId=${item.id}`}>
                                <GitBranch className="h-4 w-4 mr-2" />
                                View Lineage
                              </Link>
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
              <span>Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, sortedItems.length)} of {sortedItems.length}</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1) }}>
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span>per page</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm">Page {currentPage} of {totalPages || 1}</span>
              <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Open Item Details
                </SheetTitle>
                <SheetDescription>
                  {selectedItem.id} - {selectedItem.entityName}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {/* Item Summary */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Summary</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedItem.amount, selectedItem.currency)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className={cn(
                        "text-xl font-bold",
                        selectedItem.daysPastDue > 0 && "text-destructive"
                      )}>
                        {selectedItem.daysPastDue > 0 ? `+${selectedItem.daysPastDue}d` : formatDate(selectedItem.dueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      selectedItem.type === 'AR' ? "bg-info/10 text-info" : "bg-primary/10 text-primary"
                    )}>
                      {selectedItem.type}
                    </Badge>
                    {selectedItem.disputeFlag && (
                      <Badge variant="outline" className="text-xs bg-warning/10 text-warning">Dispute</Badge>
                    )}
                    {selectedItem.paymentBlock && (
                      <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive">Blocked</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">{selectedItem.status.replace('_', ' ')}</Badge>
                  </div>
                  {selectedItem.blockReason && (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                      <strong>Block reason:</strong> {selectedItem.blockReason}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Linked Evidence */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Linked Evidence</h4>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-transparent" asChild>
                      <Link href={`/documents/${selectedItem.docId}`}>
                        <FileText className="h-4 w-4" />
                        FI Document: {selectedItem.docNumber}
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-transparent" asChild>
                      <Link href={`/entities/${selectedItem.entityId}`}>
                        <Building2 className="h-4 w-4" />
                        Entity: {selectedItem.entityName}
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-transparent" asChild>
                      <Link href={`/lineage?openItemId=${selectedItem.id}`}>
                        <GitBranch className="h-4 w-4" />
                        View Lineage
                      </Link>
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Recommended Actions */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Recommended Actions</h4>
                  {selectedItem.guardrailStatus && (
                    <div className="flex items-center gap-2 mb-2">
                      <GuardrailBadge status={selectedItem.guardrailStatus} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-transparent">
                      <Play className="h-4 w-4" />
                      Run Simulation
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-transparent">
                      <AlertTriangle className="h-4 w-4" />
                      Create/Link Case
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-transparent" asChild>
                      <Link href="/actions">
                        <Zap className="h-4 w-4" />
                        Go to Action Center
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Clearing History */}
                {selectedItem.clearingHistory && selectedItem.clearingHistory.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Clearing History</h4>
                      <div className="space-y-2">
                        {selectedItem.clearingHistory.map((entry, i) => (
                          <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                            <div>
                              <p className="font-mono text-xs">{entry.clearingDoc}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                            </div>
                            <span className="font-medium">{formatCurrency(entry.amount, selectedItem.currency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Mini Audit Timeline */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Activity</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                      <div>
                        <p>Item created</p>
                        <p className="text-xs text-muted-foreground">System import</p>
                      </div>
                    </div>
                    {selectedItem.paymentBlock && (
                      <div className="flex gap-3">
                        <div className="h-2 w-2 rounded-full bg-destructive mt-1.5" />
                        <div>
                          <p>Payment blocked</p>
                          <p className="text-xs text-muted-foreground">{selectedItem.blockReason || 'Automatic rule'}</p>
                        </div>
                      </div>
                    )}
                    {selectedItem.disputeFlag && (
                      <div className="flex gap-3">
                        <div className="h-2 w-2 rounded-full bg-warning mt-1.5" />
                        <div>
                          <p>Dispute raised</p>
                          <p className="text-xs text-muted-foreground">Manual flag</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Save View Dialog */}
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
            <DialogDescription>
              Save your current filters and column settings as a reusable view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>View Name</Label>
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g., Overdue AP Items"
              />
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={newViewScope} onValueChange={(v) => setNewViewScope(v as typeof newViewScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal (only me)</SelectItem>
                  <SelectItem value="team">Team (my team)</SelectItem>
                  <SelectItem value="org">Organization (everyone)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveViewOpen(false)} className="bg-transparent">
              Cancel
            </Button>
            <Button onClick={() => { setSaveViewOpen(false); setNewViewName('') }}>
              <Check className="h-4 w-4 mr-2" />
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
