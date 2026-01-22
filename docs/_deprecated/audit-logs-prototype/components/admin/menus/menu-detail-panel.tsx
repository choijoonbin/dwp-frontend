"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Save,
  Trash2,
  Plus,
  AlertTriangle,
  Lock,
  Unlock,
  Info,
  Folder,
  FileCode,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { MenuItem } from "@/app/admin/menus/page"

const remoteKeys = [
  { value: "mainRemote", label: "Main Remote" },
  { value: "adminRemote", label: "Admin Remote" },
  { value: "reportRemote", label: "Report Remote" },
  { value: "auraRemote", label: "Aura Remote" },
]

const iconOptions = [
  "mdi:view-dashboard",
  "mdi:shield-account",
  "mdi:account-group",
  "mdi:shield-key",
  "mdi:menu",
  "mdi:code-tags",
  "mdi:monitor-dashboard",
  "mdi:chart-box",
  "mdi:cash-multiple",
  "mdi:google-analytics",
  "mdi:cog",
  "mdi:folder",
  "mdi:file-document",
]

interface MenuDetailPanelProps {
  menu: MenuItem | null
  menus: MenuItem[]
  onUpdate: (menu: MenuItem) => void
  onCreateChild: (parent: MenuItem) => void
  onDirtyChange: (dirty: boolean) => void
}

export function MenuDetailPanel({
  menu,
  menus,
  onUpdate,
  onCreateChild,
  onDirtyChange,
}: MenuDetailPanelProps) {
  const [formData, setFormData] = useState<MenuItem | null>(null)
  const [keyLocked, setKeyLocked] = useState(true)
  const [hasChildren, setHasChildren] = useState(false)

  useEffect(() => {
    if (menu) {
      setFormData({ ...menu })
      setKeyLocked(true)
      setHasChildren(!!menu.children && menu.children.length > 0)
    }
  }, [menu])

  useEffect(() => {
    if (menu && formData) {
      const isDirty = JSON.stringify(menu) !== JSON.stringify(formData)
      onDirtyChange(isDirty)
    }
  }, [menu, formData, onDirtyChange])

  const handleChange = (field: keyof MenuItem, value: string | boolean | number | null) => {
    if (!formData) return
    setFormData({ ...formData, [field]: value })
  }

  const handleSave = () => {
    if (!formData) return
    onUpdate(formData)
  }

  const handleReset = () => {
    if (menu) {
      setFormData({ ...menu })
    }
  }

  const flattenMenus = (items: MenuItem[]): MenuItem[] => {
    return items.reduce((acc, item) => {
      acc.push(item)
      if (item.children) {
        acc.push(...flattenMenus(item.children))
      }
      return acc
    }, [] as MenuItem[])
  }

  const allMenus = flattenMenus(menus)

  if (!menu || !formData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <Folder className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">메뉴를 선택하세요</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          왼쪽 트리에서 메뉴를 선택하면 상세 정보를 확인하고 편집할 수 있습니다.
        </p>
      </div>
    )
  }

  const isFolder = !formData.routePath

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            {isFolder ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <Folder className="h-5 w-5 text-amber-500" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <FileCode className="h-5 w-5 text-blue-500" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-foreground">{menu.menuName}</h2>
              <p className="text-sm text-muted-foreground font-mono">{menu.menuKey}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={formData.enabled ? "default" : "secondary"}>
              {formData.enabled ? "활성" : "비활성"}
            </Badge>
            {isFolder && (
              <Badge variant="outline" className="border-amber-500/30 text-amber-500">
                폴더
              </Badge>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                기본 정보
                <Separator className="flex-1" />
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="menuName">메뉴 이름 *</Label>
                  <Input
                    id="menuName"
                    value={formData.menuName}
                    onChange={(e) => handleChange("menuName", e.target.value)}
                    placeholder="메뉴 이름을 입력하세요"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="menuKey" className="flex items-center gap-2">
                    메뉴 키 *
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>RBAC resourceKey와 동일하게 사용됩니다</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="menuKey"
                      value={formData.menuKey}
                      onChange={(e) => handleChange("menuKey", e.target.value)}
                      placeholder="menu.admin.example"
                      disabled={keyLocked}
                      className={cn(keyLocked && "bg-muted")}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setKeyLocked(!keyLocked)}
                      className={cn(!keyLocked && "border-amber-500 text-amber-500")}
                    >
                      {keyLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </Button>
                  </div>
                  {!keyLocked && (
                    <p className="text-xs text-amber-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      키 변경은 RBAC 권한에 영향을 줄 수 있습니다
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentMenuId">상위 메뉴</Label>
                <Select
                  value={formData.parentMenuId || "none"}
                  onValueChange={(value) => handleChange("parentMenuId", value === "none" ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="상위 메뉴 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">없음 (최상위)</SelectItem>
                    {allMenus
                      .filter(m => m.id !== menu.id)
                      .map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.menuName} ({m.menuKey})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Navigation */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                내비게이션
                <Separator className="flex-1" />
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="routePath" className="flex items-center gap-2">
                    라우트 경로
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>비어있으면 폴더/그룹으로 동작합니다</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="routePath"
                    value={formData.routePath || ""}
                    onChange={(e) => handleChange("routePath", e.target.value || null)}
                    placeholder="/admin/example (비워두면 폴더)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remoteKey">Remote Key</Label>
                  <Select
                    value={formData.remoteKey || "none"}
                    onValueChange={(value) => handleChange("remoteKey", value === "none" ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Remote 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">없음</SelectItem>
                      {remoteKeys.map(remote => (
                        <SelectItem key={remote.value} value={remote.value}>
                          {remote.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="icon">아이콘 (Iconify)</Label>
                  <Select
                    value={formData.icon}
                    onValueChange={(value) => handleChange("icon", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="아이콘 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map(icon => (
                        <SelectItem key={icon} value={icon}>
                          {icon}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sortOrder">정렬 순서</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => handleChange("sortOrder", parseInt(e.target.value) || 0)}
                    min={1}
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                상태
                <Separator className="flex-1" />
              </h3>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled">메뉴 활성화</Label>
                  <p className="text-sm text-muted-foreground">
                    비활성화하면 사이드바에서 숨겨집니다
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => handleChange("enabled", checked)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                작업
                <Separator className="flex-1" />
              </h3>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => onCreateChild(menu)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  하위 메뉴 추가
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2 text-destructive hover:text-destructive bg-transparent">
                      <Trash2 className="h-4 w-4" />
                      삭제
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>메뉴를 삭제하시겠습니까?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {hasChildren ? (
                          <span className="text-destructive">
                            이 메뉴에는 하위 메뉴가 있습니다. 먼저 하위 메뉴를 이동하거나 삭제해주세요.
                          </span>
                        ) : (
                          <>
                            <strong>{menu.menuName}</strong> ({menu.menuKey}) 메뉴가 영구적으로 삭제됩니다.
                            이 작업은 되돌릴 수 없습니다.
                          </>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={hasChildren}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/30">
          <Button variant="outline" onClick={handleReset}>
            취소
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            저장
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}
