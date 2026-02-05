# Admin 하드코딩 문자열 i18n 후보 리스트

> **목적**: 다음 라운드에서 전수 치환(페이지 타이틀/필터/버튼) 시 참고용 리스트업
> **우선순위**: P0(필수) > P1(권장) > P2(선택)

---

## 1. Admin — 페이지 타이틀/헤더

| 문자열 | 파일 경로 | 컴포넌트 | 제안 키 | 우선순위 |
|--------|-----------|----------|---------|----------|
| 사용자 관리 | `pages/users/index.tsx` | UsersPageContent | `admin.users.title` | P0 |
| 시스템 사용자 목록 및 권한을 관리합니다. | `pages/users/index.tsx` | UsersPageContent | `admin.users.subtitle` | P1 |
| 사용자 추가 | `pages/users/index.tsx` | Button | `admin.users.addButton` | P0 |
| 코드 관리 | `pages/codes/page.tsx` | CodesPageContent | `admin.codes.title` | P0 |
| 시스템 코드 그룹 및 코드를 관리합니다. | `pages/codes/page.tsx` | CodesPageContent | `admin.codes.subtitle` | P1 |
| 코드 변경은 드롭다운 및 검증에 즉시 영향을 미칩니다... | `pages/codes/page.tsx` | Alert | `admin.codes.warning` | P1 |
| 코드 그룹 | `pages/codes/page.tsx` | Tab | `admin.codes.tabCodeGroups` | P0 |
| 코드 | `pages/codes/page.tsx` | Tab | `admin.codes.tabCodes` | P0 |
| 권한 그룹 관리 | `pages/roles/roles-screen-redesign/app/page.tsx` | RolesPage | `admin.roles.subtitle` | P0 |
| Roles | `pages/roles/roles-screen-redesign/app/page.tsx` | RolesPage | `admin.roles.title` | P0 |
| DWP Admin | `pages/roles/roles-screen-redesign/app/page.tsx` | Badge | `admin.badge` | P2 |

---

## 2. Admin — 필터/검색

| 문자열 | 파일 경로 | 컴포넌트 | 제안 키 | 우선순위 |
|--------|-----------|----------|---------|----------|
| 검색 | `pages/codes/components/code-groups-tab.tsx` | TextField label | `common.search` | P0 |
| 검색 | `pages/codes/components/codes-tab.tsx` | TextField label | `common.search` | P0 |
| 검색 (이름/이메일) | `pages/users/components/users-filters.tsx` | TextField label | `admin.users.searchPlaceholder` | P0 |
| 검색 (역할명/코드) | `pages/roles/components/roles-filter-bar.tsx` | TextField label | `admin.roles.searchPlaceholder` | P0 |
| 검색 | `pages/resources/components/resources-filters.tsx` | TextField label | `common.search` | P0 |
| 검색 (Action / Label / Path) | `pages/monitoring/monitoring-tabs.tsx` | TextField label | `admin.monitoring.searchPlaceholder` | P0 |
| 검색 (Visitor ID / Path) | `pages/monitoring/monitoring-tabs.tsx` | TextField label | `admin.monitoring.searchVisitorPlaceholder` | P0 |
| 메뉴 검색 (이름, 키, 경로) | `pages/menus/components/menu-tree-panel.tsx` | TextField placeholder | `admin.menus.searchPlaceholder` | P0 |
| 권한명 또는 코드 검색... | `pages/roles/components/role-list-panel.tsx` | TextField placeholder | `admin.roles.searchRolePlaceholder` | P0 |
| 리소스 검색... | `pages/roles/components/role-permissions-dialog.tsx` | TextField placeholder | `admin.roles.resourceSearchPlaceholder` | P0 |
| 메뉴 검색 | `pages/code-usages/components/resource-menu-list.tsx` | TextField label | `admin.codeUsages.menuSearch` | P0 |
| 코드 키, 코드명, 코드 값, 설명 | `pages/codes/components/codes-tab.tsx` | TextField placeholder | `admin.codes.searchPlaceholder` | P0 |

---

## 3. Admin — 스코프/상태 라벨

