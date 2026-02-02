"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  Search,
  Filter,
  History,
  User,
  Bot,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Zap,
  Database,
  ExternalLink
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { mockAuditEvents } from "@/lib/mock-data"

// Extended mock audit data
const extendedAuditEvents = [
  ...mockAuditEvents,
  {
    id: 'audit-006',
    timestamp: '2026-01-29T11:30:00Z',
    actor: 'AI Agent',
    actorType: 'system' as const,
    eventType: 'action_executed',
    description: 'Auto-executed low-risk clear item action',
    details: { actionId: 'ACT-002', outcome: 'success', targetSystem: 'SAP' },
    severity: 'info'
  },
  {
    id: 'audit-007',
    timestamp: '2026-01-29T10:45:00Z',
    actor: 'Sarah Chen',
    actorType: 'user' as const,
    eventType: 'case_assigned',
    description: 'Case assigned to analyst for review',
    details: { caseId: 'case-002', assignee: 'Sarah Chen', previousAssignee: 'Unassigned' },
    severity: 'info'
  },
  {
    id: 'audit-008',
    timestamp: '2026-01-29T09:20:00Z',
    actor: 'System',
    actorType: 'system' as const,
    eventType: 'guardrail_triggered',
    description: 'Guardrail blocked auto-execution due to high risk',
    details: { actionId: 'ACT-003', guardrail: 'CFO_APPROVAL_REQUIRED', threshold: 1000000 },
    severity: 'warning'
  },
  {
    id: 'audit-009',
    timestamp: '2026-01-29T08:15:00Z',
    actor: 'John Smith',
    actorType: 'user' as const,
    eventType: 'action_rejected',
    description: 'Rejected payment block action with comment',
    details: { actionId: 'ACT-004', reason: 'False positive - verified vendor' },
    severity: 'warning'
  },
  {
    id: 'audit-010',
    timestamp: '2026-01-28T16:30:00Z',
    actor: 'AI Risk Engine',
    actorType: 'system' as const,
    eventType: 'anomaly_detected',
    description: 'New anomaly detected: Bank account change before payment',
    details: { caseId: 'case-001', anomalyType: 'bank_change', confidence: 0.94 },
    severity: 'critical'
  },
  {
    id: 'audit-011',
    timestamp: '2026-01-28T15:00:00Z',
    actor: 'Admin',
    actorType: 'user' as const,
    eventType: 'policy_updated',
    description: 'Updated guardrail threshold for CFO approval',
    details: { policy: 'CFO_APPROVAL', oldThreshold: 500000, newThreshold: 1000000 },
    severity: 'info'
  },
  {
    id: 'audit-012',
    timestamp: '2026-01-28T14:20:00Z',
    actor: 'System',
    actorType: 'system' as const,
    eventType: 'simulation_completed',
    description: 'Pre-execution simulation completed for reversal action',
    details: { actionId: 'ACT-001', simResult: 'passed', warnings: 0 },
    severity: 'info'
  },
]

const eventTypes = [
  { value: 'action_approved', label: 'Action Approved' },
  { value: 'action_rejected', label: 'Action Rejected' },
  { value: 'action_executed', label: 'Action Executed' },
  { value: 'case_assigned', label: 'Case Assigned' },
  { value: 'guardrail_triggered', label: 'Guardrail Triggered' },
  { value: 'anomaly_detected', label: 'Anomaly Detected' },
  { value: 'policy_updated', label: 'Policy Updated' },
  { value: 'simulation_completed', label: 'Simulation Completed' },
]

const actorTypes = [
  { value: 'user', label: 'Human User' },
  { value: 'system', label: 'AI/System' },
]

