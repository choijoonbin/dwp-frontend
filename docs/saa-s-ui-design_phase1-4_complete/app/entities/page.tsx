"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
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
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  FileText,
  ExternalLink,
  X,
  Plus,
  Check,
  Bookmark,
  Eye,
  History,
  GitBranch
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
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
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  mockEntities,
  mockCompanyCodes,
  mockEntityChangeLogs,
  type Entity,
} from "@/lib/mock-data"

// Risk Score Badge Component with glow effect for critical
function RiskScoreBadge({ score, trend }: { score: number; trend: 'up' | 'down' | 'stable' }) {
  const getStyles = (s: number) => {
    if (s > 80) return {
      classes: 'bg-destructive/10 text-destructive border-destructive/30',
      glow: 'shadow-[0_0_8px_rgba(239,68,68,0.3)]' // subtle red glow for critical
    }
    if (s > 50) return {
      classes: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400',
      glow: ''
    }
    return {
      classes: 'bg-muted text-muted-foreground border-border',
      glow: ''
    }
  }

  const { classes, glow } = getStyles(score)
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium", classes, glow)}>
      <span>{score}</span>
      <TrendIcon className="h-3 w-3" />
    </div>
  )
}

// Concentration Risk Badge
function ConcentrationBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const styles = {
    low: 'bg-success/10 text-success border-success/20',
    medium: 'bg-warning/10 text-warning border-warning/20',
    high: 'bg-destructive/10 text-destructive border-destructive/20'
  }
  return (
    <Badge variant="outline" className={cn("text-xs", styles[level])}>
      {level.charAt(0).toUpperCase() + level.slice(1)} Concentration
    </Badge>
  )
}

// Mock country data mapping (by company code)
const countryByCompanyCode: Record<string, string> = {
  '1000': 'US',
  '2000': 'DE',
  '3000': 'SG',
  '4000': 'US',
  '5000': 'GB',
}

// Column definitions
const columns = [
  { id: 'code', label: 'Entity ID', visible: true },
  { id: 'name', label: 'Name', visible: true },
  { id: 'type', label: 'Type', visible: true },
  { id: 'country', label: 'Country', visible: true },
  { id: 'riskScore', label: 'Risk Score', visible: true },
  { id: 'openItemsCount', label: 'Open Items', visible: true },
  { id: 'recentAnomaliesCount', label: 'Anomalies', visible: true },
  { id: 'openItemsTotal', label: 'Total Amount', visible: false },
  { id: 'overdueTotal', label: 'Overdue', visible: true },
  { id: 'lastUpdated', label: 'Last Change', visible: true },
]