| 문자열 | 파일 경로 | 컴포넌트 | 제안 키 | 우선순위 |
|--------|-----------|----------|---------|----------|
| 스코프 | `pages/codes/components/code-groups-tab.tsx` | Select label | `admin.codes.scope` | P0 |
| 스코프 | `pages/codes/components/codes-tab.tsx` | Select label | `admin.codes.scope` | P0 |
| 스코프 * | `pages/codes/components/code-group-editor-modal.tsx` | Select label | `admin.codes.scopeRequired` | P0 |
| 스코프 * | `pages/codes/components/code-editor-modal.tsx` | Select label | `admin.codes.scopeRequired` | P0 |
| 공통 | `pages/codes/components/code-groups-tab.tsx` | Chip label | `admin.codes.scopeCommon` | P0 |
| 테넌트 | `pages/codes/components/code-groups-tab.tsx` | Chip label | `admin.codes.scopeTenant` | P0 |
| 활성 | `pages/codes/components/code-groups-tab.tsx` | Chip label | `common.statusActive` | P0 |
| 비활성 | `pages/codes/components/code-groups-tab.tsx` | Chip label | `common.statusInactive` | P0 |
| 활성화만 | `pages/codes/components/code-groups-tab.tsx` | Checkbox label | `admin.codes.filterEnabledOnly` | P0 |
| 전체 | `pages/batch/components/batch-runs-filter-bar.tsx` | Select option | `common.all` | P0 |
| 전체 | `pages/roles/roles-screen-redesign/components/roles/permission-matrix.tsx` | Option | `common.all` | P0 |
| 전체 | `pages/roles/components/role-permission-matrix-tab.tsx` | Select option | `common.all` | P0 |
| 메뉴 | `pages/roles/components/role-permission-matrix-tab.tsx` | Select option | `admin.roles.resourceTypeMenu` | P0 |
| 컴포넌트 | `pages/roles/roles-screen-redesign/components/roles/permission-matrix.tsx` | Option | `admin.roles.resourceTypeComponent` | P0 |

---

## 4. Admin — 다이얼로그/모달

| 문자열 | 파일 경로 | 컴포넌트 | 제안 키 | 우선순위 |
|--------|-----------|----------|---------|----------|
| 권한 추가 | `pages/roles/components/role-editor-modal.tsx` | DialogTitle | `admin.roles.addRole` | P0 |
| 권한 편집 | `pages/roles/components/role-editor-modal.tsx` | DialogTitle | `admin.roles.editRole` | P0 |
| 권한명 * | `pages/roles/components/role-editor-modal.tsx` | TextField label | `admin.roles.roleNameRequired` | P0 |
| 권한 코드 * | `pages/roles/components/role-editor-modal.tsx` | TextField label | `admin.roles.roleCodeRequired` | P0 |
| 리소스 추가 | `pages/resources/components/resource-editor-modal.tsx` | DialogTitle | `admin.resources.addResource` | P0 |
| 리소스 편집 | `pages/resources/components/resource-editor-modal.tsx` | DialogTitle | `admin.resources.editResource` | P0 |
| 리소스명 * | `pages/resources/components/resource-editor-modal.tsx` | TextField label | `admin.resources.resourceNameRequired` | P0 |
| 리소스 키 * | `pages/resources/components/resource-editor-modal.tsx` | TextField label | `admin.resources.resourceKeyRequired` | P0 |
| 코드 그룹 추가 | `pages/codes/components/code-group-editor-modal.tsx` | DialogTitle | `admin.codes.addCodeGroup` | P0 |
| 코드 그룹 편집 | `pages/codes/components/code-group-editor-modal.tsx` | DialogTitle | `admin.codes.editCodeGroup` | P0 |
| 코드 추가 | `pages/codes/components/code-editor-modal.tsx` | DialogTitle | `admin.codes.addCode` | P0 |
| 코드 편집 | `pages/codes/components/code-editor-modal.tsx` | DialogTitle | `admin.codes.editCode` | P0 |
| 메뉴를 선택하세요 | `pages/code-usages/components/code-groups-panel.tsx` | Typography | `admin.codeUsages.selectMenu` | P0 |
| 그룹 추가 | `pages/code-usages/components/code-groups-panel.tsx` | Button | `admin.codeUsages.addGroup` | P0 |
| 리소스를 선택하세요 | `pages/resources/components/resource-detail-panel.tsx` | title | `admin.resources.selectResource` | P0 |
| 권한을 선택하세요 | `pages/roles/components/role-detail-panel.tsx` | title | `admin.roles.selectRole` | P0 |

---

## 5. Admin — 토스트/스낵바 메시지

| 문자열 | 파일 경로 | 컴포넌트 | 제안 키 | 우선순위 |
|--------|-----------|----------|---------|----------|
| 권한 생성 | `pages/roles/hooks/use-role-actions.ts` | toast label | `admin.roles.toastCreate` | P0 |
| 권한 수정 | `pages/roles/hooks/use-role-actions.ts` | toast label | `admin.roles.toastUpdate` | P0 |
| 권한 삭제 | `pages/roles/hooks/use-role-actions.ts` | toast label | `admin.roles.toastDelete` | P0 |
| 메뉴 생성 | `pages/menus/hooks/use-menu-actions.ts` | toast label | `admin.menus.toastCreate` | P0 |
| 메뉴 수정 | `pages/menus/hooks/use-menu-actions.ts` | toast label | `admin.menus.toastUpdate` | P0 |
| 메뉴 삭제 | `pages/menus/hooks/use-menu-actions.ts` | toast label | `admin.menus.toastDelete` | P0 |
| 리소스 생성 | `pages/resources/hooks/use-resource-actions.ts` | toast label | `admin.resources.toastCreate` | P0 |
| 리소스 수정 | `pages/resources/hooks/use-resource-actions.ts` | toast label | `admin.resources.toastUpdate` | P0 |
| 리소스 삭제 | `pages/resources/hooks/use-resource-actions.ts` | toast label | `admin.resources.toastDelete` | P0 |
| 코드 사용 매핑 관리 | `pages/code-usages/page.tsx` | toast label | `admin.codeUsages.toastManage` | P0 |
| 권한이 저장되었습니다. | `pages/roles/components/role-permissions-dialog.tsx` | snackbar | `admin.roles.saved` | P0 |
| 코드 로딩 중... | 여러 파일 | helperText | `common.codesLoading` | P0 |
| 코드 매핑 필요 | 여러 파일 | helperText | `common.codesMappingRequired` | P0 |

