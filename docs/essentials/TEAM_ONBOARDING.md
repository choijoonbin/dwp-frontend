# 팀 온보딩 및 Design System 적용 가이드

> **최종 업데이트**: 2026-01-22  
> **대상**: 신규 개발자, 기존 개발자, PM, 디자이너  
> **목적**: DWP Frontend 프로젝트의 개발 규칙과 Design System 적용 방법을 이해하고 실천

---

## 🎯 필수 읽기 (신규 개발자 1주차)

개발 시작 전에 **반드시** 아래 3개 문서를 읽어주세요:

### 1️⃣ [프로젝트 시작 가이드](./GETTING_STARTED.md) ⏱️ 15분
- 프로젝트 구조 이해
- 로컬 실행 방법
- 첫 페이지 만들기

---

### 2️⃣ [Design System](./DESIGN_SYSTEM.md) ⏱️ 30분
- **필독!** 공통 컴포넌트 카탈로그
- 8개 패턴 컴포넌트 사용법
- Theme 토큰 규칙

**핵심 규칙:**
```typescript
// ✅ GOOD: Design System 패턴 사용
import { FilterBar, DataTable, EmptyState } from '@dwp-frontend/design-system';

// ❌ BAD: MUI 직접 커스터마이징
import { TextField, Button } from '@mui/material';
<TextField sx={{ bgcolor: '#fff' }} /> // 하드코딩 색상 금지!
```

---

### 3️⃣ [Admin CRUD 표준](./ADMIN_CRUD_STANDARD.md) ⏱️ 30분
- CRUD 페이지 개발 표준 구조
- feature 폴더 분리 규칙
- QueryKey 네이밍 규칙

---

## 🚫 리뷰 Reject 조건 (절대 금지)

PR 리뷰 시 아래 항목이 발견되면 **즉시 Reject** 처리됩니다:

### ❌ 1. 비표준 UI 라이브러리 import

```typescript
// ❌ 금지
import { Button } from 'shadcn/ui';
import * as RadixUI from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';

// ✅ 허용
import { FilterBar, EmptyState } from '@dwp-frontend/design-system';
import { Iconify } from '@dwp-frontend/design-system';
```

**이유**: MUI v5 + Iconify가 프로젝트 표준입니다.

---

### ❌ 2. `components/ui` 폴더 생성

```bash
# ❌ 금지
apps/remotes/admin/src/components/ui/
apps/remotes/admin/src/pages/users/components/ui/

# ✅ 허용
libs/design-system/src/components/patterns/
apps/remotes/admin/src/pages/users/components/
```

**이유**: 공통 UI는 `libs/design-system`에만 배치합니다.

---

### ❌ 3. 하드코딩 색상/간격

```typescript
// ❌ 금지
<Box sx={{ bgcolor: '#1976d2', p: '16px', width: '320px' }}>

// ✅ 허용
<Box sx={{ bgcolor: 'primary.main', p: 2, width: { xs: '100%', sm: 320 } }}>
```

**이유**: Theme 토큰만 사용해야 일관성이 유지됩니다.

---

### ❌ 4. Page 파일 400줄 초과

```typescript
// ❌ 금지: page.tsx가 400줄 초과

// ✅ 허용: feature 폴더 분리
pages/users/
├── index.tsx         // 조립 only (< 150줄)
├── components/       // UI 조각 (각 < 250줄)
├── hooks/            // 상태/로직
├── adapters/         // DTO 변환
└── types.ts          // 타입 정의
```

**이유**: 유지보수성을 위해 파일 크기를 제한합니다.

---

### ❌ 5. Remote에서 MUI 직접 커스터마이징

```typescript
// ❌ 금지: Remote에서 MUI 직접 스타일링
const StyledButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#1976d2',
  '&:hover': { backgroundColor: '#1565c0' },
}));

// ✅ 허용: Design System 패턴 사용
import { FilterBar } from '@dwp-frontend/design-system';
```

**이유**: Design System이 Single Source of Truth입니다.

---

