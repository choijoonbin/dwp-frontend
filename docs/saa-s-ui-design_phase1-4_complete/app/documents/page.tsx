"use client"

import { useState, useMemo } from "react"
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
  X,
  Check,
  Eye,
  Bookmark,
  Plus,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  ExternalLink,
  GitBranch,
  AlertCircle
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
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
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { mockFiDocs, mockCompanyCodes, mockCases, type FiDocHeader } from "@/lib/mock-data"

// Column definitions
const allColumns = [
  { id: 'belnr', label: 'Doc Number', visible: true },
  { id: 'bukrs', label: 'Company', visible: true },
  { id: 'gjahr', label: 'Fiscal Year', visible: true },
  { id: 'budat', label: 'Posting Date', visible: true },
  { id: 'blart', label: 'Doc Type', visible: true },
  { id: 'tcode', label: 'TCode', visible: true },
  { id: 'usnam', label: 'Created By', visible: true },
  { id: 'counterparty', label: 'Counterparty', visible: true },
  { id: 'wrbtr', label: 'Amount', visible: true },
  { id: 'waers', label: 'Currency', visible: true },
  { id: 'integrityStatus', label: 'Integrity', visible: true },
  { id: 'reversalFlag', label: 'Reversal', visible: true },
]

const docTypes = [
  { value: 'KR', label: 'KR - Vendor Invoice' },
  { value: 'KZ', label: 'KZ - Vendor Payment' },
  { value: 'DR', label: 'DR - Customer Invoice' },
  { value: 'DZ', label: 'DZ - Customer Payment' },
  { value: 'SA', label: 'SA - G/L Account Doc' },
]

const tcodes = ['FB60', 'FB70', 'FB50', 'FB08', 'F110', 'MIRO']
const integrityStatuses = ['pass', 'warn', 'fail']
const fiscalYears = ['2026', '2025', '2024']

interface SavedDocView {
  id: string
  name: string
  scope: 'personal' | 'team' | 'org'
  filters: Record<string, unknown>
}

const mockSavedDocViews: SavedDocView[] = [
  { id: 'dv-1', name: 'All Documents', scope: 'org', filters: {} },
  { id: 'dv-2', name: 'Integrity Warnings', scope: 'team', filters: { integrityStatus: ['warn', 'fail'] } },
  { id: 'dv-3', name: 'Reversals Only', scope: 'personal', filters: { reversalFlag: true } },
]

