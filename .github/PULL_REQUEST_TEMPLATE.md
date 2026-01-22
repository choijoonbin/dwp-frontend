# Pull Request

## 📝 변경 사항 요약
<!-- 무엇을 변경했는지 간단히 설명해주세요 -->

## 📚 관련 이슈/작업
<!-- 연관된 이슈나 작업이 있다면 링크를 추가해주세요 -->
- Closes #

## 🧪 테스트 방법
<!-- 이 PR을 어떻게 테스트할 수 있는지 설명해주세요 -->

## 📸 스크린샷 (UI 변경 시)
<!-- UI 변경이 있다면 변경 전후 스크린샷을 첨부해주세요 -->

---

## ✅ PR 체크리스트

### 기본 검증
- [ ] 코드가 빌드/실행된다 (`yarn build`, `yarn dev`)
- [ ] Lint가 통과한다 (`yarn lint`)
- [ ] Type 체크가 통과한다 (`yarn typecheck`)
- [ ] 추가된 기능/수정된 버그에 대한 테스트를 작성했다
- [ ] 커밋 메시지가 명확하고 이해하기 쉽다

### UI 개발 시 (필수)
- [ ] **디자인 시스템 준수**: `docs/essentials/DESIGN_SYSTEM.md` 참고
  - [ ] MUI v5만 사용 (shadcn/radix 금지)
  - [ ] Iconify만 사용 (lucide 금지)
  - [ ] 테마 토큰만 사용 (하드코딩 색상 금지)
  - [ ] 공통 패턴 컴포넌트 사용 (`@dwp-frontend/design-system`)
- [ ] **레이아웃 모드 확인**: `docs/essentials/LAYOUT_GUIDE.md` 참고
  - [ ] Fixed/Scrollable 모드 적절히 선택
  - [ ] 브라우저 스크롤 정책 준수
- [ ] **반응형 동작 확인**
  - [ ] xs (모바일): 320px 이상
  - [ ] sm (태블릿): 600px 이상
  - [ ] md (데스크탑): 960px 이상
  - [ ] 터치 타겟 최소 44x44px 보장

### Admin CRUD 화면 개발 시 (필수)
- [ ] **표준 구조 준수**: `docs/essentials/ADMIN_CRUD_STANDARD.md` 참고
  - [ ] Feature Folder 구조 (`page.tsx`, `types.ts`, `adapters/`, `hooks/`, `components/`)
  - [ ] Query Key 네이밍 규칙 준수
  - [ ] CodeUsage 기반 select 사용 (하드코딩 금지)
  - [ ] PermissionRouteGuard + PermissionGate 적용
  - [ ] trackEvent 호출 (VIEW/SEARCH/FILTER/SUBMIT 등)

### 문서화
- [ ] 새로운 공통 컴포넌트 추가 시 `docs/essentials/DESIGN_SYSTEM.md` 업데이트
- [ ] 새로운 패턴/규칙 추가 시 `docs/essentials/PROJECT_RULES.md` 업데이트
- [ ] README.md 업데이트 (필요 시)

### 코드 품질
- [ ] 파일 크기 제한 준수 (Page: 400줄, Component: 250줄 이하)
- [ ] 로직 분리 (UI ↔ 비즈니스 로직)
- [ ] 명확한 변수/함수명 사용
- [ ] any 타입 사용 안 함 (불가피할 경우 unknown + type guard)

---

## 📖 참고 문서

- **[신규 개발자 시작 가이드](../docs/README.md)**: 전체 문서 인덱스
- **[디자인 시스템](../docs/essentials/DESIGN_SYSTEM.md)**: UI 개발 필수
- **[Admin CRUD 표준](../docs/essentials/ADMIN_CRUD_STANDARD.md)**: CRUD 개발 필수
- **[레이아웃 가이드](../docs/essentials/LAYOUT_GUIDE.md)**: Fixed/Scrollable 모드
- **[핵심 규칙](../docs/essentials/PROJECT_RULES.md)**: 프로젝트 전체 규칙
- **[상세 PR 체크리스트](../docs/reference/PR_CHECKLIST_UI.md)**: UI 개발자용 상세 가이드

---

## 👀 리뷰어에게
<!-- 리뷰어가 특별히 확인해야 할 부분이 있다면 적어주세요 -->
