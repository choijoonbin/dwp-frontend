"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Tag,
  AlertTriangle,
  Globe,
  Building2,
} from "lucide-react"
import type { CodeGroup, Code } from "@/app/admin/codes/page"

interface CodesTabProps {
  groups: CodeGroup[]
  codes: Code[]
  onCreated: (code: Code) => void
  onUpdated: (code: Code) => void
  onDeleted: (codeId: string) => void
}

export function CodesTab({
  groups,
  codes,
  onCreated,
  onUpdated,
  onDeleted,
}: CodesTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [groupFilter, setGroupFilter] = useState<string>("all")
  const [scopeFilter, setScopeFilter] = useState<string>("all")
  const [showDisabled, setShowDisabled] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCode, setSelectedCode] = useState<Code | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const [formData, setFormData] = useState({
    groupKey: "",
    code: "",
    name: "",
    sortOrder: 1,
    enabled: true,
    tenantScope: "COMMON" as "COMMON" | "TENANT",
  })

  const filteredCodes = codes.filter(code => {
    const matchesSearch = !searchQuery ||
      code.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesGroup = groupFilter === "all" || code.groupKey === groupFilter
    const matchesScope = scopeFilter === "all" || code.tenantScope === scopeFilter
    const matchesEnabled = showDisabled || code.enabled
    return matchesSearch && matchesGroup && matchesScope && matchesEnabled
  })

  const openCreateDialog = () => {
    setIsCreating(true)
    setSelectedCode(null)
    setFormData({
      groupKey: groupFilter !== "all" ? groupFilter : "",
      code: "",
      name: "",
      sortOrder: 1,
      enabled: true,
      tenantScope: "COMMON",
    })
    setEditDialogOpen(true)
  }

  const openEditDialog = (code: Code) => {
    setIsCreating(false)
    setSelectedCode(code)
    setFormData({
      groupKey: code.groupKey,
      code: code.code,
      name: code.name,
      sortOrder: code.sortOrder,
      enabled: code.enabled,
      tenantScope: code.tenantScope,
    })
    setEditDialogOpen(true)
  }

  const handleSave = () => {
    if (isCreating) {
      const newCode: Code = {
        id: `new-${Date.now()}`,
        groupKey: formData.groupKey,
        code: formData.code,
        name: formData.name,
        sortOrder: formData.sortOrder,
        enabled: formData.enabled,
        tenantScope: formData.tenantScope,
      }
      onCreated(newCode)
    } else if (selectedCode) {
      onUpdated({
        ...selectedCode,
        groupKey: formData.groupKey,
        code: formData.code,
        name: formData.name,
        sortOrder: formData.sortOrder,
        enabled: formData.enabled,
        tenantScope: formData.tenantScope,
      })
    }
    setEditDialogOpen(false)
  }

  const openDeleteDialog = (code: Code) => {
    setSelectedCode(code)
    setDeleteDialogOpen(true)
  }

  const handleDelete = () => {
    if (selectedCode) {
      onDeleted(selectedCode.id)
    }
    setDeleteDialogOpen(false)
  }

  const getGroupName = (groupKey: string) => {
    return groups.find(g => g.groupKey === groupKey)?.groupName || groupKey
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="코드 또는 이름 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="그룹 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 그룹</SelectItem>
              {groups.map(group => (
                <SelectItem key={group.groupKey} value={group.groupKey}>
                  {group.groupName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="범위 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="COMMON">COMMON</SelectItem>
              <SelectItem value="TENANT">TENANT</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch
              id="show-disabled-codes"
              checked={showDisabled}
              onCheckedChange={setShowDisabled}
            />
            <Label htmlFor="show-disabled-codes" className="text-sm text-muted-foreground whitespace-nowrap">
              비활성 표시
            </Label>
          </div>
        </div>

        {/* Actions */}
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          새 코드
        </Button>
      </div>

      {/* Table - Desktop */}
      <div className="flex-1 border border-border rounded-lg overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-40">그룹</TableHead>
                <TableHead className="w-32">코드</TableHead>
                <TableHead>이름</TableHead>
                <TableHead className="w-28 text-center">범위</TableHead>
                <TableHead className="w-24 text-center">상태</TableHead>
                <TableHead className="w-20 text-center">순서</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Tag className="h-8 w-8 mb-2 opacity-50" />
                      <p>코드가 없습니다.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCodes.map((code) => (
                  <TableRow
                    key={code.id}
                    className={!code.enabled ? "opacity-60" : ""}
                  >
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {code.groupKey}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {code.code}
                    </TableCell>
                    <TableCell>{code.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={code.tenantScope === "COMMON" ? "default" : "secondary"}
                        className="gap-1"
                      >
                        {code.tenantScope === "COMMON" ? (
                          <Globe className="h-3 w-3" />
                        ) : (
                          <Building2 className="h-3 w-3" />
                        )}
                        {code.tenantScope}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={code.enabled ? "default" : "outline"}>
                        {code.enabled ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {code.sortOrder}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(code)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            편집
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            onUpdated({ ...code, enabled: !code.enabled })
                          }}>
                            {code.enabled ? (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" />
                                비활성화
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                활성화
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(code)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="flex-1 overflow-auto md:hidden">
        {filteredCodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Tag className="h-8 w-8 mb-2 opacity-50" />
            <p>코드가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCodes.map((code) => (
              <div
                key={code.id}
                className={`border border-border rounded-lg p-4 bg-card ${!code.enabled ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{code.code}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {code.groupKey}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{code.name}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(code)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        편집
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        onUpdated({ ...code, enabled: !code.enabled })
                      }}>
                        {code.enabled ? (
                          <>
                            <EyeOff className="mr-2 h-4 w-4" />
                            비활성화
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" />
                            활성화
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(code)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={code.tenantScope === "COMMON" ? "default" : "secondary"}
                    className="gap-1"
                  >
                    {code.tenantScope === "COMMON" ? (
                      <Globe className="h-3 w-3" />
                    ) : (
                      <Building2 className="h-3 w-3" />
                    )}
                    {code.tenantScope}
                  </Badge>
                  <Badge variant={code.enabled ? "default" : "outline"}>
                    {code.enabled ? "활성" : "비활성"}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">순서: {code.sortOrder}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          총 {filteredCodes.length}개 / 전체 {codes.length}개
        </span>
        <span>
          COMMON: {codes.filter(c => c.tenantScope === "COMMON").length}개 · 
          TENANT: {codes.filter(c => c.tenantScope === "TENANT").length}개
        </span>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isCreating ? "새 코드" : "코드 편집"}</DialogTitle>
            <DialogDescription>
              {isCreating
                ? "새로운 코드를 생성합니다."
                : "코드 정보를 수정합니다."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code-groupKey">그룹 *</Label>
              <Select
                value={formData.groupKey}
                onValueChange={(value) => setFormData(prev => ({ ...prev, groupKey: value }))}
                disabled={!isCreating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="그룹 선택" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(group => (
                    <SelectItem key={group.groupKey} value={group.groupKey}>
                      {group.groupName} ({group.groupKey})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code-code">코드 *</Label>
                <Input
                  id="code-code"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="ACTIVE"
                  disabled={!isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code-name">이름 *</Label>
                <Input
                  id="code-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="활성"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code-tenantScope">범위 *</Label>
              <Select
                value={formData.tenantScope}
                onValueChange={(value) => setFormData(prev => ({ ...prev, tenantScope: value as "COMMON" | "TENANT" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMMON">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      COMMON - 모든 테넌트 공통
                    </div>
                  </SelectItem>
                  <SelectItem value="TENANT">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      TENANT - 현재 테넌트 전용
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.tenantScope === "COMMON" && (
              <Alert className="border-amber-500/30 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-sm text-amber-500">
                  COMMON 코드 변경은 모든 테넌트에 영향을 미칩니다.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code-sortOrder">정렬 순서</Label>
                <Input
                  id="code-sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 1 }))}
                  min={1}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="code-enabled">활성화</Label>
                <Switch
                  id="code-enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.groupKey || !formData.code || !formData.name}
            >
              {isCreating ? "생성" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>코드를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedCode?.name}</strong> ({selectedCode?.code}) 코드가 영구적으로 삭제됩니다.
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