export default function AuditPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([])
  const [selectedActorTypes, setSelectedActorTypes] = useState<string[]>([])
  const [timeRange, setTimeRange] = useState("all")
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)

  const filteredEvents = useMemo(() => {
    return extendedAuditEvents.filter(event => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!event.description.toLowerCase().includes(query) &&
            !event.actor.toLowerCase().includes(query) &&
            !event.id.toLowerCase().includes(query)) {
          return false
        }
      }

      // Event type filter
      if (selectedEventTypes.length > 0 && !selectedEventTypes.includes(event.eventType)) {
        return false
      }

      // Actor type filter
      if (selectedActorTypes.length > 0 && !selectedActorTypes.includes(event.actorType)) {
        return false
      }

      return true
    })
  }, [searchQuery, selectedEventTypes, selectedActorTypes])

  const getEventIcon = (eventType: string, severity: string) => {
    switch (eventType) {
      case 'action_approved':
        return <CheckCircle2 className="h-4 w-4 text-success" />
      case 'action_rejected':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'action_executed':
        return <Zap className="h-4 w-4 text-primary" />
      case 'guardrail_triggered':
        return <Shield className="h-4 w-4 text-warning" />
      case 'anomaly_detected':
        return <AlertTriangle className="h-4 w-4 text-destructive" />
      case 'policy_updated':
        return <FileText className="h-4 w-4 text-info" />
      case 'simulation_completed':
        return <Database className="h-4 w-4 text-muted-foreground" />
      default:
        return <History className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getActorIcon = (actorType: string) => {
    return actorType === 'user' 
      ? <User className="h-3.5 w-3.5" /> 
      : <Bot className="h-3.5 w-3.5" />
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-destructive/10 border-destructive/30'
      case 'warning':
        return 'bg-warning/10 border-warning/30'
      default:
        return 'bg-card'
    }
  }

  const todayCount = extendedAuditEvents.filter(e => 
    new Date(e.timestamp).toDateString() === new Date().toDateString()
  ).length
  const userActionsCount = extendedAuditEvents.filter(e => e.actorType === 'user').length
  const systemActionsCount = extendedAuditEvents.filter(e => e.actorType === 'system').length

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete audit history of all system activities and decisions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <p className="text-3xl font-bold">{extendedAuditEvents.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <History className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">User Actions</p>
                <p className="text-3xl font-bold text-info">{userActionsCount}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-info/10 flex items-center justify-center">
                <User className="h-6 w-6 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">System Actions</p>
                <p className="text-3xl font-bold text-success">{systemActionsCount}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <Bot className="h-6 w-6 text-success" />
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
                placeholder="Search audit trail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Event Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 bg-transparent">
                  <Filter className="h-3.5 w-3.5" />
                  Event Type
                  {selectedEventTypes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {selectedEventTypes.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {eventTypes.map(type => (
                  <DropdownMenuCheckboxItem
                    key={type.value}
                    checked={selectedEventTypes.includes(type.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedEventTypes([...selectedEventTypes, type.value])
                      } else {
                        setSelectedEventTypes(selectedEventTypes.filter(t => t !== type.value))
                      }
                    }}
                  >
                    {type.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Actor Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 bg-transparent">
                  <Filter className="h-3.5 w-3.5" />
                  Actor Type
                  {selectedActorTypes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {selectedActorTypes.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {actorTypes.map(type => (
                  <DropdownMenuCheckboxItem
                    key={type.value}
                    checked={selectedActorTypes.includes(type.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedActorTypes([...selectedActorTypes, type.value])
                      } else {
                        setSelectedActorTypes(selectedActorTypes.filter(t => t !== type.value))
                      }
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {type.value === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      {type.label}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Time Range */}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[150px] h-9">
                <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Audit Events</CardTitle>
          <CardDescription>
            {filteredEvents.length} events matching your filters
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <div className="divide-y divide-border">
              {filteredEvents.map((event) => (
                <div 
                  key={event.id}
                  className={cn(
                    "p-4 transition-colors cursor-pointer hover:bg-muted/50",
                    getSeverityColor(event.severity),
                    expandedEvent === event.id && "bg-muted/30"
                  )}
                  onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Event Icon */}
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      event.severity === 'critical' ? "bg-destructive/20" :
                      event.severity === 'warning' ? "bg-warning/20" :
                      "bg-muted"
                    )}>
                      {getEventIcon(event.eventType, event.severity)}
                    </div>

                    {/* Event Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {event.description}
                        </span>
                        {event.severity === 'critical' && (
                          <Badge variant="destructive" className="text-[10px]">Critical</Badge>
                        )}
                        {event.severity === 'warning' && (
                          <Badge variant="outline" className="text-[10px] border-warning text-warning">Warning</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {getActorIcon(event.actorType)}
                          {event.actor}
                        </span>
                        <span>|</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                        <span>|</span>
                        <span className="capitalize">{event.eventType.replace(/_/g, ' ')}</span>
                      </div>

                      {/* Expanded Details */}
                      {expandedEvent === event.id && event.details && (
                        <div className="mt-3 p-3 bg-background/50 rounded-lg">
                          <div className="text-xs font-medium text-muted-foreground mb-2">Event Details</div>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(event.details).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                <span className="text-xs font-mono font-medium">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expand Icon */}
                    <ChevronRight className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
                      expandedEvent === event.id && "rotate-90"
                    )} />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
