"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Copy,
  Eye,
  EyeOff,
  Folder,
  FileCode,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { MenuItem } from "@/app/admin/menus/page"

interface MenuTreePanelProps {
  menus: MenuItem[]
  selectedMenu: MenuItem | null
  onSelectMenu: (menu: MenuItem) => void
  onCreateChild: (parent: MenuItem) => void
  onReorder: (menuId: string, direction: "up" | "down") => void
  showDisabled: boolean
  onShowDisabledChange: (show: boolean) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function MenuTreePanel({
  menus,
  selectedMenu,
  onSelectMenu,
  onCreateChild,
  onReorder,
  showDisabled,
  onShowDisabledChange,
  searchQuery,
  onSearchChange,
}: MenuTreePanelProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(["2", "3"]))

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const filterMenus = (items: MenuItem[]): MenuItem[] => {
    return items.filter(item => {
      const matchesSearch = !searchQuery || 
        item.menuName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.menuKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.routePath?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesEnabled = showDisabled || item.enabled

      if (item.children) {
        const filteredChildren = filterMenus(item.children)
        if (filteredChildren.length > 0) {
          return matchesEnabled
        }
      }

      return matchesSearch && matchesEnabled
    }).map(item => ({
      ...item,
      children: item.children ? filterMenus(item.children) : undefined
    }))
  }

  const filteredMenus = filterMenus(menus)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const renderMenuItem = (menu: MenuItem, level: number = 0) => {
    const hasChildren = menu.children && menu.children.length > 0
    const isExpanded = expandedItems.has(menu.id)
    const isSelected = selectedMenu?.id === menu.id
    const isFolder = !menu.routePath

    return (
      <div key={menu.id}>
        <div
          className={cn(
            "group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors rounded-md mx-2",
            isSelected
              ? "bg-primary/10 text-primary"
              : "hover:bg-muted text-foreground",
            !menu.enabled && "opacity-50"
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => onSelectMenu(menu)}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(menu.id)
              }}
              className="p-0.5 hover:bg-muted-foreground/10 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}

          {/* Icon */}
          {isFolder ? (
            <Folder className="h-4 w-4 text-amber-500 shrink-0" />
          ) : (
            <FileCode className="h-4 w-4 text-blue-500 shrink-0" />
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{menu.menuName}</span>
              {!menu.enabled && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-muted-foreground/30 text-muted-foreground">
                  비활성
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground font-mono truncate">
                {menu.menuKey}
              </span>
              {menu.remoteKey && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                  {menu.remoteKey}
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onCreateChild(menu)}>
                <Plus className="mr-2 h-4 w-4" />
                하위 메뉴 추가
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onReorder(menu.id, "up")}>
                <ArrowUp className="mr-2 h-4 w-4" />
                위로 이동
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReorder(menu.id, "down")}>
                <ArrowDown className="mr-2 h-4 w-4" />
                아래로 이동
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => copyToClipboard(menu.menuKey)}>
                <Copy className="mr-2 h-4 w-4" />
                키 복사
              </DropdownMenuItem>
              <DropdownMenuItem>
                {menu.enabled ? (
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {menu.children!.map(child => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search & Filters */}
      <div className="p-4 space-y-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="메뉴 검색 (이름, 키, 경로)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-disabled" className="text-sm text-muted-foreground">
            비활성 메뉴 표시
          </Label>
          <Switch
            id="show-disabled"
            checked={showDisabled}
            onCheckedChange={onShowDisabledChange}
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {filteredMenus.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Folder className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "검색 결과가 없습니다." : "메뉴가 없습니다."}
            </p>
          </div>
        ) : (
          filteredMenus.map(menu => renderMenuItem(menu))
        )}
      </div>

      {/* Stats */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>전체 메뉴: {menus.length}개</span>
          <span>활성: {menus.filter(m => m.enabled).length}개</span>
        </div>
      </div>
    </div>
  )
}
