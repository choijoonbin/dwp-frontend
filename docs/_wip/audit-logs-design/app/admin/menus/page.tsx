"use client"

import { useState } from "react"
import { MenuTreePanel } from "@/components/admin/menus/menu-tree-panel"
import { MenuDetailPanel } from "@/components/admin/menus/menu-detail-panel"
import { MenuCreateDialog } from "@/components/admin/menus/menu-create-dialog"
import { Button } from "@/components/ui/button"
import { Plus, Save } from "lucide-react"
import { Sheet, SheetContent } from "@/components/ui/sheet"

// Mock data for demonstration
export interface MenuItem {
  id: string
  menuKey: string
  menuName: string
  parentMenuId: string | null
  routePath: string | null
  icon: string
  sortOrder: number
  remoteKey: string | null
  enabled: boolean
  children?: MenuItem[]
}

const mockMenus: MenuItem[] = [
  {
    id: "1",
    menuKey: "menu.dashboard",
    menuName: "대시보드",
    parentMenuId: null,
    routePath: "/dashboard",
    icon: "mdi:view-dashboard",
    sortOrder: 1,
    remoteKey: "mainRemote",
    enabled: true,
  },
  {
    id: "2",
    menuKey: "menu.admin",
    menuName: "관리자",
    parentMenuId: null,
    routePath: null,
    icon: "mdi:shield-account",
    sortOrder: 2,
    remoteKey: null,
    enabled: true,
    children: [
      {
        id: "2-1",
        menuKey: "menu.admin.users",
        menuName: "사용자 관리",
        parentMenuId: "2",
        routePath: "/admin/users",
        icon: "mdi:account-group",
        sortOrder: 1,
        remoteKey: "adminRemote",
        enabled: true,
      },
      {
        id: "2-2",
        menuKey: "menu.admin.roles",
        menuName: "역할 관리",
        parentMenuId: "2",
        routePath: "/admin/roles",
        icon: "mdi:shield-key",
        sortOrder: 2,
        remoteKey: "adminRemote",
        enabled: true,
      },
      {
        id: "2-3",
        menuKey: "menu.admin.menus",
        menuName: "메뉴 관리",
        parentMenuId: "2",
        routePath: "/admin/menus",
        icon: "mdi:menu",
        sortOrder: 3,
        remoteKey: "adminRemote",
        enabled: true,
      },
      {
        id: "2-4",
        menuKey: "menu.admin.codes",
        menuName: "코드 관리",
        parentMenuId: "2",
        routePath: "/admin/codes",
        icon: "mdi:code-tags",
        sortOrder: 4,
        remoteKey: "adminRemote",
        enabled: true,
      },
      {
        id: "2-5",
        menuKey: "menu.admin.monitoring",
        menuName: "모니터링",
        parentMenuId: "2",
        routePath: "/admin/monitoring",
        icon: "mdi:monitor-dashboard",
        sortOrder: 5,
        remoteKey: "adminRemote",
        enabled: false,
      },
    ],
  },
  {
    id: "3",
    menuKey: "menu.reports",
    menuName: "리포트",
    parentMenuId: null,
    routePath: null,
    icon: "mdi:chart-box",
    sortOrder: 3,
    remoteKey: null,
    enabled: true,
    children: [
      {
        id: "3-1",
        menuKey: "menu.reports.sales",
        menuName: "매출 리포트",
        parentMenuId: "3",
        routePath: "/reports/sales",
        icon: "mdi:cash-multiple",
        sortOrder: 1,
        remoteKey: "reportRemote",
        enabled: true,
      },
      {
        id: "3-2",
        menuKey: "menu.reports.analytics",
        menuName: "분석 리포트",
        parentMenuId: "3",
        routePath: "/reports/analytics",
        icon: "mdi:google-analytics",
        sortOrder: 2,
        remoteKey: "reportRemote",
        enabled: true,
      },
    ],
  },
  {
    id: "4",
    menuKey: "menu.settings",
    menuName: "설정",
    parentMenuId: null,
    routePath: "/settings",
    icon: "mdi:cog",
    sortOrder: 4,
    remoteKey: "mainRemote",
    enabled: true,
  },
]

