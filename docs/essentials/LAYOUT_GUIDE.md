# 레이아웃 모드 가이드

**최종 업데이트**: 2026-01-22

DWP Frontend는 페이지의 성격에 따라 두 가지 레이아웃 모드를 지원합니다. 이 문서는 각 모드의 특징과 사용 방법을 설명합니다.

---

## 📋 목차

1. [레이아웃 모드 개요](#레이아웃-모드-개요)
2. [Fixed 모드 (Full-Height SPA)](#fixed-모드-full-height-spa)
3. [Scrollable 모드 (기본값)](#scrollable-모드-기본값)
4. [모드 선택 기준](#모드-선택-기준)
5. [새 페이지 추가 시 설정 방법](#새-페이지-추가-시-설정-방법)
6. [트러블슈팅](#트러블슈팅)

---

## 레이아웃 모드 개요

### 두 가지 모드

| 모드 | 특징 | 사용 케이스 |
|------|------|-------------|
| **Fixed** | 브라우저 스크롤 차단, 화면 100% 고정 | 좌우 분할 CRUD, AI 워크스페이스 |
| **Scrollable** | 브라우저 자체 스크롤 허용 (기본값) | 대시보드, 모니터링, 리포트 |

### 자동 감지 메커니즘
레이아웃 모드는 **URL 경로**를 기반으로 자동으로 결정됩니다.

```typescript
// apps/dwp/src/layouts/dashboard/layout.tsx
const layoutMode = (() => {
  if (pathname.includes('/ai-workspace')) return 'fixed';
  if (pathname === '/admin/menus' || pathname.startsWith('/admin/menus/')) return 'fixed';
  if (pathname === '/admin/roles' || pathname.startsWith('/admin/roles/')) return 'fixed';
  return 'scrollable';  // 기본값
})();
```

---

## Fixed 모드 (Full-Height SPA)

### 특징
- 브라우저 자체 스크롤바가 **완전히 차단**됩니다.
- 화면이 뷰포트에 100% 고정됩니다.
- 내부의 개별 패널만 독립적으로 스크롤됩니다.
- 고급스러운 대시보드 느낌을 제공합니다.

### 사용 케이스
#### 1. 좌우 분할 CRUD 화면
- 메뉴 관리 (`/admin/menus`)
- 권한 관리 (`/admin/roles`)

**구조 예시**:
```
┌─────────────────────────────────────┐
│           Header (고정)             │
├──────────────┬──────────────────────┤
│              │                      │
│  좌측 목록    │    우측 상세          │
│  (스크롤)    │    (스크롤)          │
│              │                      │
│              │                      │
└──────────────┴──────────────────────┘
```

#### 2. AI 워크스페이스
- `/ai-workspace`
- 좌측 채팅, 우측 작업 공간 분할

### CSS 동작 원리
```typescript
// Fixed 모드 시 적용되는 CSS
LayoutRoot: {
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',  // 브라우저 스크롤 차단
}

MainSection: {
  minHeight: 0,
  overflow: 'hidden',
}

DashboardContent: {
  minHeight: 0,
}
```

### 코드 예시
```typescript
// apps/remotes/admin/src/pages/menus/page.tsx
<Box sx={{ 
  p: 3,
  flex: 1,           // 부모의 높이를 채움
  minHeight: 0,      // 높이 누출 방지
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}}>
  <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
    {/* 좌측 목록 */}
    <Grid size={{ xs: 12, md: 4 }} sx={{ minHeight: 0 }}>
      <Card sx={{ flex: 1, overflow: 'hidden' }}>
        <Scrollbar>  {/* 내부 스크롤 */}
          <MenuTreePanel />
        </Scrollbar>
      </Card>
    </Grid>
    {/* 우측 상세 */}
    <Grid size={{ xs: 12, md: 8 }} sx={{ minHeight: 0 }}>
      <MenuDetailEditor />
    </Grid>
  </Grid>
</Box>
```

---

## Scrollable 모드 (기본값)

### 특징
- 브라우저 자체 스크롤이 **허용**됩니다.
- 콘텐츠 길이에 따라 페이지 전체가 아래로 늘어납니다.
- 전통적인 웹사이트 느낌을 제공합니다.

### 사용 케이스
#### 1. 대시보드
- `/dashboard`
- 여러 위젯이 세로로 나열됨

#### 2. 통합 모니터링
- `/admin/monitoring`
- KPI 카드, 차트, 테이블이 길게 나열됨

#### 3. 기타 관리 페이지
- `/admin/users`, `/admin/codes` 등
- 단순 리스트/폼 화면

### CSS 동작 원리
```typescript
// Scrollable 모드 시 적용되는 CSS (기본값)
LayoutRoot: {
  minHeight: '100vh',  // 최소 높이만 보장
  width: '100vw',
  // overflow는 자동 (브라우저 스크롤 허용)
}

MainSection: {
  // minHeight: 0, overflow: hidden 적용 안 함
}
```

### 코드 예시
```typescript
// apps/remotes/admin/src/pages/monitoring/page.tsx
<Box sx={{ p: 3 }}>  {/* flex: 1, minHeight: 0 없음 */}
  <Stack spacing={3}>
    <Typography variant="h4">통합 모니터링 대시보드</Typography>
    
    {/* KPI 카드 */}
    <MonitoringKPICards />
    
    {/* 차트 */}
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
      <Card sx={{ flex: 1, p: 3 }}>
        <MonitoringCharts type="pv-uv" />
      </Card>
      <Card sx={{ flex: 1, p: 3 }}>
        <MonitoringCharts type="api" />
      </Card>
    </Stack>
    
    {/* 상세 테이블 */}
    <Card sx={{ p: 3 }}>
      <MonitoringTabs />
    </Card>
  </Stack>
</Box>
```

---

## 모드 선택 기준

### Fixed 모드를 선택해야 할 때 ✅
- 좌우 또는 상하로 화면이 **분할**되어 있고
- 각 영역이 **독립적으로 스크롤**되어야 하며
- **전체 화면을 100% 활용**해야 하는 경우

**예시**: 메뉴 관리, 권한 관리, 리소스 관리, AI 워크스페이스

### Scrollable 모드를 선택해야 할 때 ✅
- 콘텐츠가 **세로로 길게 나열**되고
- **브라우저 스크롤**이 자연스러운 경우
- **간단한 리스트/폼** 화면

**예시**: 대시보드, 모니터링, 사용자 관리, 코드 관리, 감사 로그

### 판단 기준 요약

| 기준 | Fixed | Scrollable |
|------|-------|------------|
| 레이아웃 | 좌우/상하 분할 | 세로 나열 |
| 스크롤 | 내부 패널만 | 브라우저 전체 |
| 콘텐츠 양 | 고정된 영역 | 가변적 |
| UX 느낌 | 대시보드/앱 | 웹사이트 |

---

## Admin CRUD 표준 (Layout Mode별 패턴)

### Fixed 모드 CRUD (좌우 분할)

| 화면 | 경로 | 모드 | 좌측 | 우측 |
|------|------|------|------|------|
| 메뉴 관리 | `/admin/menus` | Fixed | 메뉴 트리 목록 | 메뉴 상세/편집 |
| 권한 관리 | `/admin/roles` | Fixed | 권한 목록 | 권한 상세/멤버/권한 탭 |
| 리소스 관리 | `/admin/resources` | Fixed (향후) | 리소스 목록 | 리소스 상세 |

**구조 표준**:
- 좌측 폭: 320px (md 이상)
- 우측 폭: flex 1 (나머지 공간)
- 모바일(xs, sm): 좌측 → 우측 stack 형태로 자동 전환

### Scrollable 모드 CRUD (단순 테이블)

| 화면 | 경로 | 모드 | 구조 |
|------|------|------|------|
| 사용자 관리 | `/admin/users` | Scrollable | 상단 필터 + 테이블 + 모달 |
| 코드 관리 | `/admin/codes` | Scrollable | 탭 + 테이블 |
| 코드 사용 정의 | `/admin/code-usages` | Scrollable | 상단 필터 + 테이블 |
| 감사 로그 | `/admin/audit` | Scrollable | 상단 필터 + 테이블 + Drawer |
| 통합 모니터링 | `/admin/monitoring` | Scrollable | KPI 카드 + 차트 + 탭 테이블 |

**구조 표준**:
- 상단: FilterBar (검색/필터/액션)
- 중간: DataTable (테이블 또는 카드 리스트)
- 하단: 페이지네이션
- 편집: Modal 또는 Drawer

---

## 반응형 표준 (Mobile-First)

### 모바일 규칙 (xs, sm)

#### 1. 좌우 분할 → Stack 전환 (Fixed 모드)
```typescript
// ✅ DO: Grid size 기반 자동 전환
<Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
  <Grid size={{ xs: 12, md: 4 }} sx={{ minHeight: 0 }}>
    {/* 좌측 목록: 모바일에서 상단으로 */}
  </Grid>
  <Grid size={{ xs: 12, md: 8 }} sx={{ minHeight: 0 }}>
    {/* 우측 상세: 모바일에서 하단으로 */}
  </Grid>
</Grid>
```

#### 2. Table → overflowX auto (우선)
```typescript
// ✅ DO: 테이블 가로 스크롤 허용
<Box sx={{ overflowX: 'auto' }}>
  <Table sx={{ minWidth: 650 }}>  {/* 최소 너비 보장 */}
    {/* 테이블 내용 */}
  </Table>
</Box>
```

**원칙**:
- ❌ 모바일에서 컬럼 숨기기 금지 (정보 손실)
- ❌ 테이블을 카드로 전환 금지 (과도한 리디자인)
- ✅ 가로 스크롤을 허용해서 모든 컬럼 표시

#### 3. FilterBar → Column Stack (Scrollable 모드)
```typescript
// ✅ DO: 모바일에서 자동 세로 배치
<FilterBar
  controls={
    <>
      <TextField placeholder="검색" sx={{ minWidth: 200 }} />
      <Select>...</Select>
    </>
  }
  actions={
    <>
      <Button variant="contained">추가</Button>
      <Button variant="outlined">다운로드</Button>
    </>
  }
/>

// 자동 변환:
// xs: controls와 actions가 세로로 stack
// sm+: controls와 actions가 가로로 배치
```

### Breakpoint 기준

| Breakpoint | 크기 | 적용 |
|------------|------|------|
| xs | 0~600px | 모바일 (세로 stack) |
| sm | 600~900px | 태블릿 (일부 stack 유지) |
| md | 900~1200px | 데스크탑 (좌우 분할 적용) |
| lg | 1200~1536px | 큰 데스크탑 |
| xl | 1536px+ | 매우 큰 화면 |

### 반응형 체크리스트

- [ ] 모바일(xs)에서 좌우 분할이 stack으로 전환됨
- [ ] 테이블이 모바일에서 가로 스크롤 가능
- [ ] FilterBar가 모바일에서 세로로 배치됨
- [ ] 버튼이 화면 밖으로 밀리지 않음
- [ ] 텍스트가 화면 밖으로 잘리지 않음 (noWrap + Tooltip 또는 줄바꿈)
- [ ] 모든 컨텐츠가 터치 타겟 최소 44x44px 확보

---

## 새 페이지 추가 시 설정 방법

### 1. 기본값 사용 (Scrollable)
대부분의 경우 **별도 설정 불필요**합니다. 기본값이 `scrollable`이므로 그대로 사용하면 됩니다.

```typescript
// 아무 설정 없이 페이지 작성
export const MyPage = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">내 페이지</Typography>
      {/* 콘텐츠 */}
    </Box>
  );
};
```

### 2. Fixed 모드 추가 (특수한 경우만)
좌우 분할 CRUD 화면 등 특수한 경우에만 `fixed` 모드를 추가합니다.

#### Step 1: `layout.tsx`에 경로 추가
```typescript
// apps/dwp/src/layouts/dashboard/layout.tsx

const layoutMode = (() => {
  if (pathname.includes('/ai-workspace')) return 'fixed';
  if (pathname === '/admin/menus' || pathname.startsWith('/admin/menus/')) return 'fixed';
  if (pathname === '/admin/roles' || pathname.startsWith('/admin/roles/')) return 'fixed';
  
  // 새 페이지 추가
  if (pathname === '/admin/my-page' || pathname.startsWith('/admin/my-page/')) return 'fixed';
  
  return 'scrollable';
})();
```

#### Step 2: 페이지 레이아웃 작성
```typescript
// apps/remotes/admin/src/pages/my-page/page.tsx

export const MyPage = () => {
  return (
    <Box sx={{ 
      p: 3,
      flex: 1,           // 필수!
      minHeight: 0,      // 필수!
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        <Grid size={{ xs: 12, md: 4 }} sx={{ minHeight: 0 }}>
          {/* 좌측 패널 */}
        </Grid>
        <Grid size={{ xs: 12, md: 8 }} sx={{ minHeight: 0 }}>
          {/* 우측 패널 */}
        </Grid>
      </Grid>
    </Box>
  );
};
```

#### Step 3: PR에 근거 명시
```markdown
## Fixed 모드 추가 근거

**페이지**: `/admin/my-page`

**이유**: 
- 좌측 목록, 우측 상세로 화면이 분할됨
- 각 영역이 독립적으로 스크롤되어야 함
- 전체 화면을 100% 활용해야 함

**참고**: 메뉴 관리(`/admin/menus`)와 동일한 패턴
```

---

## 트러블슈팅

### 문제 1: "브라우저 스크롤바가 생겨요" (Fixed 모드에서)

**원인**: 페이지 컴포넌트에 `flex: 1`, `minHeight: 0`이 누락됨

**해결**:
```typescript
// ❌ 잘못된 예
<Box sx={{ p: 3 }}>  {/* flex: 1 없음 */}

// ✅ 올바른 예
<Box sx={{ 
  p: 3,
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
}}>
```

### 문제 2: "내부 패널 스크롤이 안 돼요" (Fixed 모드에서)

**원인**: `Scrollbar` 컴포넌트에 높이 제약이 없음

**해결**:
```typescript
// ❌ 잘못된 예
<Scrollbar>
  <MenuTreePanel />
</Scrollbar>

// ✅ 올바른 예
<Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
  <Scrollbar sx={{ height: '100%' }}>
    <MenuTreePanel />
  </Scrollbar>
</Box>
```

### 문제 3: "Scrollable 모드인데 스크롤이 안 돼요"

**원인**: 실수로 Fixed 모드 경로에 추가됨

**해결**:
```typescript
// apps/dwp/src/layouts/dashboard/layout.tsx 확인
// 해당 경로가 fixed 모드 조건에 포함되어 있지 않은지 확인
```

### 문제 4: "화면이 너무 높아요/낮아요"

**Fixed 모드**: `calc(100vh - var(--layout-header-height))`가 잘못 계산됨  
**해결**: `flex: 1, minHeight: 0` 패턴 사용 (calc 사용 금지)

**Scrollable 모드**: 콘텐츠가 부족해서 화면이 짧음  
**해결**: 정상입니다. 콘텐츠가 늘어나면 자동으로 스크롤 생김

---

## 참고 문서

- **Admin CRUD 표준**: `docs/essentials/ADMIN_CRUD_STANDARD.md`
- **디자인 시스템**: `docs/essentials/DESIGN_SYSTEM.md`
- **메뉴 관리 참고 코드**: `apps/remotes/admin/src/pages/menus/page.tsx`
- **권한 관리 참고 코드**: `apps/remotes/admin/src/pages/roles/page.tsx`

---

## 요약

- **대부분의 페이지**: Scrollable 모드 (기본값, 별도 설정 불필요)
- **좌우 분할 CRUD**: Fixed 모드 (경로 추가 + 레이아웃 작성)
- **의문이 생기면**: 비슷한 기존 페이지 참고 (메뉴 관리, 모니터링)

**Happy Coding! 🚀**
