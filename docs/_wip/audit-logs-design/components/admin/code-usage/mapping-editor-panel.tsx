"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Link2, Layers, Info, Menu, Layout } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Resource, CodeUsage, CodeGroup } from "@/app/admin/code-usage/page"

interface MappingEditorPanelProps {
  resource: Resource | null
  mappings: CodeUsage[]
  availableGroups: CodeGroup[]
  onMappingCreated: (usage: CodeUsage) => void
  onMappingUpdated: (usage: CodeUsage) => void
  onMappingDeleted: (usageId: string, resourceKey: string) => void
}

export function MappingEditorPanel({
  resource,
  mappings,
  availableGroups,
  onMappingCreated,
  onMappingUpdated,
  onMappingDeleted,
}: MappingEditorPanelProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedMapping, setSelectedMapping] = useState<CodeUsage | null>(null)
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>("")

  if (!resource) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <Link2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">리소스를 선택하세요</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          왼쪽 패널에서 리소스를 선택하면 해당 리소스에 매핑된 코드 그룹을 관리할 수 있습니다.
        </p>
      </div>
    )
  }

  const handleAddMapping = () => {
    if (!selectedGroupKey || !resource) return

    const group = availableGroups.find(g => g.groupKey === selectedGroupKey)
    if (!group) return

    const newUsage: CodeUsage = {
      id: `new-${Date.now()}`,
      resourceKey: resource.resourceKey,
      groupKey: group.groupKey,
      groupName: group.groupName,
      enabled: true,
      codesCount: group.codesCount,
    }

    onMappingCreated(newUsage)
    setAddDialogOpen(false)
    setSelectedGroupKey("")
  }

  const handleToggleEnabled = (mapping: CodeUsage) => {
    onMappingUpdated({ ...mapping, enabled: !mapping.enabled })
  }

  const openDeleteDialog = (mapping: CodeUsage) => {
    setSelectedMapping(mapping)
    setDeleteDialogOpen(true)
  }

  const handleDelete = () => {
    if (selectedMapping && resource) {
      onMappingDeleted(selectedMapping.id, resource.resourceKey)
    }
    setDeleteDialogOpen(false)
    setSelectedMapping(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              resource.resourceType === "MENU" 
                ? "bg-blue-500/10 text-blue-500"
                : "bg-amber-500/10 text-amber-500"
            )}>
              {resource.resourceType === "MENU" ? (
                <Menu className="h-5 w-5" />
              ) : (
                <Layout className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{resource.resourceName}</h2>
              <p className="text-sm text-muted-foreground font-mono">{resource.resourceKey}</p>
            </div>
          </div>
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            그룹 추가
          </Button>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            이 리소스(메뉴)에서 사용할 코드 그룹을 매핑합니다. 
            활성화된 그룹만 해당 화면의 드롭다운에 표시됩니다.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {mappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Layers className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-2">매핑된 그룹이 없습니다</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              이 리소스에 코드 그룹을 매핑하면 해당 화면의 드롭다운에서 사용할 수 있습니다.
            </p>
            <Button onClick={() => setAddDialogOpen(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              첫 번째 그룹 추가
            </Button>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-40">그룹 키</TableHead>
                  <TableHead>그룹 이름</TableHead>
                  <TableHead className="w-24 text-center">코드 수</TableHead>
                  <TableHead className="w-24 text-center">활성화</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id} className={!mapping.enabled ? "opacity-60" : ""}>
                    <TableCell className="font-mono text-sm">
                      {mapping.groupKey}
                    </TableCell>
                    <TableCell className="font-medium">
                      {mapping.groupName}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{mapping.codesCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={mapping.enabled}
                        onCheckedChange={() => handleToggleEnabled(mapping)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(mapping)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Stats */}
      {mappings.length > 0 && (
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>매핑된 그룹: {mappings.length}개</span>
            <span>활성: {mappings.filter(m => m.enabled).length}개</span>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>코드 그룹 추가</DialogTitle>
            <DialogDescription>
              <strong>{resource.resourceName}</strong>에서 사용할 코드 그룹을 선택하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>코드 그룹 *</Label>
              <Select value={selectedGroupKey} onValueChange={setSelectedGroupKey}>
                <SelectTrigger>
                  <SelectValue placeholder="그룹 선택" />
                </SelectTrigger>
                <SelectContent>
                  {availableGroups.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      추가 가능한 그룹이 없습니다.
                    </div>
                  ) : (
                    availableGroups.map(group => (
                      <SelectItem key={group.groupKey} value={group.groupKey}>
                        <div className="flex items-center justify-between gap-4">
                          <span>{group.groupName}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {group.groupKey}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedGroupKey && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">포함 코드 수:</span>
                  <Badge variant="secondary">
                    {availableGroups.find(g => g.groupKey === selectedGroupKey)?.codesCount}개
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddMapping} disabled={!selectedGroupKey}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>매핑을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedMapping?.groupName}</strong> ({selectedMapping?.groupKey}) 매핑이 삭제됩니다.
              이 화면의 관련 드롭다운이 비활성화될 수 있습니다.
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