---

## 6. Admin — 유효성 검사 메시지

| 문자열 | 파일 경로 | 컴포넌트 | 제안 키 | 우선순위 |
|--------|-----------|----------|---------|----------|
| 권한명을 입력하세요. | `pages/roles/hooks/use-role-editor-state.ts` | validation | `admin.roles.validation.roleName` | P0 |
| 권한 코드를 입력하세요. | `pages/roles/hooks/use-role-editor-state.ts` | validation | `admin.roles.validation.roleCode` | P0 |
| 메뉴 키를 입력하세요. | `pages/menus/hooks/use-menu-editor-state.ts` | validation | `admin.menus.validation.menuKey` | P0 |
| 메뉴명을 입력하세요. | `pages/menus/hooks/use-menu-editor-state.ts` | validation | `admin.menus.validation.menuName` | P0 |
| 리소스명을 입력하세요. | `pages/resources/hooks/use-resource-editor-state.ts` | validation | `admin.resources.validation.resourceName` | P0 |
| 리소스 키를 입력하세요. | `pages/resources/hooks/use-resource-editor-state.ts` | validation | `admin.resources.validation.resourceKey` | P0 |
| 코드는 영문 대문자로 시작하고... | `pages/roles/roles-screen-redesign/components/roles/create-role-dialog.tsx` | validation | `admin.roles.validation.codeFormat` | P0 |

---

## 7. Admin — 빈 상태/에러 메시지

| 문자열 | 파일 경로 | 컴포넌트 | 제안 키 | 우선순위 |
|--------|-----------|----------|---------|----------|
| 검색 결과가 없습니다. | `pages/menus/components/menu-tree-panel.tsx` | empty state | `common.noSearchResults` | P0 |
| 메뉴가 없습니다. | `pages/menus/components/menu-tree-panel.tsx` | empty state | `admin.menus.empty` | P0 |
| 할당된 멤버가 없습니다 | `pages/roles/components/role-members-tab.tsx` | empty state | `admin.roles.noMembers` | P0 |
| 검색 결과가 없습니다 | `pages/roles/roles-screen-redesign/components/roles/role-members.tsx` | empty state | `common.noSearchResults` | P0 |
| 리소스가 없습니다. | `pages/roles/components/role-permissions-dialog.tsx` | empty state | `admin.roles.noResources` | P0 |
| 변경된 리소스가 없습니다. | `pages/roles/components/role-permissions-dialog.tsx` | empty state | `admin.roles.noChangedResources` | P0 |
| 검색 조건을 변경하거나 기간을 확대해보세요. | `pages/audit/components/audit-logs-table.tsx` | empty description | `admin.audit.noResultsHint` | P0 |

---

## 8. SynapseX — 주요 하드코딩 문자열 (요약)

| 문자열 | 파일 경로 | 제안 키 | 우선순위 |
|--------|-----------|---------|----------|
| 전체 | `entities/components/entities-filter-bar.tsx` | `common.all` | P0 |
| 검색 (이름/코드) | `entities/components/entities-filter-bar.tsx` | `synapsex.entities.searchPlaceholder` | P0 |
| 전체 선택 | `admin/tenant-scope/components/catalog-add-dialog.tsx` | `common.selectAll` | P0 |
| Filtered by Case | `actions/index.tsx` | `synapsex.actions.filteredByCase` | P1 |
| 승인 필요 | `actions/index.tsx` | `synapsex.actions.approvalRequired` | P0 |
| Search actions... | `actions/index.tsx` | `synapsex.actions.searchPlaceholder` | P0 |
| Overview, Change Log, Related, Access Control | `entity-detail.tsx` | `synapsex.entity.tabs.*` | P1 |
| Add Currencies, Add Company Codes | `admin/tenant-scope/components/*.tsx` | `synapsex.admin.addCurrencies` 등 | P1 |

---

## 9. 다음 라운드 작업 가이드

1. **번역 리소스 파일**: `libs/shared-i18n/src/locales/ko.json`, `en.json`에 위 제안 키 추가
2. **치환 순서**: P0 → P1 → P2
3. **패턴**: `const { t } = useTranslation();` → `t('admin.users.title')`
4. **코드 매핑 필요/코드 로딩 중**: `common.codesLoading`, `common.codesMappingRequired` 등 공통 키 우선 적용
