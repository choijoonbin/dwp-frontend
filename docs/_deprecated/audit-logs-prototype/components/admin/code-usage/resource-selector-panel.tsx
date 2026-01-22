"use client"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Menu, Layout, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Resource } from "@/app/admin/code-usage/page"

interface ResourceSelectorPanelProps {
  resources: Resource[]
  selectedResource: Resource | null
  onSelectResource: (resource: Resource) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  typeFilter: "ALL" | "MENU" | "UI"
  onTypeFilterChange: (type: "ALL" | "MENU" | "UI") => void
}

export function ResourceSelectorPanel({
  resources,
  selectedResource,
  onSelectResource,
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
}: ResourceSelectorPanelProps) {
  const filteredResources = resources.filter(resource => {
    const matchesSearch = !searchQuery ||
      resource.resourceKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.resourceName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === "ALL" || resource.resourceType === typeFilter
    return matchesSearch && matchesType
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-4">
        <h3 className="text-sm font-medium text-foreground">리소스 선택</h3>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="리소스 키 또는 이름 검색"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => onTypeFilterChange(v as "ALL" | "MENU" | "UI")}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="유형 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            <SelectItem value="MENU">MENU</SelectItem>
            <SelectItem value="UI">UI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredResources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Link2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "검색 결과가 없습니다." : "리소스가 없습니다."}
            </p>
          </div>
        ) : (
          <div className="py-2">
            {filteredResources.map((resource) => {
              const isSelected = selectedResource?.id === resource.id
              return (
                <div
                  key={resource.id}
                  onClick={() => onSelectResource(resource)}
                  className={cn(
                    "group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors mx-2 rounded-lg",
                    isSelected
                      ? "bg-primary/10"
                      : "hover:bg-muted"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    resource.resourceType === "MENU" 
                      ? "bg-blue-500/10 text-blue-500"
                      : "bg-amber-500/10 text-amber-500"
                  )}>
                    {resource.resourceType === "MENU" ? (
                      <Menu className="h-4 w-4" />
                    ) : (
                      <Layout className="h-4 w-4" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-medium truncate",
                        isSelected ? "text-primary" : "text-foreground"
                      )}>
                        {resource.resourceName}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px] px-1 py-0 h-4 shrink-0",
                          resource.resourceType === "MENU"
                            ? "border-blue-500/30 text-blue-500"
                            : "border-amber-500/30 text-amber-500"
                        )}
                      >
                        {resource.resourceType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                      {resource.resourceKey}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge 
                        variant={resource.mappingsCount > 0 ? "secondary" : "outline"}
                        className="text-[10px] px-1.5 py-0 h-5"
                      >
                        {resource.mappingsCount > 0 ? (
                          <>{resource.mappingsCount}개 매핑</>
                        ) : (
                          <span className="text-muted-foreground">매핑 없음</span>
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>전체: {resources.length}개</span>
          <span>
            MENU: {resources.filter(r => r.resourceType === "MENU").length} · 
            UI: {resources.filter(r => r.resourceType === "UI").length}
          </span>
        </div>
      </div>
    </div>
  )
}
