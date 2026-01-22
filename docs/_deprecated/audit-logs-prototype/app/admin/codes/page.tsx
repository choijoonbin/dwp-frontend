"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeGroupsTab } from "@/components/admin/codes/code-groups-tab"
import { CodesTab } from "@/components/admin/codes/codes-tab"
import { Layers, Tag, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Types
export interface CodeGroup {
  id: string
  groupKey: string
  groupName: string
  description: string | null
  enabled: boolean
  sortOrder: number
  codesCount: number
  updatedAt: string
}

export interface Code {
  id: string
  groupKey: string
  code: string
  name: string
  sortOrder: number
  enabled: boolean
  tenantScope: "COMMON" | "TENANT"
}

// Mock Data
export const mockCodeGroups: CodeGroup[] = [
  {
    id: "1",
    groupKey: "USER_STATUS",
    groupName: "사용자 상태",
    description: "사용자 계정 상태 코드",
    enabled: true,
    sortOrder: 1,
    codesCount: 4,
    updatedAt: "2025-01-20T10:30:00Z",
  },
  {
    id: "2",
    groupKey: "USER_TYPE",
    groupName: "사용자 유형",
    description: "사용자 분류 유형",
    enabled: true,
    sortOrder: 2,
    codesCount: 3,
    updatedAt: "2025-01-19T14:20:00Z",
  },
  {
    id: "3",
    groupKey: "APPROVAL_STATUS",
    groupName: "승인 상태",
    description: "결재/승인 프로세스 상태",
    enabled: true,
    sortOrder: 3,
    codesCount: 5,
    updatedAt: "2025-01-18T09:15:00Z",
  },
  {
    id: "4",
    groupKey: "PRIORITY",
    groupName: "우선순위",
    description: "작업 우선순위 레벨",
    enabled: true,
    sortOrder: 4,
    codesCount: 4,
    updatedAt: "2025-01-17T16:45:00Z",
  },
  {
    id: "5",
    groupKey: "DEPARTMENT",
    groupName: "부서",
    description: "조직 부서 코드",
    enabled: false,
    sortOrder: 5,
    codesCount: 8,
    updatedAt: "2025-01-15T11:00:00Z",
  },
]

export const mockCodes: Code[] = [
  // USER_STATUS
  { id: "c1", groupKey: "USER_STATUS", code: "ACTIVE", name: "활성", sortOrder: 1, enabled: true, tenantScope: "COMMON" },
  { id: "c2", groupKey: "USER_STATUS", code: "INACTIVE", name: "비활성", sortOrder: 2, enabled: true, tenantScope: "COMMON" },
  { id: "c3", groupKey: "USER_STATUS", code: "PENDING", name: "대기", sortOrder: 3, enabled: true, tenantScope: "COMMON" },
  { id: "c4", groupKey: "USER_STATUS", code: "SUSPENDED", name: "정지", sortOrder: 4, enabled: true, tenantScope: "COMMON" },
  // USER_TYPE
  { id: "c5", groupKey: "USER_TYPE", code: "ADMIN", name: "관리자", sortOrder: 1, enabled: true, tenantScope: "COMMON" },
  { id: "c6", groupKey: "USER_TYPE", code: "USER", name: "일반 사용자", sortOrder: 2, enabled: true, tenantScope: "COMMON" },
  { id: "c7", groupKey: "USER_TYPE", code: "GUEST", name: "게스트", sortOrder: 3, enabled: true, tenantScope: "TENANT" },
  // APPROVAL_STATUS
  { id: "c8", groupKey: "APPROVAL_STATUS", code: "DRAFT", name: "초안", sortOrder: 1, enabled: true, tenantScope: "COMMON" },
  { id: "c9", groupKey: "APPROVAL_STATUS", code: "SUBMITTED", name: "제출됨", sortOrder: 2, enabled: true, tenantScope: "COMMON" },
  { id: "c10", groupKey: "APPROVAL_STATUS", code: "APPROVED", name: "승인", sortOrder: 3, enabled: true, tenantScope: "COMMON" },
  { id: "c11", groupKey: "APPROVAL_STATUS", code: "REJECTED", name: "반려", sortOrder: 4, enabled: true, tenantScope: "COMMON" },
  { id: "c12", groupKey: "APPROVAL_STATUS", code: "CANCELLED", name: "취소", sortOrder: 5, enabled: true, tenantScope: "TENANT" },
  // PRIORITY
  { id: "c13", groupKey: "PRIORITY", code: "CRITICAL", name: "긴급", sortOrder: 1, enabled: true, tenantScope: "COMMON" },
  { id: "c14", groupKey: "PRIORITY", code: "HIGH", name: "높음", sortOrder: 2, enabled: true, tenantScope: "COMMON" },
  { id: "c15", groupKey: "PRIORITY", code: "MEDIUM", name: "보통", sortOrder: 3, enabled: true, tenantScope: "COMMON" },
  { id: "c16", groupKey: "PRIORITY", code: "LOW", name: "낮음", sortOrder: 4, enabled: true, tenantScope: "COMMON" },
  // DEPARTMENT
  { id: "c17", groupKey: "DEPARTMENT", code: "DEV", name: "개발팀", sortOrder: 1, enabled: true, tenantScope: "TENANT" },
  { id: "c18", groupKey: "DEPARTMENT", code: "SALES", name: "영업팀", sortOrder: 2, enabled: true, tenantScope: "TENANT" },
  { id: "c19", groupKey: "DEPARTMENT", code: "HR", name: "인사팀", sortOrder: 3, enabled: true, tenantScope: "TENANT" },
  { id: "c20", groupKey: "DEPARTMENT", code: "FINANCE", name: "재무팀", sortOrder: 4, enabled: true, tenantScope: "TENANT" },
]

export default function CodesManagementPage() {
  const [activeTab, setActiveTab] = useState("groups")
  const [codeGroups, setCodeGroups] = useState<CodeGroup[]>(mockCodeGroups)
  const [codes, setCodes] = useState<Code[]>(mockCodes)

  const handleGroupCreated = (group: CodeGroup) => {
    setCodeGroups(prev => [...prev, group])
  }

  const handleGroupUpdated = (group: CodeGroup) => {
    setCodeGroups(prev => prev.map(g => g.id === group.id ? group : g))
  }

  const handleGroupDeleted = (groupId: string) => {
    setCodeGroups(prev => prev.filter(g => g.id !== groupId))
  }

  const handleCodeCreated = (code: Code) => {
    setCodes(prev => [...prev, code])
  }

  const handleCodeUpdated = (code: Code) => {
    setCodes(prev => prev.map(c => c.id === code.id ? code : c))
  }

  const handleCodeDeleted = (codeId: string) => {
    setCodes(prev => prev.filter(c => c.id !== codeId))
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Warning Banner */}
      <Alert className="mx-4 mt-4 border-amber-500/30 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-sm text-amber-500">
          코드 변경은 드롭다운 및 검증에 즉시 영향을 미칩니다. 운영 환경 변경 시 주의하세요.
        </AlertDescription>
      </Alert>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col p-4">
        <TabsList className="w-full max-w-md grid grid-cols-2">
          <TabsTrigger value="groups" className="gap-2">
            <Layers className="h-4 w-4" />
            Code Groups
          </TabsTrigger>
          <TabsTrigger value="codes" className="gap-2">
            <Tag className="h-4 w-4" />
            Codes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="flex-1 mt-4">
          <CodeGroupsTab
            groups={codeGroups}
            codes={codes}
            onCreated={handleGroupCreated}
            onUpdated={handleGroupUpdated}
            onDeleted={handleGroupDeleted}
          />
        </TabsContent>

        <TabsContent value="codes" className="flex-1 mt-4">
          <CodesTab
            groups={codeGroups}
            codes={codes}
            onCreated={handleCodeCreated}
            onUpdated={handleCodeUpdated}
            onDeleted={handleCodeDeleted}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