export default function MenusManagementPage() {
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null)
  const [menus, setMenus] = useState<MenuItem[]>(mockMenus)
  const [showDisabled, setShowDisabled] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [parentForNewMenu, setParentForNewMenu] = useState<MenuItem | null>(null)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const handleSelectMenu = (menu: MenuItem) => {
    setSelectedMenu(menu)
    setMobileDetailOpen(true)
    setIsDirty(false)
  }

  const handleCreateMenu = (parentMenu?: MenuItem) => {
    setParentForNewMenu(parentMenu || null)
    setCreateDialogOpen(true)
  }

  const handleMenuCreated = (newMenu: MenuItem) => {
    // Add the new menu to the tree
    if (newMenu.parentMenuId) {
      setMenus(prevMenus => {
        const addToParent = (items: MenuItem[]): MenuItem[] => {
          return items.map(item => {
            if (item.id === newMenu.parentMenuId) {
              return {
                ...item,
                children: [...(item.children || []), newMenu]
              }
            }
            if (item.children) {
              return { ...item, children: addToParent(item.children) }
            }
            return item
          })
        }
        return addToParent(prevMenus)
      })
    } else {
      setMenus(prev => [...prev, newMenu])
    }
    setSelectedMenu(newMenu)
    setCreateDialogOpen(false)
  }

  const handleMenuUpdate = (updatedMenu: MenuItem) => {
    setMenus(prevMenus => {
      const updateInTree = (items: MenuItem[]): MenuItem[] => {
        return items.map(item => {
          if (item.id === updatedMenu.id) {
            return { ...updatedMenu, children: item.children }
          }
          if (item.children) {
            return { ...item, children: updateInTree(item.children) }
          }
          return item
        })
      }
      return updateInTree(prevMenus)
    })
    setSelectedMenu(updatedMenu)
    setIsDirty(false)
  }

  const handleReorder = (menuId: string, direction: "up" | "down") => {
    setMenus(prevMenus => {
      const reorderInTree = (items: MenuItem[]): MenuItem[] => {
        const index = items.findIndex(item => item.id === menuId)
        if (index === -1) {
          return items.map(item => {
            if (item.children) {
              return { ...item, children: reorderInTree(item.children) }
            }
            return item
          })
        }

        const newItems = [...items]
        const targetIndex = direction === "up" ? index - 1 : index + 1
        
        if (targetIndex < 0 || targetIndex >= items.length) {
          return items
        }

        const temp = newItems[index]
        newItems[index] = newItems[targetIndex]
        newItems[targetIndex] = temp

        // Update sortOrder
        return newItems.map((item, i) => ({ ...item, sortOrder: i + 1 }))
      }
      return reorderInTree(prevMenus)
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <Button onClick={() => handleCreateMenu()} className="gap-2">
            <Plus className="h-4 w-4" />
            새 메뉴
          </Button>
        </div>
        {isDirty && (
          <Button variant="outline" className="gap-2 bg-transparent">
            <Save className="h-4 w-4" />
            정렬 저장
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Menu Tree */}
        <div className="w-full lg:w-96 border-r border-border flex flex-col bg-card">
          <MenuTreePanel
            menus={menus}
            selectedMenu={selectedMenu}
            onSelectMenu={handleSelectMenu}
            onCreateChild={handleCreateMenu}
            onReorder={handleReorder}
            showDisabled={showDisabled}
            onShowDisabledChange={setShowDisabled}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Right Panel - Detail Editor (Desktop) */}
        <div className="hidden lg:flex flex-1 flex-col bg-background">
          <MenuDetailPanel
            menu={selectedMenu}
            menus={menus}
            onUpdate={handleMenuUpdate}
            onCreateChild={handleCreateMenu}
            onDirtyChange={setIsDirty}
          />
        </div>

        {/* Right Panel - Detail Editor (Mobile) */}
        <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
          <SheetContent side="bottom" className="h-[85vh] p-0">
            <MenuDetailPanel
              menu={selectedMenu}
              menus={menus}
              onUpdate={handleMenuUpdate}
              onCreateChild={handleCreateMenu}
              onDirtyChange={setIsDirty}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Create Dialog */}
      <MenuCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        parentMenu={parentForNewMenu}
        menus={menus}
        onCreated={handleMenuCreated}
      />
    </div>
  )
}
