"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Folder, FileCode, Info } from "lucide-react"
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

interface MenuCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentMenu: MenuItem | null
  menus: MenuItem[]
  onCreated: (menu: MenuItem) => void
}

export function MenuCreateDialog({
  open,
  onOpenChange,
  parentMenu,
  menus,
  onCreated,
}: MenuCreateDialogProps) {
  const [menuType, setMenuType] = useState<"folder" | "route">("route")
  const [formData, setFormData] = useState({
    menuName: "",
    menuKey: "",
    routePath: "",
    icon: "mdi:file-document",
    remoteKey: "",
    enabled: true,
    sortOrder: 1,
  })

  const handleChange = (field: string, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleCreate = () => {
    const newMenu: MenuItem = {
      id: `new-${Date.now()}`,
      menuKey: formData.menuKey,
      menuName: formData.menuName,
      parentMenuId: parentMenu?.id || null,
      routePath: menuType === "folder" ? null : formData.routePath || null,
      icon: formData.icon,
      sortOrder: formData.sortOrder,
      remoteKey: formData.remoteKey || null,
      enabled: formData.enabled,
    }
    onCreated(newMenu)
    // Reset form
    setFormData({
      menuName: "",
      menuKey: "",
      routePath: "",
      icon: "mdi:file-document",
      remoteKey: "",
      enabled: true,
      sortOrder: 1,
    })
    setMenuType("route")
  }

  const isValid = formData.menuName && formData.menuKey && (menuType === "folder" || formData.routePath)

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>새 메뉴 생성</DialogTitle>
          <DialogDescription>
            {parentMenu ? (
              <>
                <strong>{parentMenu.menuName}</strong> 하위에 새 메뉴를 생성합니다.
              </>
            ) : (
              "최상위 메뉴를 생성합니다."
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={menuType} onValueChange={(v) => setMenuType(v as "folder" | "route")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="route" className="gap-2">
              <FileCode className="h-4 w-4" />
              라우트 메뉴
            </TabsTrigger>
            <TabsTrigger value="folder" className="gap-2">
              <Folder className="h-4 w-4" />
              폴더/그룹
            </TabsTrigger>
          </TabsList>

          <TabsContent value="route" className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              클릭 시 지정된 경로로 이동하는 메뉴입니다.
            </p>
          </TabsContent>

          <TabsContent value="folder" className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              하위 메뉴를 그룹화하는 폴더입니다. 클릭 시 첫 번째 활성 하위 메뉴로 이동합니다.
            </p>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-menuName">메뉴 이름 *</Label>
              <Input
                id="create-menuName"
                value={formData.menuName}
                onChange={(e) => handleChange("menuName", e.target.value)}
                placeholder="새 메뉴"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-menuKey">메뉴 키 *</Label>
              <Input
                id="create-menuKey"
                value={formData.menuKey}
                onChange={(e) => handleChange("menuKey", e.target.value)}
                placeholder="menu.admin.example"
              />
            </div>
          </div>

          {menuType === "route" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-routePath">라우트 경로 *</Label>
                <Input
                  id="create-routePath"
                  value={formData.routePath}
                  onChange={(e) => handleChange("routePath", e.target.value)}
                  placeholder="/admin/example"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-remoteKey">Remote Key</Label>
                <Select
                  value={formData.remoteKey || "none"}
                  onValueChange={(value) => handleChange("remoteKey", value === "none" ? "" : value)}
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
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-icon">아이콘</Label>
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
              <Label htmlFor="create-sortOrder">정렬 순서</Label>
              <Input
                id="create-sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) => handleChange("sortOrder", parseInt(e.target.value) || 1)}
                min={1}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="create-enabled">활성화</Label>
              <p className="text-sm text-muted-foreground">
                생성 즉시 사이드바에 표시됩니다
              </p>
            </div>
            <Switch
              id="create-enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => handleChange("enabled", checked)}
            />
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              메뉴 생성 시 menuKey와 동일한 RBAC resourceKey가 자동으로 생성됩니다.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleCreate} disabled={!isValid}>
            생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