export default function EntitiesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentTenant, companyCodes } = useApp()

  // Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || "")
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [riskRange, setRiskRange] = useState<[number, number]>([0, 100])
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>(searchParams.get('companyCode') || "all")
  const [openItemsMin, setOpenItemsMin] = useState<string>("")
  const [openItemsMax, setOpenItemsMax] = useState<string>("")
  
  // Quick filters
  const [quickRiskLevel, setQuickRiskLevel] = useState<'all' | 'critical' | 'high' | 'normal'>('all')
  const [showHighValue, setShowHighValue] = useState(false)

  // Table state
  const [visibleColumns, setVisibleColumns] = useState(columns)
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [sortColumn, setSortColumn] = useState<string>('riskScore')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  
  // Preview panel
  const [previewEntity, setPreviewEntity] = useState<Entity | null>(null)

  // Saved Views
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [newViewName, setNewViewName] = useState("")
  const [newViewScope, setNewViewScope] = useState<'personal' | 'team' | 'org'>('personal')

  // Filter entities
  const filteredEntities = useMemo(() => {
    return mockEntities.filter(entity => {
      // Tenant filter
      if (entity.tenantId !== currentTenant.id) return false

      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!entity.code.toLowerCase().includes(query) &&
            !entity.name.toLowerCase().includes(query)) {
          return false
        }
      }

      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(entity.type)) {
        return false
      }

      // Quick risk level filter
      if (quickRiskLevel === 'critical' && entity.riskScore <= 80) return false
      if (quickRiskLevel === 'high' && (entity.riskScore <= 50 || entity.riskScore > 80)) return false
      if (quickRiskLevel === 'normal' && entity.riskScore > 50) return false

      // Risk range (only applies if not using quick filter)
      if (quickRiskLevel === 'all') {
        if (entity.riskScore < riskRange[0] || entity.riskScore > riskRange[1]) {
          return false
        }
      }

      // Company code
      if (selectedCompanyCode !== 'all' && entity.companyCode !== selectedCompanyCode) {
        return false
      }

      // High-value accounts filter (>$100k open items)
      if (showHighValue && entity.openItemsTotal < 100000) {
        return false
      }

      // Open items range
      if (openItemsMin && entity.openItemsTotal < parseFloat(openItemsMin)) {
        return false
      }
      if (openItemsMax && entity.openItemsTotal > parseFloat(openItemsMax)) {
        return false
      }

      return true
    })
  }, [currentTenant, searchQuery, selectedTypes, riskRange, selectedCompanyCode, openItemsMin, openItemsMax, quickRiskLevel, showHighValue])

  // Sort entities
  const sortedEntities = useMemo(() => {
    return [...filteredEntities].sort((a, b) => {
      const aVal = a[sortColumn as keyof Entity]
      const bVal = b[sortColumn as keyof Entity]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      return sortDirection === 'asc' 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
  }, [filteredEntities, sortColumn, sortDirection])

  // Paginate
  const totalPages = Math.ceil(sortedEntities.length / pageSize)
  const paginatedEntities = sortedEntities.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Active filters
  const activeFilters = [
    ...(selectedTypes.length > 0 ? [{ key: 'type', label: `Type: ${selectedTypes.join(', ')}` }] : []),
    ...(quickRiskLevel !== 'all' ? [{ key: 'quickRisk', label: `Risk: ${quickRiskLevel.charAt(0).toUpperCase() + quickRiskLevel.slice(1)}` }] : []),
    ...(riskRange[0] > 0 || riskRange[1] < 100 ? [{ key: 'risk', label: `Risk Range: ${riskRange[0]}-${riskRange[1]}` }] : []),
    ...(selectedCompanyCode !== 'all' ? [{ key: 'company', label: `Company: ${selectedCompanyCode}` }] : []),
    ...(showHighValue ? [{ key: 'highValue', label: 'High-Value (>$100k)' }] : []),
    ...(openItemsMin ? [{ key: 'oiMin', label: `OI Min: ${openItemsMin}` }] : []),
    ...(openItemsMax ? [{ key: 'oiMax', label: `OI Max: ${openItemsMax}` }] : []),
  ]

  const clearFilter = (key: string) => {
    switch (key) {
      case 'type': setSelectedTypes([]); break
      case 'quickRisk': setQuickRiskLevel('all'); break
      case 'risk': setRiskRange([0, 100]); break
      case 'company': setSelectedCompanyCode('all'); break
      case 'highValue': setShowHighValue(false); break
      case 'oiMin': setOpenItemsMin(''); break
      case 'oiMax': setOpenItemsMax(''); break
    }
  }

  const handleRowClick = (entity: Entity) => {
    setPreviewEntity(entity)
  }

  const handleSelectRow = (entityId: string, checked: boolean) => {
    if (checked) {
      setSelectedRows(prev => [...prev, entityId])
    } else {
      setSelectedRows(prev => prev.filter(id => id !== entityId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(paginatedEntities.map(e => e.id))
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

  // Get recent changes for preview
  const getRecentChanges = (entityId: string) => {
    return mockEntityChangeLogs
      .filter(log => log.entityId === entityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Entity Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vendor/Customer risk, change history, and linked evidence
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
              <DropdownMenuItem>All Entities</DropdownMenuItem>
              <DropdownMenuItem>High Risk Vendors</DropdownMenuItem>
              <DropdownMenuItem>Overdue Customers</DropdownMenuItem>
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

      {/* Quick Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground mr-1">Quick filters:</span>
        
        {/* Entity Type */}
        <Button
          variant={selectedTypes.includes('vendor') ? 'default' : 'outline'}
          size="sm"
          className={cn("h-7 gap-1.5", !selectedTypes.includes('vendor') && "bg-transparent")}
          onClick={() => {
            if (selectedTypes.includes('vendor')) {
              setSelectedTypes(prev => prev.filter(t => t !== 'vendor'))
            } else {
              setSelectedTypes(prev => [...prev, 'vendor'])
            }
          }}
        >
          <Building2 className="h-3.5 w-3.5" />
          Vendors
        </Button>
        <Button
          variant={selectedTypes.includes('customer') ? 'default' : 'outline'}
          size="sm"
          className={cn("h-7 gap-1.5", !selectedTypes.includes('customer') && "bg-transparent")}
          onClick={() => {
            if (selectedTypes.includes('customer')) {
              setSelectedTypes(prev => prev.filter(t => t !== 'customer'))
            } else {
              setSelectedTypes(prev => [...prev, 'customer'])
            }
          }}
        >
          <Users className="h-3.5 w-3.5" />
          Customers
        </Button>
        
        <Separator orientation="vertical" className="h-5 mx-1" />
        
        {/* Risk Level */}
        <Button
          variant={quickRiskLevel === 'critical' ? 'default' : 'outline'}
          size="sm"
          className={cn(
            "h-7 gap-1.5",
            quickRiskLevel === 'critical' 
              ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" 
              : "bg-transparent text-destructive border-destructive/30 hover:bg-destructive/10"
          )}
          onClick={() => setQuickRiskLevel(quickRiskLevel === 'critical' ? 'all' : 'critical')}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Critical ({'>'}80)
        </Button>
        <Button
          variant={quickRiskLevel === 'high' ? 'default' : 'outline'}
          size="sm"
          className={cn(
            "h-7 gap-1.5",
            quickRiskLevel === 'high'
              ? "bg-amber-500 hover:bg-amber-600 text-white"
              : "bg-transparent text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
          )}
          onClick={() => setQuickRiskLevel(quickRiskLevel === 'high' ? 'all' : 'high')}
        >
          High (51-80)
        </Button>
        <Button
          variant={quickRiskLevel === 'normal' ? 'default' : 'outline'}
          size="sm"
          className={cn("h-7", quickRiskLevel !== 'normal' && "bg-transparent")}
          onClick={() => setQuickRiskLevel(quickRiskLevel === 'normal' ? 'all' : 'normal')}
        >
          Normal ({'<'}=50)
        </Button>
        
        <Separator orientation="vertical" className="h-5 mx-1" />
        
        {/* High Value Toggle */}
        <Button
          variant={showHighValue ? 'default' : 'outline'}
          size="sm"
          className={cn("h-7 gap-1.5", !showHighValue && "bg-transparent")}
          onClick={() => setShowHighValue(!showHighValue)}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          High-Value ({'>'}$100k)
        </Button>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Row 1: Search and main filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entity ID or name..."
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2 bg-transparent">
                    <Filter className="h-4 w-4" />
                    Type
                    {selectedTypes.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">{selectedTypes.length}</Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuCheckboxItem
                    checked={selectedTypes.includes('vendor')}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedTypes(prev => [...prev, 'vendor'])
                      else setSelectedTypes(prev => prev.filter(t => t !== 'vendor'))
                    }}
                  >
                    <Building2 className="h-4 w-4 mr-2" /> Vendor
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={selectedTypes.includes('customer')}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedTypes(prev => [...prev, 'customer'])
                      else setSelectedTypes(prev => prev.filter(t => t !== 'customer'))
                    }}
                  >
                    <Users className="h-4 w-4 mr-2" /> Customer
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2 bg-transparent">
                    <Filter className="h-4 w-4" />
                    Risk Score
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Range: {riskRange[0]} - {riskRange[1]}</span>
                    </div>
                    <Slider
                      value={riskRange}
                      onValueChange={(value) => setRiskRange(value as [number, number])}
                      min={0}
                      max={100}
                      step={5}
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

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
                    setSelectedTypes([])
                    setQuickRiskLevel('all')
                    setRiskRange([0, 100])
                    setSelectedCompanyCode('all')
                    setShowHighValue(false)
                    setOpenItemsMin('')
                    setOpenItemsMax('')
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
              <span className="text-sm font-medium">{selectedRows.length} entity(s) selected</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                  <Download className="h-3.5 w-3.5" />
                  Export Selected
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRows([])}>
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content: Table + Preview */}
      <div className="flex gap-4">
        {/* Table */}
        <Card className={cn("flex-1", previewEntity && "hidden lg:block")}>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="w-10 p-3">
                      <Checkbox
                        checked={paginatedEntities.length > 0 && selectedRows.length === paginatedEntities.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    {visibleColumns.filter(c => c.visible).map(col => (
                      <th
                        key={col.id}
                        className="text-left font-medium text-muted-foreground p-3 cursor-pointer hover:bg-muted/70"
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
                  {paginatedEntities.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.filter(c => c.visible).length + 2} className="text-center py-12 text-muted-foreground">
                        No entities found matching your filters
                      </td>
                    </tr>
                  ) : (
                    paginatedEntities.map(entity => (
                      <tr
                        key={entity.id}
                        className={cn(
                          "border-b border-border hover:bg-muted/50 transition-colors cursor-pointer",
                          selectedRows.includes(entity.id) && "bg-primary/5",
                          previewEntity?.id === entity.id && "bg-primary/10"
                        )}
                        onClick={() => handleRowClick(entity)}
                      >
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedRows.includes(entity.id)}
                            onCheckedChange={(checked) => handleSelectRow(entity.id, !!checked)}
                          />
                        </td>
                        {visibleColumns.filter(c => c.visible).map(col => (
                          <td key={col.id} className="p-3">
                            {col.id === 'code' && (
                              <span className="font-mono text-xs">{entity.code}</span>
                            )}
                            {col.id === 'name' && (
                              <span className="font-medium">{entity.name}</span>
                            )}
                            {col.id === 'type' && (
                              <Badge variant="outline" className="text-xs">
                                {entity.type === 'vendor' ? <Building2 className="h-3 w-3 mr-1" /> : <Users className="h-3 w-3 mr-1" />}
                                {entity.type}
                              </Badge>
                            )}
                            {col.id === 'country' && (
                              <span className="text-xs font-mono">{countryByCompanyCode[entity.companyCode] || '-'}</span>
                            )}
                            {col.id === 'riskScore' && (
                              <RiskScoreBadge score={entity.riskScore} trend={entity.riskTrend} />
                            )}
                            {col.id === 'openItemsCount' && (
                              <span className={cn(
                                "font-medium",
                                entity.openItemsCount > 0 && "text-foreground"
                              )}>
                                {entity.openItemsCount}
                              </span>
                            )}
                            {col.id === 'recentAnomaliesCount' && (
                              <span className={cn(
                                entity.recentAnomaliesCount > 0 && "text-warning font-medium"
                              )}>
                                {entity.recentAnomaliesCount}
                              </span>
                            )}
                            {col.id === 'openItemsTotal' && (
                              <span>{formatCurrency(entity.openItemsTotal, entity.currency)}</span>
                            )}
                            {col.id === 'overdueTotal' && (
                              <span className={cn(
                                entity.overdueTotal > 0 && "text-destructive font-medium"
                              )}>
                                {formatCurrency(entity.overdueTotal, entity.currency)}
                              </span>
                            )}
                            {col.id === 'lastUpdated' && (
                              <span className="text-muted-foreground text-xs">{formatDate(entity.lastUpdated)}</span>
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
                              <DropdownMenuItem asChild>
                                <Link href={`/entities/${entity.id}`} className="flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  Open Profile
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/entities/${entity.id}?tab=changelog`} className="flex items-center gap-2">
                                  <History className="h-4 w-4" />
                                  View Change Log
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/documents?entityId=${entity.id}`} className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  View Linked Docs
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/lineage?entityId=${entity.id}`} className="flex items-center gap-2">
                                  <GitBranch className="h-4 w-4" />
                                  Open Lineage
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
                <span>Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, sortedEntities.length)} of {sortedEntities.length}</span>
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

        {/* Preview Panel */}
        {previewEntity && (
          <Card className="w-full lg:w-[380px] flex-shrink-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center",
                    previewEntity.type === 'vendor' ? "bg-primary/10" : "bg-info/10"
                  )}>
                    {previewEntity.type === 'vendor' ? (
                      <Building2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Users className="h-5 w-5 text-info" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base">{previewEntity.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{previewEntity.code}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewEntity(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Risk & Status */}
              <div className="flex items-center gap-2">
                <RiskScoreBadge score={previewEntity.riskScore} trend={previewEntity.riskTrend} />
                <ConcentrationBadge level={previewEntity.concentrationRisk} />
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Open Items</p>
                  <p className="text-lg font-semibold">{formatCurrency(previewEntity.openItemsTotal, previewEntity.currency)}</p>
                  <p className="text-xs text-muted-foreground">{previewEntity.openItemsCount} items</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className={cn("text-lg font-semibold", previewEntity.overdueTotal > 0 && "text-destructive")}>
                    {formatCurrency(previewEntity.overdueTotal, previewEntity.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">{previewEntity.overdueCount} items</p>
                </div>
              </div>

              {/* Recent Changes */}
              <div>
                <h4 className="text-sm font-medium mb-2">Recent Changes</h4>
                <div className="space-y-2">
                  {getRecentChanges(previewEntity.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No recent changes</p>
                  ) : (
                    getRecentChanges(previewEntity.id).map(log => (
                      <div key={log.id} className="flex items-start gap-2 text-xs">
                        <div className={cn(
                          "h-2 w-2 rounded-full mt-1.5 flex-shrink-0",
                          log.severity === 'critical' ? "bg-destructive" :
                          log.severity === 'warn' ? "bg-warning" : "bg-muted-foreground"
                        )} />
                        <div>
                          <p className="text-foreground">
                            <span className="font-medium">{log.fieldName}</span> changed
                          </p>
                          <p className="text-muted-foreground">{formatDate(log.timestamp)} by {log.actor}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <Separator />

              {/* Quick Links */}
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-transparent" asChild>
                  <Link href={`/entities/${previewEntity.id}`}>
                    <Eye className="h-4 w-4" />
                    View Full Profile
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-transparent" asChild>
                  <Link href={`/documents?entityId=${previewEntity.id}`}>
                    <FileText className="h-4 w-4" />
                    View Documents ({previewEntity.linkedDocIds.length})
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-transparent" asChild>
                  <Link href={`/open-items?entityId=${previewEntity.id}`}>
                    <AlertTriangle className="h-4 w-4" />
                    View Open Items ({previewEntity.linkedOpenItemIds.length})
                  </Link>
                </Button>
                {previewEntity.linkedCaseIds.length > 0 && (
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-transparent" asChild>
                    <Link href={`/cases?entityId=${previewEntity.id}`}>
                      <AlertTriangle className="h-4 w-4" />
                      View Cases ({previewEntity.linkedCaseIds.length})
                    </Link>
                  </Button>
                )}
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
            <div className="space-y-2">
              <Label>View Name</Label>
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g., High Risk Vendors"
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