## 📋 PR 템플릿 체크리스트

PR 생성 시 자동으로 표시되는 체크리스트를 **반드시** 확인하세요:

```markdown
### UI/UX
- [ ] Design System 패턴 컴포넌트 사용 (@dwp-frontend/design-system)
- [ ] Theme 토큰만 사용 (하드코딩 색상/간격 없음)
- [ ] 반응형 검증 완료 (xs/sm/md breakpoint)
- [ ] 모바일에서 테이블 overflow 처리

### Code Quality
- [ ] Page 파일 400줄 이하
- [ ] Component 파일 250줄 이하
- [ ] feature 폴더 구조 준수 (index/components/hooks/adapters/types)
- [ ] ESLint/TypeScript 오류 없음

### Performance
- [ ] TanStack Query 사용 (서버 데이터)
- [ ] 불필요한 리렌더링 없음
```

---

## 🎨 Design System 패턴 적용 가이드

### 언제 어떤 패턴을 사용하나요?

| 상황 | 패턴 | Import |
|------|------|--------|
| 검색/필터 영역 | `FilterBar` | `@dwp-frontend/design-system` |
| 리스트 테이블 | `DataTable` | `@dwp-frontend/design-system` |
| 데이터 없음 상태 | `EmptyState` | `@dwp-frontend/design-system` |
| 생성/편집 모달 | `EditorModal` | `@dwp-frontend/design-system` |
| 삭제 확인 | `ConfirmDialog` | `@dwp-frontend/design-system` |
| 좌우 분할 레이아웃 | `TwoColumnLayout` | `@dwp-frontend/design-system` |
| 선택 가능한 카드 | `SelectableCard` | `@dwp-frontend/design-system` |
| 툴바 액션 버튼 | `ToolbarActions` | `@dwp-frontend/design-system` |

---

### 예시: Users 페이지 구조

```typescript
// apps/remotes/admin/src/pages/users/index.tsx
import { FilterBar, DataTable, EditorModal, ConfirmDialog, EmptyState } from '@dwp-frontend/design-system';

export const UsersPage = () => {
  return (
    <Box data-testid="page-admin-users" sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* 검색/필터 */}
        <FilterBar
          controls={<TextField placeholder="검색" />}
          actions={<Button>생성</Button>}
        />

        {/* 리스트 */}
        {users.length === 0 ? (
          <EmptyState
            icon="mdi:user-off"
            title="사용자가 없습니다"
            description="새 사용자를 추가해보세요"
          />
        ) : (
          <DataTable data={users} columns={columns} />
        )}
      </Stack>

      {/* 생성/편집 모달 */}
      <EditorModal
        open={modalOpen}
        title="사용자 추가"
        onClose={handleClose}
        onSubmit={handleSubmit}
      >
        {/* 폼 내용 */}
      </EditorModal>

      {/* 삭제 확인 */}
      <ConfirmDialog
        open={deleteOpen}
        title="사용자 삭제"
        message="정말 삭제하시겠습니까?"
        onConfirm={handleDelete}
        onCancel={handleCancel}
      />
    </Box>
  );
};
```

---

## 🔄 기존 페이지 마이그레이션 가이드

기존 Admin 페이지를 Design System 패턴으로 마이그레이션하는 방법:

### 1️⃣ 우선순위 확인

[마이그레이션 가이드](../reference/DESIGN_SYSTEM_MIGRATION.md)에서 현재 페이지의 우선순위(P0/P1/P2)를 확인하세요.

---

### 2️⃣ 패턴 적용

1. **Import 변경**
   ```typescript
   // Before
   import { TextField, Button, Card } from '@mui/material';
   
   // After
   import { FilterBar, DataTable } from '@dwp-frontend/design-system';
   ```

2. **컴포넌트 교체**
   - 검색/필터 → `FilterBar`
   - 리스트 → `DataTable`
   - 빈 상태 → `EmptyState`
   - 모달 → `EditorModal` / `ConfirmDialog`

