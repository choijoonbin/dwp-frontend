import type { Role, Member, Resource, Permission, PermissionCode } from "./types";

export const mockRoles: Role[] = [
  {
    id: "1",
    name: "시스템 관리자",
    code: "SYSTEM_ADMIN",
    status: "ACTIVE",
    description: "모든 시스템 기능에 대한 전체 권한을 보유한 최고 관리자 역할",
    memberCount: 3,
    departmentCount: 1,
    createdAt: "2024-01-15T09:00:00Z",
    updatedAt: "2025-01-20T14:30:00Z",
    updatedBy: "admin@company.com",
  },
  {
    id: "2",
    name: "운영 관리자",
    code: "OPERATION_ADMIN",
    status: "ACTIVE",
    description: "일반 운영 업무를 담당하는 관리자 역할",
    memberCount: 12,
    departmentCount: 3,
    createdAt: "2024-02-20T10:00:00Z",
    updatedAt: "2025-01-19T11:20:00Z",
    updatedBy: "manager@company.com",
  },
  {
    id: "3",
    name: "뷰어",
    code: "VIEWER",
    status: "ACTIVE",
    description: "조회 권한만 보유한 읽기 전용 역할",
    memberCount: 45,
    departmentCount: 8,
    createdAt: "2024-03-10T08:00:00Z",
    updatedAt: "2025-01-18T16:45:00Z",
  },
  {
    id: "4",
    name: "콘텐츠 관리자",
    code: "CONTENT_MANAGER",
    status: "ACTIVE",
    description: "콘텐츠 생성 및 편집 권한을 보유한 역할",
    memberCount: 8,
    departmentCount: 2,
    createdAt: "2024-04-05T11:00:00Z",
    updatedAt: "2025-01-17T09:15:00Z",
  },
  {
    id: "5",
    name: "레거시 관리자",
    code: "LEGACY_ADMIN",
    status: "INACTIVE",
    description: "더 이상 사용되지 않는 이전 버전 관리자 역할",
    memberCount: 0,
    departmentCount: 0,
    createdAt: "2023-06-15T14:00:00Z",
    updatedAt: "2024-12-01T10:00:00Z",
  },
  {
    id: "6",
    name: "보안 관리자",
    code: "SECURITY_ADMIN",
    status: "ACTIVE",
    description: "보안 설정 및 감사 로그 관리 권한",
    memberCount: 2,
    departmentCount: 1,
    createdAt: "2024-05-20T09:30:00Z",
    updatedAt: "2025-01-15T13:00:00Z",
  },
];

export const mockMembers: Member[] = [
  { id: "u1", type: "USER", name: "김철수", code: "U001", email: "kim.cs@company.com", department: "IT팀" },
  { id: "u2", type: "USER", name: "이영희", code: "U002", email: "lee.yh@company.com", department: "운영팀" },
  { id: "u3", type: "USER", name: "박지민", code: "U003", email: "park.jm@company.com", department: "보안팀" },
  { id: "u4", type: "USER", name: "최수진", code: "U004", email: "choi.sj@company.com", department: "개발팀" },
  { id: "u5", type: "USER", name: "정민호", code: "U005", email: "jung.mh@company.com", department: "기획팀" },
  { id: "d1", type: "DEPARTMENT", name: "IT팀", code: "D001" },
  { id: "d2", type: "DEPARTMENT", name: "운영팀", code: "D002" },
  { id: "d3", type: "DEPARTMENT", name: "보안팀", code: "D003" },
];

