"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Layers,
} from "lucide-react"
import type { CodeGroup, Code } from "@/app/admin/codes/page"

interface CodeGroupsTabProps {
  groups: CodeGroup[]
  codes: Code[]
  onCreated: (group: CodeGroup) => void
  onUpdated: (group: CodeGroup) => void
  onDeleted: (groupId: string) => void
}

export function CodeGroupsTab({
  groups,
  codes,
  onCreated,
  onUpdated,
  onDeleted,
}: CodeGroupsTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showDisabled, setShowDisabled] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<CodeGroup | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const [formData, setFormData] = useState({
    groupKey: "",
    groupName: "",
    description: "",
    enabled: true,
    sortOrder: 1,
  })

  const filteredGroups = groups.filter(group => {
    const matchesSearch = !searchQuery ||
      group.groupKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.groupName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesEnabled = showDisabled || group.enabled
    return matchesSearch && matchesEnabled
  })

  const openCreateDialog = () => {
    setIsCreating(true)
    setSelectedGroup(null)
    setFormData({
      groupKey: "",
      groupName: "",
      description: "",
      enabled: true,
      sortOrder: groups.length + 1,
    })
    setEditDialogOpen(true)
  }

  const openEditDialog = (group: CodeGroup) => {
    setIsCreating(false)
    setSelectedGroup(group)
    setFormData({
      groupKey: group.groupKey,
      groupName: group.groupName,
      description: group.description || "",
      enabled: group.enabled,
      sortOrder: group.sortOrder,
    })
    setEditDialogOpen(true)
  }

  const handleSave = () => {
    if (isCreating) {
      const newGroup: CodeGroup = {
        id: `new-${Date.now()}`,
        groupKey: formData.groupKey,
        groupName: formData.groupName,
        description: formData.description || null,
        enabled: formData.enabled,
        sortOrder: formData.sortOrder,
        codesCount: 0,
        updatedAt: new Date().toISOString(),
      }
      onCreated(newGroup)
    } else if (selectedGroup) {
      onUpdated({
        ...selectedGroup,
        groupKey: formData.groupKey,
        groupName: formData.groupName,
        description: formData.description || null,
        enabled: formData.enabled,
        sortOrder: formData.sortOrder,
        updatedAt: new Date().toISOString(),
      })
    }
    setEditDialogOpen(false)
  }

  const openDeleteDialog = (group: CodeGroup) => {
    setSelectedGroup(group)
    setDeleteDialogOpen(true)
  }

  const handleDelete = () => {
    if (selectedGroup) {
      onDeleted(selectedGroup.id)
    }
    setDeleteDialogOpen(false)
  }

  const getCodesCount = (groupKey: string) => {
    return codes.filter(c => c.groupKey === groupKey).length
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="그룹 키 또는 이름 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-disabled-groups"
              checked={showDisabled}
              onCheckedChange={setShowDisabled}
            />
            <Label htmlFor="show-disabled-groups" className="text-sm text-muted-foreground whitespace-nowrap">
              비활성 표시
            </Label>
          </div>
        </div>
        <Button onClick={openCreateDialog} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          새 그룹
        </Button>
      </div>

      {/* Table - Desktop */}
      <div className="flex-1 border border-border rounded-lg overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-48">그룹 키</TableHead>
                <TableHead>그룹 이름</TableHead>
                <TableHead className="w-24 text-center">코드 수</TableHead>
                <TableHead className="w-24 text-center">상태</TableHead>
                <TableHead className="w-20 text-center">순서</TableHead>
                <TableHead className="w-40">수정일</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Layers className="h-8 w-8 mb-2 opacity-50" />
                      <p>코드 그룹이 없습니다.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group) => (
                  <TableRow
                    key={group.id}
                    className={!group.enabled ? "opacity-60" : ""}
                  >
                    <TableCell className="font-mono text-sm">{group.groupKey}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{group.groupName}</span>
                        {group.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {group.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{getCodesCount(group.groupKey)}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={group.enabled ? "default" : "outline"}>
                        {group.enabled ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {group.sortOrder}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(group.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(group)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            편집
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            onUpdated({ ...group, enabled: !group.enabled, updatedAt: new Date().toISOString() })
                          }}>
                            {group.enabled ? (
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
                            onClick={() => openDeleteDialog(group)}
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
        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Layers className="h-8 w-8 mb-2 opacity-50" />
            <p>코드 그룹이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                className={`border border-border rounded-lg p-4 bg-card ${!group.enabled ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{group.groupKey}</span>
                      <Badge variant="secondary" className="shrink-0">{getCodesCount(group.groupKey)}</Badge>
                    </div>
                    <p className="font-medium">{group.groupName}</p>
                    {group.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(group)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        편집
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        onUpdated({ ...group, enabled: !group.enabled, updatedAt: new Date().toISOString() })
                      }}>
                        {group.enabled ? (
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
                        onClick={() => openDeleteDialog(group)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Badge variant={group.enabled ? "default" : "outline"} className="text-[10px]">
                    {group.enabled ? "활성" : "비활성"}
                  </Badge>
                  <span>순서: {group.sortOrder} · {formatDate(group.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isCreating ? "새 코드 그룹" : "코드 그룹 편집"}</DialogTitle>
            <DialogDescription>
              {isCreating
                ? "새로운 코드 그룹을 생성합니다."
                : "코드 그룹 정보를 수정합니다."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupKey">그룹 키 *</Label>
              <Input
                id="groupKey"
                value={formData.groupKey}
                onChange={(e) => setFormData(prev => ({ ...prev, groupKey: e.target.value }))}
                placeholder="USER_STATUS"
                disabled={!isCreating}
              />
              {!isCreating && (
                <p className="text-xs text-muted-foreground">그룹 키는 생성 후 변경할 수 없습니다.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="groupName">그룹 이름 *</Label>
              <Input
                id="groupName"
                value={formData.groupName}
                onChange={(e) => setFormData(prev => ({ ...prev, groupName: e.target.value }))}
                placeholder="사용자 상태"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="이 코드 그룹에 대한 설명을 입력하세요"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sortOrder">정렬 순서</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 1 }))}
                  min={1}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="enabled">활성화</Label>
                <Switch
                  id="enabled"
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
            <Button onClick={handleSave} disabled={!formData.groupKey || !formData.groupName}>
              {isCreating ? "생성" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>코드 그룹을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedGroup && getCodesCount(selectedGroup.groupKey) > 0 ? (
                <span className="text-destructive">
                  이 그룹에는 {getCodesCount(selectedGroup.groupKey)}개의 코드가 있습니다.
                  먼저 하위 코드를 삭제해주세요.
                </span>
              ) : (
                <>
                  <strong>{selectedGroup?.groupName}</strong> ({selectedGroup?.groupKey}) 그룹이 영구적으로 삭제됩니다.
                  이 작업은 되돌릴 수 없습니다.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={selectedGroup ? getCodesCount(selectedGroup.groupKey) > 0 : false}
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