3. **반응형 확인**
   - `xs/sm/md` breakpoint 검증
   - 테이블 `overflowX: auto` 처리

---

### 3️⃣ PR 생성

- **제목**: `refactor(admin): Apply Design System patterns to [페이지명]`
- **설명**: 적용한 패턴 목록 + 스크린샷 (Desktop + Mobile)
- **체크리스트**: PR 템플릿 모두 체크

---

## 📖 추가 참고 문서

### 필수 읽기 (이미 위에서 언급)
- [프로젝트 시작 가이드](./GETTING_STARTED.md)
- [Design System](./DESIGN_SYSTEM.md)
- [Admin CRUD 표준](./ADMIN_CRUD_STANDARD.md)

### 심화 학습
- [레이아웃 가이드](./LAYOUT_GUIDE.md) - Fixed/Scrollable 모드
- [Theme 토큰](./THEME_TOKENS.md) - 색상/간격 시스템
- [마이그레이션 가이드](../reference/DESIGN_SYSTEM_MIGRATION.md) - P0/P1/P2 우선순위
- [PR 체크리스트](../reference/PR_CHECKLIST_UI.md) - 상세 UI 리뷰 가이드
- [E2E 테스트](../reference/E2E_SMOKE_TESTS.md) - testid 규칙

---

## 🆘 도움이 필요하면?

### 질문하기 전에
1. [docs/README.md](../README.md)에서 "상황별 문서 찾기" 확인
2. [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)에서 컴포넌트 예시 확인
3. 기존 페이지 코드 참고 (예: `pages/users/`, `pages/roles/`)

### 그래도 모르겠다면
- 팀 채널에 질문 (코드 스니펫 포함)
- PR에 Draft로 올리고 리뷰 요청

---

## ✅ 온보딩 체크리스트

신규 개발자는 아래 체크리스트를 완료하세요:

### Week 1: 문서 읽기
- [ ] [GETTING_STARTED.md](./GETTING_STARTED.md) 읽음 (15분)
- [ ] [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) 읽음 (30분)
- [ ] [ADMIN_CRUD_STANDARD.md](./ADMIN_CRUD_STANDARD.md) 읽음 (30분)
- [ ] [LAYOUT_GUIDE.md](./LAYOUT_GUIDE.md) 읽음 (15분)
- [ ] 로컬 dev server 실행 성공 (`yarn dev`)

### Week 1: 실습
- [ ] 기존 Admin 페이지 코드 읽고 이해 (Users/Roles 중 1개)
- [ ] Design System 컴포넌트 사용해보기
- [ ] 간단한 CRUD 페이지 1개 만들어보기 (테스트)

### Week 2: 실전
- [ ] 실제 Feature 개발 시작
- [ ] PR 생성 및 리뷰 받기
- [ ] 리뷰 피드백 반영

---

## 📢 팀 공지 템플릿

PM/팀장이 팀 채널에 공지할 때 사용하세요:

```
📢 [DWP Frontend] Design System 적용 필수 안내

안녕하세요 팀 여러분,

프로젝트의 UI/UX 일관성과 유지보수성을 위해 
Design System 적용이 **필수**로 변경되었습니다.

📖 필수 읽기 (신규/기존 개발자 모두):
1. Design System: https://github.com/.../docs/essentials/DESIGN_SYSTEM.md
2. 마이그레이션 가이드: https://github.com/.../docs/reference/DESIGN_SYSTEM_MIGRATION.md
3. 팀 온보딩: https://github.com/.../docs/essentials/TEAM_ONBOARDING.md

🚫 PR Reject 조건:
- shadcn/radix/lucide import 사용
- components/ui 폴더 생성
- 하드코딩 색상/간격 (#, rgb, px 직접 입력)
- Page 파일 400줄 초과

✅ PR 체크리스트:
PR 생성 시 자동으로 표시되는 체크리스트를 반드시 확인해주세요.

궁금한 점은 팀 채널에 질문 부탁드립니다!
```

---

**Design System으로 일관된 UI를 만들어갑시다! 🎨**
