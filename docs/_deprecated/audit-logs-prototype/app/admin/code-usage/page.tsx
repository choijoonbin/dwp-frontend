"use client"

import { useState } from "react"
import { ResourceSelectorPanel } from "@/components/admin/code-usage/resource-selector-panel"
import { MappingEditorPanel } from "@/components/admin/code-usage/mapping-editor-panel"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Info } from "lucide-react"

// Types
export interface Resource {
  id: string
  resourceKey: string
  resourceName: string
  resourceType: "MENU" | "UI"
  mappingsCount: number
}

export interface CodeUsage {
  id: string
  resourceKey: string
  groupKey: string
  groupName: string
  enabled: boolean
  codesCount: number
}

export interface CodeGroup {
  groupKey: string
  groupName: string
  codesCount: number
}

// Mock Data
export const mockResources: Resource[] = [
  { id: "r1", resourceKey: "menu.admin.users", resourceName: "사용자 관리", resourceType: "MENU", mappingsCount: 3 },
  { id: "r2", resourceKey: "menu.admin.roles", resourceName: "역할 관리", resourceType: "MENU", mappingsCount: 2 },
  { id: "r3", resourceKey: "menu.admin.menus", resourceName: "메뉴 관리", resourceType: "MENU", mappingsCount: 1 },
  { id: "r4", resourceKey: "menu.admin.codes", resourceName: "코드 관리", resourceType: "MENU", mappingsCount: 2 },
  { id: "r5", resourceKey: "menu.admin.monitoring", resourceName: "모니터링", resourceType: "MENU", mappingsCount: 0 },
  { id: "r6", resourceKey: "menu.reports.sales", resourceName: "매출 리포트", resourceType: "MENU", mappingsCount: 2 },
  { id: "r7", resourceKey: "menu.reports.analytics", resourceName: "분석 리포트", resourceType: "MENU", mappingsCount: 1 },
  { id: "r8", resourceKey: "ui.common.header", resourceName: "공통 헤더", resourceType: "UI", mappingsCount: 1 },
  { id: "r9", resourceKey: "ui.common.footer", resourceName: "공통 푸터", resourceType: "UI", mappingsCount: 0 },
]

export const mockCodeUsages: CodeUsage[] = [
  { id: "cu1", resourceKey: "menu.admin.users", groupKey: "USER_STATUS", groupName: "사용자 상태", enabled: true, codesCount: 4 },
  { id: "cu2", resourceKey: "menu.admin.users", groupKey: "USER_TYPE", groupName: "사용자 유형", enabled: true, codesCount: 3 },
  { id: "cu3", resourceKey: "menu.admin.users", groupKey: "DEPARTMENT", groupName: "부서", enabled: true, codesCount: 8 },
  { id: "cu4", resourceKey: "menu.admin.roles", groupKey: "USER_TYPE", groupName: "사용자 유형", enabled: true, codesCount: 3 },
  { id: "cu5", resourceKey: "menu.admin.roles", groupKey: "APPROVAL_STATUS", groupName: "승인 상태", enabled: false, codesCount: 5 },
  { id: "cu6", resourceKey: "menu.admin.menus", groupKey: "PRIORITY", groupName: "우선순위", enabled: true, codesCount: 4 },
  { id: "cu7", resourceKey: "menu.admin.codes", groupKey: "USER_STATUS", groupName: "사용자 상태", enabled: true, codesCount: 4 },
  { id: "cu8", resourceKey: "menu.admin.codes", groupKey: "APPROVAL_STATUS", groupName: "승인 상태", enabled: true, codesCount: 5 },
  { id: "cu9", resourceKey: "menu.reports.sales", groupKey: "PRIORITY", groupName: "우선순위", enabled: true, codesCount: 4 },
  { id: "cu10", resourceKey: "menu.reports.sales", groupKey: "DEPARTMENT", groupName: "부서", enabled: true, codesCount: 8 },
  { id: "cu11", resourceKey: "menu.reports.analytics", groupKey: "APPROVAL_STATUS", groupName: "승인 상태", enabled: true, codesCount: 5 },
  { id: "cu12", resourceKey: "ui.common.header", groupKey: "USER_TYPE", groupName: "사용자 유형", enabled: true, codesCount: 3 },
]