export default function FIDocumentsPage() {
  const { currentTenant, currentCompanyCode } = useApp()
  const router = useRouter()

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCompanyCodes, setSelectedCompanyCodes] = useState<string[]>(currentCompanyCode ? [currentCompanyCode.id] : [])
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>("2026")
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([])
  const [selectedTcodes, setSelectedTcodes] = useState<string[]>([])
  const [selectedCreatedBy, setSelectedCreatedBy] = useState<string>("")
  const [selectedIntegrityStatuses, setSelectedIntegrityStatuses] = useState<string[]>([])
  const [amountMin, setAmountMin] = useState<string>("")
  const [amountMax, setAmountMax] = useState<string>("")
  const [selectedCurrency, setSelectedCurrency] = useState<string>("")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")

  // Table state
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [visibleColumns, setVisibleColumns] = useState(allColumns)
  const [sortColumn, setSortColumn] = useState<string>('budat')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Preview panel
  const [previewDoc, setPreviewDoc] = useState<FiDocHeader | null>(null)

  // Saved views
  const [savedViews] = useState<SavedDocView[]>(mockSavedDocViews)
  const [currentView, setCurrentView] = useState<SavedDocView | null>(savedViews[0])
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [newViewName, setNewViewName] = useState("")
  const [newViewScope, setNewViewScope] = useState<'personal' | 'team' | 'org'>('personal')

  // Loading state (mock)
  const [isLoading] = useState(false)

  // Filter documents
  const filteredDocs = useMemo(() => {
    return mockFiDocs.filter(doc => {
      // Tenant filter
      if (doc.tenantId !== currentTenant.id) return false

      // Company code filter
      if (selectedCompanyCodes.length > 0 && !selectedCompanyCodes.includes(doc.bukrs)) return false

      // Fiscal year filter
      if (selectedFiscalYear && doc.gjahr !== selectedFiscalYear) return false

      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!doc.belnr.toLowerCase().includes(query) &&
            !doc.counterparty.toLowerCase().includes(query) &&
            !doc.xblnr.toLowerCase().includes(query) &&
            !doc.bktxt.toLowerCase().includes(query)) {
          return false
        }
      }

      // Doc type filter
      if (selectedDocTypes.length > 0 && !selectedDocTypes.includes(doc.blart)) return false

      // TCode filter
      if (selectedTcodes.length > 0 && !selectedTcodes.includes(doc.tcode)) return false

      // Created by filter
      if (selectedCreatedBy && doc.usnam !== selectedCreatedBy) return false

      // Integrity status filter
      if (selectedIntegrityStatuses.length > 0 && !selectedIntegrityStatuses.includes(doc.integrityStatus)) return false

      // Amount range filter
      if (amountMin && doc.wrbtr < parseFloat(amountMin)) return false
      if (amountMax && doc.wrbtr > parseFloat(amountMax)) return false

      // Currency filter
      if (selectedCurrency && doc.waers !== selectedCurrency) return false

      // Date range filter
      if (dateFrom && doc.budat < dateFrom) return false
      if (dateTo && doc.budat > dateTo) return false

      return true
    })
  }, [currentTenant, selectedCompanyCodes, selectedFiscalYear, searchQuery, selectedDocTypes, selectedTcodes, selectedCreatedBy, selectedIntegrityStatuses, amountMin, amountMax, selectedCurrency, dateFrom, dateTo])

  // Sort documents
  const sortedDocs = useMemo(() => {
    return [...filteredDocs].sort((a, b) => {
      const aVal = a[sortColumn as keyof FiDocHeader]
      const bVal = b[sortColumn as keyof FiDocHeader]
      if (aVal === undefined || bVal === undefined) return 0
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredDocs, sortColumn, sortDirection])

  // Pagination
  const totalPages = Math.ceil(sortedDocs.length / pageSize)
  const paginatedDocs = sortedDocs.slice((page - 1) * pageSize, page * pageSize)

  // Handlers
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const handleSelectRow = (docId: string, checked: boolean) => {
    if (checked) {
      setSelectedRows(prev => [...prev, docId])
    } else {
      setSelectedRows(prev => prev.filter(id => id !== docId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(paginatedDocs.map(d => d.id))
    } else {
      setSelectedRows([])
    }
  }

  const handleRowClick = (doc: FiDocHeader) => {
    setPreviewDoc(doc)
  }

  const handleRowDoubleClick = (docId: string) => {
    router.push(`/documents/${docId}`)
  }

  const toggleColumnVisibility = (colId: string) => {
    setVisibleColumns(prev => prev.map(c => c.id === colId ? { ...c, visible: !c.visible } : c))
  }

  const clearAllFilters = () => {
    setSearchQuery("")
    setSelectedCompanyCodes([])
    setSelectedDocTypes([])
    setSelectedTcodes([])
    setSelectedCreatedBy("")
    setSelectedIntegrityStatuses([])
    setAmountMin("")
    setAmountMax("")
    setSelectedCurrency("")
    setDateFrom("")
    setDateTo("")
  }

  const hasActiveFilters = searchQuery || selectedCompanyCodes.length > 0 || selectedDocTypes.length > 0 || selectedTcodes.length > 0 || selectedCreatedBy || selectedIntegrityStatuses.length > 0 || amountMin || amountMax || selectedCurrency || dateFrom || dateTo

  // Get unique values for filter dropdowns
  const uniqueUsers = [...new Set(mockFiDocs.filter(d => d.tenantId === currentTenant.id).map(d => d.usnam))]
  const uniqueCurrencies = [...new Set(mockFiDocs.map(d => d.waers))]

  // Integrity status badge
  const IntegrityBadge = ({ status }: { status: 'pass' | 'warn' | 'fail' }) => {
    const config = {
      pass: { icon: CheckCircle2, label: 'Pass', className: 'bg-success/10 text-success border-success/20' },
      warn: { icon: AlertTriangle, label: 'Warn', className: 'bg-warning/10 text-warning border-warning/20' },
      fail: { icon: XCircle, label: 'Fail', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    }
    const { icon: Icon, label, className } = config[status]
    return (
      <Badge variant="outline" className={cn("gap-1 font-normal", className)}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  // Cell content renderer
  const CellContent = ({ column, doc }: { column: string; doc: FiDocHeader }) => {
    switch (column) {
      case 'belnr':
        return (
          <div>
            <span className="font-mono text-sm text-foreground">{doc.belnr}</span>
            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{doc.xblnr}</p>
          </div>
        )
      case 'bukrs':
        return <span className="font-mono text-sm">{doc.bukrs}</span>
      case 'gjahr':
        return <span className="font-mono text-sm">{doc.gjahr}</span>
      case 'budat':
        return <span className="text-sm">{new Date(doc.budat).toLocaleDateString()}</span>
      case 'blart':
        return <Badge variant="outline" className="font-mono">{doc.blart}</Badge>
      case 'tcode':
        return <span className="font-mono text-xs text-muted-foreground">{doc.tcode}</span>
      case 'usnam':
        return <span className="text-sm">{doc.usnam}</span>
      case 'counterparty':
        return (
          <div>
            <span className="text-sm">{doc.counterparty}</span>
            {doc.counterpartyId && (
              <p className="text-xs text-muted-foreground">{doc.counterpartyId}</p>
            )}
          </div>
        )
      case 'wrbtr':
        return (
          <span className={cn("font-mono text-sm", doc.wrbtr < 0 && "text-destructive")}>
            {doc.wrbtr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )
      case 'waers':
        return <span className="font-mono text-xs">{doc.waers}</span>
      case 'integrityStatus':
        return <IntegrityBadge status={doc.integrityStatus} />
      case 'reversalFlag':
        return doc.reversalFlag ? (
          <Badge variant="outline" className="gap-1 bg-muted">
            <GitBranch className="h-3 w-3" />
            Rev
          </Badge>
        ) : null
      default:
        return null
    }
  }

  // Related cases for preview
  const getRelatedCases = (docId: string) => {
    return mockCases.filter(c => c.fiDocId === docId)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">FI Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            SAP source-of-truth view for audit-ready evidence
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Saved Views Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Bookmark className="h-4 w-4" />
                {currentView?.name || 'Views'}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {savedViews.map(view => (
                <DropdownMenuItem
                  key={view.id}
                  onClick={() => setCurrentView(view)}
                  className="flex items-center justify-between"
                >
                  <span>{view.name}</span>
                  <Badge variant="outline" className="text-[10px]">{view.scope}</Badge>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSaveViewOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Save Current View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export Button */}
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            {/* Quick Search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search doc number, vendor, reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Company Code */}
            <Select 
              value={selectedCompanyCodes[0] || 'default'} 
              onValueChange={(v) => setSelectedCompanyCodes(v ? [v] : [])}
            >
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                {mockCompanyCodes.filter(c => c.tenantId === currentTenant.id).map(cc => (
                  <SelectItem key={cc.id} value={cc.id}>{cc.id} - {cc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Fiscal Year */}
            <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
              <SelectTrigger className="w-[100px] h-9">
                <SelectValue placeholder="FY" />
              </SelectTrigger>
              <SelectContent>
                {fiscalYears.map(fy => (
                  <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range */}
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[130px] h-9"
                placeholder="From"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[130px] h-9"
                placeholder="To"
              />
            </div>

            {/* Doc Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1 bg-transparent">
                  Doc Type
                  {selectedDocTypes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1">{selectedDocTypes.length}</Badge>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {docTypes.map(dt => (
                  <DropdownMenuCheckboxItem
                    key={dt.value}
                    checked={selectedDocTypes.includes(dt.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedDocTypes(prev => [...prev, dt.value])
                      } else {
                        setSelectedDocTypes(prev => prev.filter(v => v !== dt.value))
                      }
                    }}
                  >
                    {dt.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* TCode Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1 bg-transparent">
                  TCode
                  {selectedTcodes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1">{selectedTcodes.length}</Badge>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {tcodes.map(tc => (
                  <DropdownMenuCheckboxItem
                    key={tc}
                    checked={selectedTcodes.includes(tc)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTcodes(prev => [...prev, tc])
                      } else {
                        setSelectedTcodes(prev => prev.filter(v => v !== tc))
                      }
                    }}
                  >
                    {tc}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Integrity Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1 bg-transparent">
                  Integrity
                  {selectedIntegrityStatuses.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1">{selectedIntegrityStatuses.length}</Badge>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {integrityStatuses.map(status => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selectedIntegrityStatuses.includes(status)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIntegrityStatuses(prev => [...prev, status])
                      } else {
                        setSelectedIntegrityStatuses(prev => prev.filter(v => v !== status))
                      }
                    }}
                  >
                    <span className="capitalize">{status}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* More Filters Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1 bg-transparent">
                  <Filter className="h-4 w-4" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 p-3">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Created By</Label>
                    <Select value={selectedCreatedBy} onValueChange={setSelectedCreatedBy}>
                      <SelectTrigger className="h-8 mt-1">
                        <SelectValue placeholder="Any user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any user</SelectItem>
                        {uniqueUsers.map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Amount Range</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={amountMin}
                        onChange={(e) => setAmountMin(e.target.value)}
                        className="h-8"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={amountMax}
                        onChange={(e) => setAmountMax(e.target.value)}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Currency</Label>
                    <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                      <SelectTrigger className="h-8 mt-1">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any</SelectItem>
                        {uniqueCurrencies.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Column Visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 bg-transparent">
                  <Columns3 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
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

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchQuery}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                </Badge>
              )}
              {selectedCompanyCodes.map(cc => (
                <Badge key={cc} variant="secondary" className="gap-1">
                  Company: {cc}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCompanyCodes(prev => prev.filter(v => v !== cc))} />
                </Badge>
              ))}
              {selectedDocTypes.map(dt => (
                <Badge key={dt} variant="secondary" className="gap-1">
                  Type: {dt}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedDocTypes(prev => prev.filter(v => v !== dt))} />
                </Badge>
              ))}
              {selectedIntegrityStatuses.map(s => (
                <Badge key={s} variant="secondary" className="gap-1 capitalize">
                  Integrity: {s}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedIntegrityStatuses(prev => prev.filter(v => v !== s))} />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content: Table + Preview */}
      <div className="flex gap-4">
        {/* Table */}
        <Card className={cn("flex-1", previewDoc && "lg:flex-[2]")}>
          <CardContent className="p-0">
            {/* Bulk Actions Bar */}
            {selectedRows.length > 0 && (
              <div className="p-3 bg-primary/5 border-b border-border flex items-center justify-between">
                <span className="text-sm">{selectedRows.length} document(s) selected</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                    <Download className="h-3.5 w-3.5" />
                    Export Selected
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedRows([])}>
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="w-10 p-3">
                      <Checkbox
                        checked={paginatedDocs.length > 0 && selectedRows.length === paginatedDocs.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    {visibleColumns.filter(c => c.visible).map(col => (
                      <th
                        key={col.id}
                        className="text-left font-medium text-muted-foreground p-3 cursor-pointer hover:text-foreground"
                        onClick={() => handleSort(col.id)}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {sortColumn === col.id && (
                            <ArrowUpDown className={cn("h-3 w-3", sortDirection === 'desc' && "rotate-180")} />
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="w-10 p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    // Loading skeleton
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="p-3"><Skeleton className="h-4 w-4" /></td>
                        {visibleColumns.filter(c => c.visible).map(col => (
                          <td key={col.id} className="p-3"><Skeleton className="h-4 w-20" /></td>
                        ))}
                        <td className="p-3"><Skeleton className="h-4 w-4" /></td>
                      </tr>
                    ))
                  ) : paginatedDocs.length === 0 ? (
                    // Empty state
                    <tr>
                      <td colSpan={visibleColumns.filter(c => c.visible).length + 2} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="h-12 w-12 text-muted-foreground/50" />
                          <p className="text-muted-foreground">No documents found</p>
                          <p className="text-sm text-muted-foreground/70">Try adjusting your filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedDocs.map(doc => (
                      <tr
                        key={doc.id}
                        className={cn(
                          "border-b border-border hover:bg-muted/50 transition-colors cursor-pointer",
                          selectedRows.includes(doc.id) && "bg-primary/5",
                          previewDoc?.id === doc.id && "bg-primary/10"
                        )}
                        onClick={() => handleRowClick(doc)}
                        onDoubleClick={() => handleRowDoubleClick(doc.id)}
                      >
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedRows.includes(doc.id)}
                            onCheckedChange={(checked) => handleSelectRow(doc.id, !!checked)}
                          />
                        </td>
                        {visibleColumns.filter(c => c.visible).map(col => (
                          <td key={col.id} className="p-3">
                            <CellContent column={col.id} doc={doc} />
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
                              <DropdownMenuItem asChild>
                                <Link href={`/documents/${doc.id}`} className="flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  Open Detail
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/lineage?docId=${doc.id}`} className="flex items-center gap-2">
                                  <GitBranch className="h-4 w-4" />
                                  View Lineage
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="flex items-center gap-2">
                                <ExternalLink className="h-4 w-4" />
                                Open in SAP
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
            <div className="p-3 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, sortedDocs.length)} of {sortedDocs.length}</span>
                <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setPage(1); }}>
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map(size => (
                      <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>per page</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" disabled={page === 1} onClick={() => setPage(1)}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">Page {page} of {totalPages || 1}</span>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        {previewDoc && (
          <Card className="hidden lg:block w-[350px] sticky top-20 h-fit">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Document Preview
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewDoc(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Header Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-semibold">{previewDoc.belnr}</span>
                  <IntegrityBadge status={previewDoc.integrityStatus} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Company</p>
                    <p className="font-medium">{previewDoc.bukrs}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Fiscal Year</p>
                    <p className="font-medium">{previewDoc.gjahr}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Posting Date</p>
                    <p className="font-medium">{new Date(previewDoc.budat).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Doc Type</p>
                    <p className="font-medium">{previewDoc.blart}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Amount</span>
                  <span className="font-mono font-semibold">
                    {previewDoc.wrbtr.toLocaleString('en-US', { minimumFractionDigits: 2 })} {previewDoc.waers}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Counterparty</p>
                  <p className="font-medium">{previewDoc.counterparty}</p>
                </div>
              </div>

              <Separator />

              {/* Integrity Checks Summary */}
              <div>
                <p className="text-sm font-medium mb-2">Integrity Checks</p>
                <div className="flex flex-wrap gap-1">
                  {previewDoc.integrityStatus === 'pass' ? (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      All checks passed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className={cn(
                      "gap-1",
                      previewDoc.integrityStatus === 'warn' && "bg-warning/10 text-warning border-warning/20",
                      previewDoc.integrityStatus === 'fail' && "bg-destructive/10 text-destructive border-destructive/20"
                    )}>
                      <AlertCircle className="h-3 w-3" />
                      {previewDoc.integrityStatus === 'warn' ? 'Warnings detected' : 'Failures detected'}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Related Cases */}
              {getRelatedCases(previewDoc.id).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">Related Cases</p>
                    <div className="space-y-1">
                      {getRelatedCases(previewDoc.id).map(c => (
                        <Link
                          key={c.id}
                          href={`/cases/${c.id}`}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted text-sm"
                        >
                          <span className="font-mono">{c.caseNumber}</span>
                          <Badge variant={c.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                            {c.severity}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Quick Links */}
              <div className="flex flex-col gap-2">
                <Button asChild className="w-full">
                  <Link href={`/documents/${previewDoc.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    Open Detail
                  </Link>
                </Button>
                <Button variant="outline" asChild className="w-full bg-transparent">
                  <Link href={`/lineage?docId=${previewDoc.id}`}>
                    <GitBranch className="h-4 w-4 mr-2" />
                    Open Lineage
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
            <div>
              <Label>View Name</Label>
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="My Custom View"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Scope</Label>
              <RadioGroup value={newViewScope} onValueChange={(v: 'personal' | 'team' | 'org') => setNewViewScope(v)} className="mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="personal" id="personal" />
                  <Label htmlFor="personal" className="font-normal">Personal (only me)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="team" id="team" />
                  <Label htmlFor="team" className="font-normal">Team (shared with my team)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="org" id="org" />
                  <Label htmlFor="org" className="font-normal">Organization (visible to all)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveViewOpen(false)} className="bg-transparent">Cancel</Button>
            <Button onClick={() => setSaveViewOpen(false)}>Save View</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