export const mockResources: Resource[] = [
  {
    id: "r1",
    name: "대시보드",
    code: "DASHBOARD",
    type: "MENU",
    children: [
      { id: "r1-1", name: "메인 대시보드", code: "DASHBOARD_MAIN", type: "MENU", parentId: "r1" },
      { id: "r1-2", name: "통계 위젯", code: "DASHBOARD_STATS", type: "UI_COMPONENT", parentId: "r1" },
    ],
  },
  {
    id: "r2",
    name: "사용자 관리",
    code: "USER_MGMT",
    type: "MENU",
    children: [
      { id: "r2-1", name: "사용자 목록", code: "USER_LIST", type: "MENU", parentId: "r2" },
      { id: "r2-2", name: "사용자 상세", code: "USER_DETAIL", type: "MENU", parentId: "r2" },
      { id: "r2-3", name: "가입 승인 버튼", code: "USER_APPROVE_BTN", type: "UI_COMPONENT", parentId: "r2" },
    ],
  },
  {
    id: "r3",
    name: "권한 관리",
    code: "ROLE_MGMT",
    type: "MENU",
    children: [
      { id: "r3-1", name: "역할 목록", code: "ROLE_LIST", type: "MENU", parentId: "r3" },
      { id: "r3-2", name: "역할 편집", code: "ROLE_EDIT", type: "MENU", parentId: "r3" },
      { id: "r3-3", name: "권한 매트릭스", code: "PERM_MATRIX", type: "UI_COMPONENT", parentId: "r3" },
    ],
  },
  {
    id: "r4",
    name: "콘텐츠 관리",
    code: "CONTENT_MGMT",
    type: "MENU",
    children: [
      { id: "r4-1", name: "게시물 관리", code: "POST_MGMT", type: "MENU", parentId: "r4" },
      { id: "r4-2", name: "미디어 라이브러리", code: "MEDIA_LIB", type: "MENU", parentId: "r4" },
    ],
  },
  {
    id: "r5",
    name: "설정",
    code: "SETTINGS",
    type: "MENU",
    children: [
      { id: "r5-1", name: "시스템 설정", code: "SYS_SETTINGS", type: "MENU", parentId: "r5" },
      { id: "r5-2", name: "알림 설정", code: "NOTI_SETTINGS", type: "MENU", parentId: "r5" },
      { id: "r5-3", name: "백업/복원", code: "BACKUP_RESTORE", type: "MENU", parentId: "r5" },
    ],
  },
];

export const mockPermissionCodes: PermissionCode[] = [
  { id: "p1", code: "VIEW", name: "조회", description: "데이터 조회 권한" },
  { id: "p2", code: "CREATE", name: "생성", description: "데이터 생성 권한" },
  { id: "p3", code: "EDIT", name: "수정", description: "데이터 수정 권한" },
  { id: "p4", code: "DELETE", name: "삭제", description: "데이터 삭제 권한" },
  { id: "p5", code: "EXPORT", name: "내보내기", description: "데이터 내보내기 권한" },
];

// Generate initial permissions for a role
export function generateInitialPermissions(roleId: string): Permission[] {
  const permissions: Permission[] = [];
  const allResources = flattenResources(mockResources);

  allResources.forEach((resource) => {
    mockPermissionCodes.forEach((permCode) => {
      // Set some default permissions based on role
      let value: Permission["value"] = null;
      if (roleId === "1") {
        value = "ALLOW"; // System admin has all permissions
      } else if (roleId === "3" && permCode.code === "VIEW") {
        value = "ALLOW"; // Viewer only has view permission
      }

      permissions.push({
        resourceId: resource.id,
        permissionCodeId: permCode.id,
        value,
        isDirty: false,
      });
    });
  });

  return permissions;
}

export function flattenResources(resources: Resource[]): Resource[] {
  const result: Resource[] = [];

  function traverse(items: Resource[]) {
    items.forEach((item) => {
      result.push(item);
      if (item.children) {
        traverse(item.children);
      }
    });
  }

  traverse(resources);
  return result;
}

// Searchable members for autocomplete
export const searchableMembers: Member[] = [
  ...mockMembers,
  { id: "u6", type: "USER", name: "한소희", code: "U006", email: "han.sh@company.com", department: "마케팅팀" },
  { id: "u7", type: "USER", name: "강다니엘", code: "U007", email: "kang.dn@company.com", department: "영업팀" },
  { id: "u8", type: "USER", name: "손예진", code: "U008", email: "son.yj@company.com", department: "HR팀" },
  { id: "d4", type: "DEPARTMENT", name: "마케팅팀", code: "D004" },
  { id: "d5", type: "DEPARTMENT", name: "영업팀", code: "D005" },
  { id: "d6", type: "DEPARTMENT", name: "HR팀", code: "D006" },
];