export const mockAvailableGroups: CodeGroup[] = [
  { groupKey: "USER_STATUS", groupName: "사용자 상태", codesCount: 4 },
  { groupKey: "USER_TYPE", groupName: "사용자 유형", codesCount: 3 },
  { groupKey: "APPROVAL_STATUS", groupName: "승인 상태", codesCount: 5 },
  { groupKey: "PRIORITY", groupName: "우선순위", codesCount: 4 },
  { groupKey: "DEPARTMENT", groupName: "부서", codesCount: 8 },
]

export default function CodeUsagePage() {
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
  const [resources, setResources] = useState<Resource[]>(mockResources)
  const [codeUsages, setCodeUsages] = useState<CodeUsage[]>(mockCodeUsages)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"ALL" | "MENU" | "UI">("ALL")
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)

  const handleSelectResource = (resource: Resource) => {
    setSelectedResource(resource)
    setMobileDetailOpen(true)
  }

  const handleMappingCreated = (usage: CodeUsage) => {
    setCodeUsages(prev => [...prev, usage])
    // Update resource mappings count
    setResources(prev => prev.map(r => 
      r.resourceKey === usage.resourceKey 
        ? { ...r, mappingsCount: r.mappingsCount + 1 }
        : r
    ))
  }

  const handleMappingUpdated = (usage: CodeUsage) => {
    setCodeUsages(prev => prev.map(u => u.id === usage.id ? usage : u))
  }

  const handleMappingDeleted = (usageId: string, resourceKey: string) => {
    setCodeUsages(prev => prev.filter(u => u.id !== usageId))
    // Update resource mappings count
    setResources(prev => prev.map(r => 
      r.resourceKey === resourceKey 
        ? { ...r, mappingsCount: Math.max(0, r.mappingsCount - 1) }
        : r
    ))
  }

  const getResourceMappings = (resourceKey: string) => {
    return codeUsages.filter(u => u.resourceKey === resourceKey)
  }

  const getAvailableGroups = (resourceKey: string) => {
    const existingGroupKeys = codeUsages
      .filter(u => u.resourceKey === resourceKey)
      .map(u => u.groupKey)
    return mockAvailableGroups.filter(g => !existingGroupKeys.includes(g.groupKey))
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Help Card */}
      <Alert className="mx-4 mt-4 border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm text-foreground">
          <strong>코드 사용 정의(CodeUsage)</strong>는 메뉴별로 사용 가능한 드롭다운 코드 그룹을 매핑합니다. 
          매핑이 없으면 해당 화면의 selectbox가 비활성화됩니다.
        </AlertDescription>
      </Alert>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        {/* Left Panel - Resource Selector */}
        <div className="w-full lg:w-96 border border-border rounded-lg bg-card flex flex-col overflow-hidden">
          <ResourceSelectorPanel
            resources={resources}
            selectedResource={selectedResource}
            onSelectResource={handleSelectResource}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
          />
        </div>

        {/* Right Panel - Mapping Editor (Desktop) */}
        <div className="hidden lg:flex flex-1 border border-border rounded-lg bg-card flex-col overflow-hidden">
          <MappingEditorPanel
            resource={selectedResource}
            mappings={selectedResource ? getResourceMappings(selectedResource.resourceKey) : []}
            availableGroups={selectedResource ? getAvailableGroups(selectedResource.resourceKey) : []}
            onMappingCreated={handleMappingCreated}
            onMappingUpdated={handleMappingUpdated}
            onMappingDeleted={handleMappingDeleted}
          />
        </div>

        {/* Right Panel - Mapping Editor (Mobile) */}
        <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
          <SheetContent side="bottom" className="h-[85vh] p-0">
            <MappingEditorPanel
              resource={selectedResource}
              mappings={selectedResource ? getResourceMappings(selectedResource.resourceKey) : []}
              availableGroups={selectedResource ? getAvailableGroups(selectedResource.resourceKey) : []}
              onMappingCreated={handleMappingCreated}
              onMappingUpdated={handleMappingUpdated}
              onMappingDeleted={handleMappingDeleted}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
