"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { AuditLogDetailDrawer } from "@/components/admin/audit-logs/audit-log-detail-drawer"
import {
  Download,
  Search,
  RotateCcw,
  Calendar,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Types
export interface AuditLog {
  id: string
  timestamp: string
  actorUserId: string
  actorName: string
  actorEmail: string
  actionType: "CREATE" | "UPDATE" | "DELETE" | "REORDER"
  targetType: "USER" | "ROLE" | "RESOURCE" | "MENU" | "CODE" | "USAGE"
  targetId: string
  resourceKey: string | null
  keyword: string
  beforeJson: string | null
  afterJson: string | null
  truncated: boolean
  traceId: string
}

// Mock Data
const mockAuditLogs: AuditLog[] = [
  {
    id: "log1",
    timestamp: "2025-01-21T10:30:15Z",
    actorUserId: "user-1",
    actorName: "관리자",
    actorEmail: "admin@dwp.com",
    actionType: "CREATE",
    targetType: "MENU",
    targetId: "menu-123",
    resourceKey: "menu.admin.monitoring",
    keyword: "메뉴 생성 모니터링",
    beforeJson: null,
    afterJson: JSON.stringify({
      menuKey: "menu.admin.monitoring",
      menuName: "모니터링",
      routePath: "/admin/monitoring",
      enabled: true,
      sortOrder: 5,
    }, null, 2),
    truncated: false,
    traceId: "trace-abc-123",
  },
  {
    id: "log2",
    timestamp: "2025-01-21T09:45:22Z",
    actorUserId: "user-1",
    actorName: "관리자",
    actorEmail: "admin@dwp.com",
    actionType: "UPDATE",
    targetType: "CODE",
    targetId: "code-456",
    resourceKey: "USER_STATUS",
    keyword: "코드 수정 ACTIVE",
    beforeJson: JSON.stringify({
      code: "ACTIVE",
      name: "활성",
      enabled: true,
      sortOrder: 1,
    }, null, 2),
    afterJson: JSON.stringify({
      code: "ACTIVE",
      name: "활성 상태",
      enabled: true,
      sortOrder: 1,
    }, null, 2),
    truncated: false,
    traceId: "trace-def-456",
  },
  {
    id: "log3",
    timestamp: "2025-01-21T09:12:08Z",
    actorUserId: "user-2",
    actorName: "시스템",
    actorEmail: "system@dwp.com",
    actionType: "DELETE",
    targetType: "USAGE",
    targetId: "usage-789",
    resourceKey: "menu.admin.users",
    keyword: "매핑 삭제 USER_TYPE",
    beforeJson: JSON.stringify({
      resourceKey: "menu.admin.users",
      groupKey: "USER_TYPE",
      enabled: true,
    }, null, 2),
    afterJson: null,
    truncated: false,
    traceId: "trace-ghi-789",
  },
  {
    id: "log4",
    timestamp: "2025-01-20T16:30:00Z",
    actorUserId: "user-1",
    actorName: "관리자",
    actorEmail: "admin@dwp.com",
    actionType: "REORDER",
    targetType: "MENU",
    targetId: "menu-list",
    resourceKey: "menu.admin",
    keyword: "메뉴 정렬 변경",
    beforeJson: JSON.stringify([
      { menuKey: "menu.admin.users", sortOrder: 1 },
      { menuKey: "menu.admin.roles", sortOrder: 2 },
      { menuKey: "menu.admin.menus", sortOrder: 3 },
    ], null, 2),
    afterJson: JSON.stringify([
      { menuKey: "menu.admin.roles", sortOrder: 1 },
      { menuKey: "menu.admin.users", sortOrder: 2 },
      { menuKey: "menu.admin.menus", sortOrder: 3 },
    ], null, 2),
    truncated: false,
    traceId: "trace-jkl-012",
  },
  {
    id: "log5",
    timestamp: "2025-01-20T14:22:45Z",
    actorUserId: "user-3",
    actorName: "김철수",
    actorEmail: "kim@dwp.com",
    actionType: "UPDATE",
    targetType: "USER",
    targetId: "user-555",
    resourceKey: null,
    keyword: "사용자 정보 수정",
    beforeJson: JSON.stringify({
      name: "홍길동",
      email: "hong@dwp.com",
      status: "ACTIVE",
      department: "개발팀",
      roles: ["USER"],
    }, null, 2),
    afterJson: JSON.stringify({
      name: "홍길동",
      email: "hong@dwp.com",
      status: "ACTIVE",
      department: "영업팀",
      roles: ["USER", "MANAGER"],
    }, null, 2),
    truncated: true,
    traceId: "trace-mno-345",
  },
  {
    id: "log6",
    timestamp: "2025-01-20T11:05:33Z",
    actorUserId: "user-1",
    actorName: "관리자",
    actorEmail: "admin@dwp.com",
    actionType: "CREATE",
    targetType: "ROLE",
    targetId: "role-new",
    resourceKey: "ROLE.MANAGER",
    keyword: "역할 생성 매니저",
    beforeJson: null,
    afterJson: JSON.stringify({
      roleKey: "MANAGER",
      roleName: "매니저",
      permissions: ["READ", "WRITE"],
      enabled: true,
    }, null, 2),
    truncated: false,
    traceId: "trace-pqr-678",
  },
]

const actionTypeOptions = [
  { value: "all", label: "전체" },
  { value: "CREATE", label: "CREATE" },
  { value: "UPDATE", label: "UPDATE" },
  { value: "DELETE", label: "DELETE" },
  { value: "REORDER", label: "REORDER" },
]

const targetTypeOptions = [
  { value: "all", label: "전체" },
  { value: "USER", label: "USER" },
  { value: "ROLE", label: "ROLE" },
  { value: "RESOURCE", label: "RESOURCE" },
  { value: "MENU", label: "MENU" },
  { value: "CODE", label: "CODE" },
  { value: "USAGE", label: "USAGE" },
]

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>(mockAuditLogs)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Filters
  const [dateFrom, setDateFrom] = useState("2025-01-20")
  const [dateTo, setDateTo] = useState("2025-01-21")
  const [actorFilter, setActorFilter] = useState("")
  const [actionTypeFilter, setActionTypeFilter] = useState("all")
  const [targetTypeFilter, setTargetTypeFilter] = useState("all")
  const [keyword, setKeyword] = useState("")

  const filteredLogs = logs.filter(log => {
    const matchesDateFrom = new Date(log.timestamp) >= new Date(dateFrom)
    const matchesDateTo = new Date(log.timestamp) <= new Date(dateTo + "T23:59:59Z")
    const matchesActor = !actorFilter || 
      log.actorName.toLowerCase().includes(actorFilter.toLowerCase()) ||
      log.actorEmail.toLowerCase().includes(actorFilter.toLowerCase())
    const matchesActionType = actionTypeFilter === "all" || log.actionType === actionTypeFilter
    const matchesTargetType = targetTypeFilter === "all" || log.targetType === targetTypeFilter
    const matchesKeyword = !keyword ||
      log.keyword.toLowerCase().includes(keyword.toLowerCase()) ||
      log.resourceKey?.toLowerCase().includes(keyword.toLowerCase()) ||
      log.targetId.toLowerCase().includes(keyword.toLowerCase())

    return matchesDateFrom && matchesDateTo && matchesActor && matchesActionType && matchesTargetType && matchesKeyword
  })

  const handleSearch = () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
    }, 500)
  }

  const handleReset = () => {
    setDateFrom("2025-01-20")
    setDateTo("2025-01-21")
    setActorFilter("")
    setActionTypeFilter("all")
    setTargetTypeFilter("all")
    setKeyword("")
  }

  const handleExport = () => {
    setIsExporting(true)
    // Simulate export
    setTimeout(() => {
      setIsExporting(false)
      // Show success toast would go here
    }, 2000)
  }

  const handleRowClick = (log: AuditLog) => {
    setSelectedLog(log)
    setDrawerOpen(true)
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const getActionTypeBadge = (actionType: string) => {
    const styles: Record<string, string> = {
      CREATE: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
      UPDATE: "bg-blue-500/10 text-blue-500 border-blue-500/30",
      DELETE: "bg-red-500/10 text-red-500 border-red-500/30",
      REORDER: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    }
    return (
      <Badge variant="outline" className={cn("text-xs", styles[actionType])}>
        {actionType}
      </Badge>
    )
  }

  const getTargetTypeBadge = (targetType: string) => {
    return (
      <Badge variant="secondary" className="text-xs">
        {targetType}
      </Badge>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-background">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>총 {filteredLogs.length}건</span>
          </div>
          <Button
            onClick={handleExport}
            variant="outline"
            className="gap-2 bg-transparent"
            disabled={isExporting || filteredLogs.length === 0}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            엑셀 다운로드
          </Button>
        </div>

        {/* Filter Bar */}
        <Card className="mx-4 mt-4 border-border">
          <CardContent className="p-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {/* Date From */}
              <div className="space-y-2">
                <Label htmlFor="dateFrom" className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  시작일 *
                </Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <Label htmlFor="dateTo" className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  종료일 *
                </Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Actor Filter */}
              <div className="space-y-2">
                <Label htmlFor="actor" className="text-xs text-muted-foreground">
                  수행자
                </Label>
                <Input
                  id="actor"
                  placeholder="이름 또는 이메일"
                  value={actorFilter}
                  onChange={(e) => setActorFilter(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Action Type */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  액션 유형
                </Label>
                <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Type */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  대상 유형
                </Label>
                <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {targetTypeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Keyword */}
              <div className="space-y-2">
                <Label htmlFor="keyword" className="text-xs text-muted-foreground">
                  키워드
                </Label>
                <Input
                  id="keyword"
                  placeholder="검색어 입력"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-1 bg-transparent">
                <RotateCcw className="h-3.5 w-3.5" />
                초기화
              </Button>
              <Button size="sm" onClick={handleSearch} className="gap-1" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                검색
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table - Desktop */}
        <div className="flex-1 overflow-auto p-4 hidden md:block">
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-44">시간</TableHead>
                    <TableHead className="w-32">수행자</TableHead>
                    <TableHead className="w-24">액션</TableHead>
                    <TableHead className="w-24">대상</TableHead>
                    <TableHead className="w-48">리소스 키</TableHead>
                    <TableHead>요약</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Loader2 className="h-8 w-8 animate-spin mb-2" />
                          <p>로딩 중...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <FileText className="h-8 w-8 mb-2 opacity-50" />
                          <p>검색 결과가 없습니다.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleRowClick(log)}
                      >
                        <TableCell className="text-sm text-muted-foreground font-mono">
                          {formatTimestamp(log.timestamp)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {log.actorName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{log.actorName}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getActionTypeBadge(log.actionType)}</TableCell>
                        <TableCell>{getTargetTypeBadge(log.targetType)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-48">
                          {log.resourceKey || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm truncate">{log.keyword}</span>
                            {log.truncated && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/30 text-amber-500">
                                truncated
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="flex-1 overflow-auto p-4 md:hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p>로딩 중...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p>검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <Card
                  key={log.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(log)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
                          {log.actorName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{log.actorName}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {formatTimestamp(log.timestamp)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {getActionTypeBadge(log.actionType)}
                        {getTargetTypeBadge(log.targetType)}
                      </div>
                    </div>
                    <p className="text-sm mb-2">{log.keyword}</p>
                    {log.resourceKey && (
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {log.resourceKey}
                      </p>
                    )}
                    {log.truncated && (
                      <Badge variant="outline" className="mt-2 text-[10px] px-1 py-0 h-4 border-amber-500/30 text-amber-500">
                        truncated
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Detail Drawer */}
        <AuditLogDetailDrawer
          log={selectedLog}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      </div>
  )
}
