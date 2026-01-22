# Design System 마이그레이션 가이드

> **최종 업데이트**: 2026-01-22  
> **목적**: Admin 페이지를 Design System 패턴 기반으로 순차 마이그레이션

---

## 목차

1. [현황 및 목표](#현황-및-목표)
2. [Export 정책 (필수)](#export-정책-필수)
3. [마이그레이션 우선순위](#마이그레이션-우선순위)
4. [마이그레이션 수행 방식](#마이그레이션-수행-방식)
5. [체크리스트](#체크리스트)

---

## 현황 및 목표

### 🎯 목표

- **Single Source of Truth**: `libs/design-system`을 유일한 공통 UI 소스로 확정
- **Remote 독립 개발 금지**: MUI 직접 커스터마이징 차단, 패턴 재사용 강제
- **팀 전체 동일 UX**: 신규/기존 개발자 모두 동일한 패턴으로 개발

### 📊 현재 상태 (2026-01-22 기준)

| 페이지 | 상태 | 패턴 적용 | 비고 |
|--------|------|-----------|------|
| Roles | ✅ 완료 | TwoColumnLayout, EmptyState, ConfirmDialog | C04에서 EmptyState 마이그레이션 완료 |
| Users | ✅ 완료 | FilterBar, DataTable, EditorModal, ConfirmDialog | C05~C10에서 ConfirmDialog 적용 |
| Menus | ✅ 완료 | TwoColumnLayout, EmptyState, EditorModal | 좌측 트리 + 우측 상세 구조 |
| Monitoring | ✅ 완료 | FilterBar, DataTable, EmptyState | C11에서 Table overflow 수정 |
| Resources | 🔄 부분 적용 | FilterBar, EditorModal, ConfirmDialog | **P0: TwoColumnLayout 적용 필요** |
| Audit | 🔄 부분 적용 | FilterBar, DataTable | **P1: EmptyState 추가 필요** |
| Codes | 🔄 부분 적용 | EditorModal, ConfirmDialog | **P1: FilterBar 통일 필요** |
| Code Usages | 🔄 부분 적용 | FilterBar, EditorModal, ConfirmDialog | **P2: TwoColumnLayout 검토** |

---

## Export 정책 (필수)

### 1️⃣ 단일 import entry 제공

`libs/design-system/src/index.ts`에서 8개 패턴 컴포넌트를 모두 export 한다.

**✅ 현재 상태** (이미 적용 완료):
```typescript
// libs/design-system/src/index.ts
export * from './components';

// libs/design-system/src/components/index.ts
export * from './patterns';

// libs/design-system/src/components/patterns/index.ts
export * from './empty-state';
export * from './confirm-dialog';
export * from './selectable-card';
export * from './two-column-layout';
export * from './filter-bar';
export * from './toolbar-actions';
export * from './data-table';
export * from './editor-modal';
```

**✅ Remote에서 사용 방법**:
```typescript
// ✅ DO: 단일 entry로 import
import {
  EmptyState,
  ConfirmDialog,
  SelectableCard,
  TwoColumnLayout,
  FilterBar,
  ToolbarActions,
  DataTable,
  EditorModal,
} from '@dwp-frontend/design-system';
```

**❌ DON'T: 내부 경로 직접 import 금지**:
```typescript
// ❌ 내부 경로 직접 import 금지
import DataTable from 'libs/design-system/src/components/patterns/data-table';
import { EmptyState } from '@dwp-frontend/design-system/patterns/empty-state';
```

---

### 2️⃣ Naming 정책

- **PascalCase 통일**: 모든 패턴 컴포넌트는 `PascalCase`로 export
- **별칭 최소화**: Remote에서 `as` 별칭 사용 최소화
- **UI 패턴 이름 유지**: 도메인 의미가 아닌 UI 패턴 의미 중심
  - ✅ `DataTable` (UI 패턴)
  - ❌ `UserTable` (도메인 특화)

---

### 3️⃣ Token 우선 정책 (하드코딩 금지)

#### ✅ DO: 테마 토큰 사용
```typescript
<Box
  sx={{
    bgcolor: 'background.paper',   // ✅
    color: 'text.primary',          // ✅
    borderColor: 'divider',         // ✅
    p: 2,                           // ✅ theme.spacing(2)
    mb: { xs: 1, md: 2 },          // ✅ breakpoint 기반
  }}
>
```

#### ❌ DON'T: 하드코딩 금지
```typescript
<Box
  sx={{
    bgcolor: '#ffffff',             // ❌ 하드코딩
    color: '#000000',               // ❌ 하드코딩
    borderColor: '#e0e0e0',         // ❌ 하드코딩
    padding: '16px',                // ❌ 고정 px
    marginBottom: '8px',            // ❌ 고정 px
    width: '320px',                 // ❌ breakpoint 없음
  }}
>
```

**참고**: `docs/essentials/THEME_TOKENS.md`

---

### 4️⃣ components/ui 폴더 생성 금지

Remote 내부에 `components/ui` 폴더 생성은 절대 금지한다.

**이유**:
- shadcn/ui 스타일의 로컬 UI 폴더는 Design System과 중복
- Single Source of Truth 원칙 위반
- 팀 간 UI 불일치 발생

**대안**:
1. **공통 컴포넌트**: `libs/design-system`에 추가
2. **Feature 전용 컴포넌트**: `pages/<feature>/components/`에 배치

---

## 마이그레이션 우선순위

### 기준

1. **변경 빈도**: 운영에서 자주 수정되는 화면
2. **운영 리스크**: RBAC 핵심 또는 사용자 관리
3. **재사용성**: 1회 수정으로 다른 화면에 재사용 가능
4. **파일 크기**: 400줄에 가까운 파일 우선

---

### P0: 최우선 (2주 내 완료)

#### 1. Resources (리소스 관리)

**이유**:
- RBAC 핵심 (리소스 타입/액션 관리)
- 향후 확장 가능성 높음
- 현재 Custom Grid 사용 → TwoColumnLayout 전환 필요

**목표 패턴**:
- ✅ TwoColumnLayout (좌측 트리 + 우측 상세)
- ✅ FilterBar (상단 검색/필터)
- ✅ EmptyState (데이터 없음)
- ✅ EditorModal (생성/편집)
- ✅ ConfirmDialog (삭제 확인)

**파일 크기**: 245줄 (안전)

**작업 범위**:
1. TwoColumnLayout 적용 (좌측 ResourcesTree + 우측 상세)
2. EmptyState 통일
3. FilterBar 반응형 개선

---

#### 2. Roles (권한 관리)

**이유**:
- RBAC 핵심 (권한 매트릭스)
- 가장 복잡한 UI (권한 매트릭스 + 멤버 관리)
- 이미 EmptyState 적용됨 (C04)

**현재 상태**:
- ✅ TwoColumnLayout 적용
- ✅ EmptyState 적용 (C04)
- ✅ ConfirmDialog 적용
- ⚠️ Permission Matrix 컴포넌트 크기 큼 (재검토 필요)

**파일 크기**: 238줄 (안전)

**작업 범위**:
1. Permission Matrix 컴포넌트 분리 검토 (250줄 초과 시)
2. SelectableCard 패턴 명시적 적용
3. 문서 업데이트

---

#### 3. Users (사용자 관리)

**이유**:
- 운영에서 가장 자주 사용
- 모바일 대응 중요
- 이미 ConfirmDialog 적용됨 (C05~C10)

**현재 상태**:
- ✅ FilterBar 적용
- ✅ DataTable 패턴 (모바일 Card 변환)
- ✅ EditorModal 적용
- ✅ ConfirmDialog 적용 (C05~C10)

**파일 크기**: 348줄 (안전)

**작업 범위**:
1. 반응형 검증 (xs/sm/md)
2. 문서 업데이트

---

### P1: 높음 (1개월 내 완료)

#### 4. Audit (감사 로그)

**이유**:
- 조회 전용이지만 데이터 양 많음
- 필터/검색/정렬 복잡
- 현재 FilterBar 적용됨

**현재 상태**:
- ✅ FilterBar 적용
- ✅ DataTable 패턴
- ⚠️ EmptyState 추가 필요

**파일 크기**: 204줄 (안전)

**작업 범위**:
1. EmptyState 추가
2. Table overflow 검증
3. Drawer 반응형 개선

---

#### 5. Monitoring (통합 모니터링)

**이유**:
- 실시간 데이터 조회
- 차트/테이블 혼합
- 이미 FilterBar + Table overflow 수정 완료 (C11)

**현재 상태**:
- ✅ FilterBar 적용
- ✅ DataTable 패턴
- ✅ Table overflow 수정 (C11)
- ✅ EmptyState 패턴

**파일 크기**: 295줄 (안전)

**작업 범위**:
1. 반응형 검증 (xs/sm/md)
2. 문서 업데이트

---

#### 6. Codes (코드 관리)

**이유**:
- 탭 구조 (Code Groups + Codes)
- 현재 EditorModal + ConfirmDialog 적용

**현재 상태**:
- ✅ EditorModal 적용
- ✅ ConfirmDialog 적용
- ⚠️ FilterBar 통일 필요

**파일 크기**: 101줄 (매우 안전)

**작업 범위**:
1. FilterBar 통일
2. EmptyState 추가

---

### P2: 보통 (2개월 내 완료)

#### 7. Code Usages (코드 사용 정의)

**이유**:
- 운영 도구지만 사용 빈도 낮음
- 현재 FilterBar + EditorModal 적용

**현재 상태**:
- ✅ FilterBar 적용
- ✅ EditorModal 적용
- ✅ ConfirmDialog 적용
- ⚠️ TwoColumnLayout 검토 (좌측 리소스 메뉴 + 우측 코드 그룹)

**파일 크기**: 337줄 (안전)

**작업 범위**:
1. TwoColumnLayout 적용 검토
2. EmptyState 추가

---

#### 8. Menus (메뉴 관리)

**이유**:
- 이미 TwoColumnLayout 적용 완료
- 신규 메뉴 등록은 드물지만 확장 가능성 있음

**현재 상태**:
- ✅ TwoColumnLayout 적용
- ✅ EmptyState 적용
- ✅ EditorModal 적용

**파일 크기**: 386줄 (⚠️ 400줄에 가까움)

**작업 범위**:
1. 반응형 검증
2. 파일 분리 검토 (400줄 가까움)
3. 문서 업데이트

---

## 마이그레이션 수행 방식

### 1️⃣ 리팩토링 PR은 기능 변경 금지

**원칙**:
- UI/동작 동일 유지
- 구조/폴더/패턴 전환만 수행
- 예외: 타입 오류/명백한 버그 수정만 허용

**예시**:
```
❌ BAD: 리팩토링 PR에 "필터 기능 추가"
✅ GOOD: 리팩토링 PR은 구조만 변경, 기능은 별도 PR
```

---

### 2️⃣ Feature Folder 구조 강제

```
apps/remotes/admin/src/pages/<feature>/
├── index.tsx              # PermissionRouteGuard + 라우트 엔트리
├── page.tsx               # Orchestration (조립만, 400줄 이하)
├── types.ts               # Feature 전용 타입
├── adapters/              # DTO ↔ UI model 변환
│   ├── <feature>-adapters.ts
│   └── <feature>-mappers.ts
├── hooks/                 # 상태/비즈니스 로직
│   ├── use-<feature>-table-state.ts
│   └── use-<feature>-actions.ts
└── components/            # 표시 컴포넌트 (250줄 이하)
    ├── <feature>-list-panel.tsx
    └── <feature>-detail-panel.tsx
```

**파일 크기 제한**:
- `page.tsx`: 400줄 이하
- `components/*.tsx`: 250줄 이하

**초과 시 조치**:
1. 로직 → `hooks/` 분리
2. 컴포넌트 → `components/` 분리
3. 유틸리티 → `adapters/` 분리

---

### 3️⃣ 점진적 마이그레이션

**단계별 접근**:
1. **Phase 1**: 새로 건드리는 화면부터 패턴 적용
2. **Phase 2**: P0 화면 순차 마이그레이션
3. **Phase 3**: P1/P2 화면 점진적 개선

**기능 개발과의 균형**:
- 새 기능 개발 > 마이그레이션 우선순위
- 단, 새 기능 개발 시 반드시 패턴 사용
- 기존 화면 수정 시 패턴으로 전환

---

### 4️⃣ 코드 리뷰 체크포인트

마이그레이션 PR 리뷰 시 반드시 확인:

1. **Import 경로**:
   - ✅ `@dwp-frontend/design-system` 사용
   - ❌ MUI 직접 커스터마이징

2. **Token 사용**:
   - ✅ `theme.palette.*`, `theme.spacing()`
   - ❌ 하드코딩 색상 (`#`, `rgb()`)

3. **Breakpoint**:
   - ✅ `direction={{ xs: 'column', md: 'row' }}`
   - ❌ `window.innerWidth` 직접 사용

4. **파일 크기**:
   - ✅ Page: 400줄 이하, Component: 250줄 이하
   - ❌ 초과 시 분리 요청

---

## 체크리스트

### ✅ 마이그레이션 완료 기준 (PR Merge 조건)

- [ ] **Import 경로**:
  - [ ] `@dwp-frontend/design-system`에서 패턴 컴포넌트 import
  - [ ] MUI 직접 커스터마이징 제거 (기존 코드 정리)
  - [ ] `components/ui` 폴더 없음

- [ ] **Token 사용**:
  - [ ] 색상은 `theme.palette.*`만 사용
  - [ ] spacing은 `theme.spacing()` 또는 `p: 2` 사용
  - [ ] 하드코딩 색상 없음 (`#`, `rgb()`, `rgba()` 검색)

- [ ] **반응형**:
  - [ ] xs (320px), sm (600px), md (960px) 모두 확인
  - [ ] 테이블 overflow 처리 (`overflowX: auto`)
  - [ ] Breakpoint 기반 레이아웃 (`direction={{ xs: 'column', md: 'row' }}`)
  - [ ] 터치 타겟 최소 44x44px

- [ ] **파일 크기**:
  - [ ] `page.tsx`: 400줄 이하
  - [ ] `components/*.tsx`: 250줄 이하
  - [ ] 초과 시 분리 완료

- [ ] **문서화**:
  - [ ] `docs/essentials/DESIGN_SYSTEM.md` 업데이트 (새 패턴 추가 시)
  - [ ] `docs/reference/DESIGN_SYSTEM_MIGRATION.md` 체크리스트 업데이트

- [ ] **테스트**:
  - [ ] 빌드 성공 (`yarn build`)
  - [ ] Lint 통과 (`yarn lint`)
  - [ ] Type 체크 통과 (`yarn typecheck`)
  - [ ] UI/동작 동일 (스크린샷 첨부)

- [ ] **data-testid**:
  - [ ] Page root에 `data-testid` 속성 추가 (향후 E2E 테스트용)

---

## 참고 문서

- **[디자인 시스템 가이드](../essentials/DESIGN_SYSTEM.md)**: 패턴 컴포넌트 상세 설명
- **[Admin CRUD 표준](../essentials/ADMIN_CRUD_STANDARD.md)**: Feature Folder 구조
- **[레이아웃 가이드](../essentials/LAYOUT_GUIDE.md)**: Fixed/Scrollable 모드
- **[테마 토큰](../essentials/THEME_TOKENS.md)**: 색상/간격 표준
- **[PR 체크리스트](./PR_CHECKLIST_UI.md)**: UI 개발자용 상세 가이드

---

## 진행 현황 (업데이트: 2026-01-22)

| 우선순위 | 페이지 | 상태 | 담당자 | 완료일 |
|---------|--------|------|--------|--------|
| P0 | Resources | 🔄 진행 중 | - | - |
| P0 | Roles | ✅ 완료 | - | 2026-01-22 |
| P0 | Users | ✅ 완료 | - | 2026-01-22 |
| P1 | Audit | 🔄 대기 | - | - |
| P1 | Monitoring | ✅ 완료 | - | 2026-01-22 |
| P1 | Codes | 🔄 대기 | - | - |
| P2 | Code Usages | 🔄 대기 | - | - |
| P2 | Menus | ✅ 완료 | - | 2026-01-22 |

---

## 문의

마이그레이션 관련 질문이 있다면:
1. `docs/README.md`에서 관련 문서 확인
2. `.cursorrules` 검색
3. 팀 채널에 질문

---

**일관된 Design System 적용으로 장기 유지보수성을 확보합시다! 🎯**
